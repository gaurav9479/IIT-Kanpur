import Mission from "../models/Mission.model.js";
import Drone from "../models/Drone.model.js";
import Order from "../models/Order.model.js";
import navigationService from "./navigation.service.js";
import aiService from "./ai.service.js";
import { NO_FLY_ZONES } from "../config/safety.config.js";
import { io } from "../server.js";
import logger from "../utils/logger.js";
import simulationService from "./simulation.service.js";

import gridOccupancyService from "./gridOccupancy.service.js";
import collisionService from "./collision.service.js";

class MissionService {
    async createMission(orderId) {
        const order = await Order.findById(orderId);
        if (!order) throw new Error("Order not found");

        const { pickupLocation, dropLocation, weight } = order;

        // Find best idle drone
        const drone = await Drone.findOne({
            status: "idle",
            payloadCapacity: { $gte: weight }
        });

        if (!drone) throw new Error("No suitable idle drone found");

        // Plan 3D Trajectory
        const congestionScores = gridOccupancyService.getCongestionData();
        const navData = await navigationService.get3DRoute(
            pickupLocation,
            dropLocation,
            { 
                droneId: drone.droneId,
                congestionScores 
            }
        );

        const { path, distance } = navData;

        // Request Takeoff
        await collisionService.requestTakeoff(drone.droneId, order.hubId || "HUB-01");

        // Predict Battery Usage
        const batteryUsagePrediction = await aiService.predictBatteryDrain({
            distance,
            droneSpeed: 15,
            altitude: 15,
            payloadWeight: weight
        });

        if (drone.batteryLevel < batteryUsagePrediction * 1.15) {
            throw new Error("Insufficient battery for this mission");
        }

        const mission = await Mission.create({
            missionId: `MSN-${Date.now()}`,
            order: order._id,
            drone: drone._id,
            pickupNode: "IITK-NODE",
            dropoffNode: "DEST-NODE",
            status: "IN_PROGRESS",
            estimatedBatteryUsage: batteryUsagePrediction,
            totalDistance: distance,
            trajectoryData: path
        });

        drone.status = "delivering";
        await drone.save();

        order.status = "assigned";
        order.assignedDrone = drone._id;
        await order.save();

        io.emit("event_log", {
            message: `MISSION DISPATCHED: ${mission.missionId} (Drone: ${drone.droneId})`,
            type: "info"
        });

        // Start Simulation
        simulationService.startDeliverySimulation(order._id, drone._id);

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
