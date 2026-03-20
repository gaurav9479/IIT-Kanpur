import Mission from "../models/Mission.model.js";
import Drone from "../models/Drone.model.js";
import Order from "../models/Order.model.js";
import navigationService from "./navigation.service.js";
import aiService from "./ai.service.js";
import { NO_FLY_ZONES } from "../config/safety.config.js";
import { io } from "../server.js";
import logger from "../utils/logger.js";
import simulationService from "./simulation.service.js";
import drone3DService from "./drone3DService.js";

import gridOccupancyService from "./gridOccupancy.service.js";
import collisionService from "./collision.service.js";
import ApiError from "../utils/ApiError.js";

class MissionService {
    async createMission(orderId) {
        const order = await Order.findById(orderId);
        if (!order) {
            logger.error(`Mission creation failed: Order ${orderId} not found`);
            throw new Error("Order not found");
        }
        logger.info(`[MissionService] Creating mission for Order: ${order._id}, Weight: ${order.weight}`);

        const { pickupLocation, dropLocation, weight } = order;

        // Find best idle drone
        const drone = await Drone.findOne({
            status: "idle",
            payloadCapacity: { $gte: weight }
        });

        if (!drone) {
            logger.warn(`[MissionService] No idle drone found for weight ${weight}`);
            throw new ApiError(404, `No suitable idle drone found for payload: ${weight}kg`);
        }
        logger.info(`[MissionService] Selected Drone: ${drone.droneId}, Capacity: ${drone.payloadCapacity}`);

        // Plan 3D Trajectory
        const congestionScores = gridOccupancyService.getCongestionData();
        logger.info(`[MissionService] Planning 3D trajectory...`);
        let navData;
        try {
            navData = await navigationService.get3DRoute(
                pickupLocation,
                dropLocation,
                {
                    droneId: drone.droneId,
                    congestionScores
                }
            );

            if (!navData || !navData.path) {
                logger.error(`[MissionService] Navigation failed: No path found`);
                throw new Error("Route planning failed: No valid path found between points");
            }
        } catch (error) {
            if (error.message === "NO_GRAPH_PATH") {
                throw new Error("NO_GRAPH_PATH");
            }
            throw error;
        }

        const { path, distance, lane, slotIndex, source: routeSource } = navData;
        const validDistance = Number(distance) || 0;
        logger.info(`[MissionService] Route planned: ${validDistance}m, Lane: ${lane}, Method: ${routeSource}`);

        // Request Takeoff
        await collisionService.requestTakeoff(drone.droneId, order.hubId || "HUB-01");

        // AI-Driven ETA & Battery Prediction
        const aiPrediction = await aiService.predictETA({
            distance: validDistance / 1000, // Convert to km for AI
            payload: weight,
            batteryLevel: drone.batteryLevel,
            numDrones: (navData.lane ? (gridOccupancyService.getCongestionData().find(c => c.id === navData.lane)?.density || 1) : 0)
        });

        const batteryUsage = aiPrediction ? aiPrediction.batteryUsed : (validDistance / 1000 * 5); 
        const arrivalTimeArr = aiPrediction ? aiPrediction.estimatedArrival : new Date(Date.now() + 600000).toISOString();
        const batteryAfter = aiPrediction ? aiPrediction.batteryAfter : (drone.batteryLevel - batteryUsage);

        if (drone.batteryLevel < batteryUsage * 1.15) {
            logger.warn(`[MissionService] Insufficient battery for mission. Required: ${batteryUsage}%, Available: ${drone.batteryLevel}%`);
            throw new Error("Insufficient battery for this mission based on AI prediction");
        }

        let mission;
        try {
            mission = await Mission.create({
                missionId: `MSN-${Date.now()}`,
                order: order._id,
                drone: drone._id,
                pickupNode: "IITK-NODE",
                dropoffNode: "DEST-NODE",
                status: "IN_PROGRESS",
                estimatedBatteryUsage: isNaN(batteryUsage) ? 0 : batteryUsage,
                estimatedArrival: arrivalTimeArr,
                batteryAfter: isNaN(batteryAfter) ? drone.batteryLevel : batteryAfter,
                totalDistance: validDistance,
                trajectoryData: path,
                lane,
                slotIndex
            });
        } catch (error) {
            logger.error(`[MissionService] Mission.create failed: ${error.message}`);
            throw new Error(`Database Error: Failed to create mission record - ${error.message}`);
        }

        drone.status = "delivering";
        await drone.save();

        order.status = "assigned";
        order.assignedDrone = drone._id;
        await order.save();

        io.emit("event_log", {
            message: `MISSION DISPATCHED: ${mission.missionId} (Drone: ${drone.droneId})`,
            type: "info"
        });

        // NFZ bypass warning — shows in Event Log when A* detour was needed
        if (routeSource === "astar-grid") {
            io.emit("event_log", {
                message: `⚠️ NFZ DETECTED on route → A* BYPASS ACTIVE for ${drone.droneId}. Drone rerouted around No-Fly Zone periphery. ${path?.length || 0} safe waypoints computed.`,
                type: "warning"
            });
        }

        io.emit("event_log", {
            message: `ROUTE: ${drone.droneId} | ${validDistance.toFixed(0)}m | ${path?.length || 0} waypoints | Algorithm: ${routeSource === 'astar-grid' ? 'A* Grid' : routeSource || 'Graph'}`,
            type: "info"
        });

        // Start 3D Simulation if path is available; fallback to legacy sim
        if (path && path.length >= 2) {
            drone3DService.startDrone3D(drone.droneId, path, 10, (id) => {
                logger.info(`[3D] Drone ${id} completed 3D mission`);
            });
        } else {
            simulationService.startDeliverySimulation(order._id, drone._id);
        }

        return mission;
    }

    async reassignMission(orderId, oldDroneId) {
        logger.info(`Attempting auto-reassignment for Order: ${orderId} (Previous Drone: ${oldDroneId})`);
        io.emit("event_log", { message: `RE-ASSIGNMENT: Attempting to find replacement for order ${orderId}...`, type: "warning" });

        try {
            const mission = await this.createMission(orderId);
            logger.info(`Successfully reassigned Order: ${orderId} to new Mission: ${mission.missionId}`);
            io.emit("event_log", { message: `SUCCESS: Order ${orderId} reassigned to ${mission.missionId}`, type: "info" });
            return mission;
        } catch (error) {
            logger.error(`Reassignment failed for Order: ${orderId}: ${error.message}`);
            io.emit("event_log", { message: `CRITICAL: Reassignment FAILED for ${orderId}. Human intervention required.`, type: "error" });
            await Order.findByIdAndUpdate(orderId, { status: "failed" });
        }
    }
}

export default new MissionService();
