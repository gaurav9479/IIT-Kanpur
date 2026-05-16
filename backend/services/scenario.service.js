import MissionService from "./mission.service.js";
import Order from "../models/Order.model.js";
import Drone from "../models/Drone.model.js";
import Mission from "../models/Mission.model.js";
import { io } from "../server.js";
import logger from "../utils/logger.js";
import { CAMPUS_NODES } from "../config/campusGraph.config.js";

// Helper: look up a node by its ID from the real campus graph
function node(id) {
    const n = CAMPUS_NODES.find(n => n.id === id);
    if (!n) throw new Error(`Campus node '${id}' not found in campusGraph.config.js`);
    return { lat: n.lat, lng: n.lng, name: n.name };
}

class ScenarioService {
    async runScenario(name) {
        try {
            logger.info(`[ScenarioService] Initializing scenario: ${name}`);
            
            // 1. Reset Environment
            logger.info(`[ScenarioService] Cleaning up old missions/orders...`);
            await Mission.deleteMany({});
            await Order.deleteMany({});
            
            // Reset and Ensure Drones (Fleet of 50 for robust 40-mission scenario)
            const currentCount = await Drone.countDocuments();
            logger.info(`[ScenarioService] Current drone count: ${currentCount}`);
            
            if (currentCount < 50) {
                logger.info(`[ScenarioService] Scaling fleet to 50 drones...`);
                const hubs = CAMPUS_NODES.filter(n => n.id.startsWith('HUB-'));
                
                for (let i = currentCount; i < 50; i++) {
                    const droneId = `DRN-${String(i + 1).padStart(3, '0')}`;
                    const hub = hubs[i % hubs.length]; // Distribute among hubs
                    
                    await Drone.create({
                        droneId,
                        batteryLevel: 100,
                        status: "idle",
                        payloadCapacity: 5,
                        operatingAltitude: 80 + (Math.floor(i / 5) * 20), // 80m, 100m, 120m...
                        location: { lat: hub.lat, lng: hub.lng },
                        homeHub: { lat: hub.lat, lng: hub.lng }
                    });
                }
            }
            
            // Reset ALL drones to idle/full battery at their hubs
            const drones = await Drone.find({});
            for (const d of drones) {
                await Drone.updateOne({ _id: d._id }, {
                    status: "idle",
                    batteryLevel: 100,
                    payloadCapacity: 10, // Ensure high capacity for any random scenario weight
                    operatingAltitude: Math.max(80, d.operatingAltitude || 80),
                    location: d.homeHub || { lat: 26.5145, lng: 80.2325 }
                });
            }

            
            // Emit a clean start event
            if (io) {
                io.emit("event_log", { message: `🎬 SCENARIO STARTED: ${name.toUpperCase()}`, type: "info" });
                io.emit("scenario_reset", { success: true });
            }

            const scenarios = {
                "fleet_40": () => this.launchFleet40(),
            };

            if (scenarios[name]) {
                logger.info(`[ScenarioService] Launching sequence for ${name}...`);
                scenarios[name]();
                return { success: true, message: `Scenario ${name} sequence initiated.` };
            } else {
                return { success: false, message: "Invalid scenario name" };
            }
        } catch (error) {
            logger.error(`[ScenarioService] CRITICAL FAILURE: ${error.message}`);
            if (io) {
                io.emit("event_log", { message: `❌ SCENARIO FAILED: ${error.message}`, type: "error" });
            }
            throw error;
        }
    }

    /**
     * SCENARIO: FLEET 40
     * Launches 40 drones on random cross-campus missions.
     */
    async launchFleet40() {
        const nodes = CAMPUS_NODES;
        const totalMissions = 40;

        io.emit("event_log", { message: `🛫 FLEET 40: Initiating sequence for 40 simultaneous missions...`, type: "info" });

        for (let i = 0; i < totalMissions; i++) {
            setTimeout(async () => {
                try {
                    // Pick random start and end nodes from campus graph
                    const startNode = nodes[Math.floor(Math.random() * nodes.length)];
                    let endNode = nodes[Math.floor(Math.random() * nodes.length)];
                    
                    // Ensure they aren't the same
                    while (endNode.id === startNode.id) {
                        endNode = nodes[Math.floor(Math.random() * nodes.length)];
                    }

                    const order = await Order.create({
                        orderId: `ORD-F40-${i}-${Date.now()}`,

                        customerName: `Fleet40: ${startNode.name} → ${endNode.name}`,
                        pickupLocation: { lat: startNode.lat, lng: startNode.lng },
                        dropLocation: { lat: endNode.lat, lng: endNode.lng },
                        weight: 1 + Math.random() * 4,
                        status: "pending"
                    });

                    await MissionService.createMission(order._id);
                    logger.info(`[Scenario:Fleet40] Mission ${i+1}/40 dispatched: ${startNode.name} → ${endNode.name}`);
                } catch (e) {
                    logger.error(`[Scenario:Fleet40] Mission ${i+1} failed: ${e.message}`);
                }
            }, i * 800); // Staggered launch every 800ms to avoid DB/socket flooding
        }
    }
}

export default new ScenarioService();

