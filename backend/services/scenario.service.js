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
            
            // Reset and Ensure Drones
            const droneCount = await Drone.countDocuments();
            logger.info(`[ScenarioService] Current drone count: ${droneCount}`);
            
            if (droneCount < 10) {
                logger.info(`[ScenarioService] Creating extra drones for scenario...`);
                for (let i = droneCount; i < 12; i++) {
                    const droneId = `DRN-AUTO-${i+1}-${Math.floor(Math.random()*1000)}`;
                    await Drone.create({
                        droneId,
                        batteryLevel: 100,
                        status: "idle",
                        payloadCapacity: 5,
                        operatingAltitude: 40 + (i * 5),
                        location: { lat: 26.5145, lng: 80.2325 }
                    });
                }
            } else {
                logger.info(`[ScenarioService] Resetting existing drones...`);
                await Drone.updateMany({}, { 
                    status: "idle", 
                    batteryLevel: 100,
                    location: { lat: 26.5145, lng: 80.2325 }
                });
            }
            
            // Emit a clean start event
            if (io) {
                io.emit("event_log", { message: `🎬 SCENARIO STARTED: ${name.toUpperCase()}`, type: "info" });
                io.emit("scenario_reset", { success: true });
            }

            const scenarios = {
                "traffic": () => this.launchHighTraffic(),
                "altitude": () => this.launchAltitudeConflict(),
                "congestion": () => this.launchHubCongestion(),
                "battery": () => this.launchBatteryEmergency()
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

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 1: HIGH TRAFFIC DENSITY
    // Real hub-to-hub inter-campus delivery pairs using campus graph nodes
    // ─────────────────────────────────────────────────────────────
    async launchHighTraffic() {
        // All 5 real drone hubs from campusGraph.config.js
        const HUB_N  = node("HUB-N");  // Hub North
        const HUB_S  = node("HUB-S");  // Hub South
        const HUB_E  = node("HUB-E");  // Hub East
        const HUB_W  = node("HUB-W");  // Hub West
        const HUB_C  = node("HUB-C");  // Hub Central

        // 8 cross-campus delivery pairs with real named locations
        const pairs = [
            { src: HUB_N, dst: HUB_S, label: "North→South" },
            { src: HUB_S, dst: HUB_N, label: "South→North" },
            { src: HUB_E, dst: HUB_W, label: "East→West" },
            { src: HUB_W, dst: HUB_E, label: "West→East" },
            { src: HUB_N, dst: HUB_E, label: "North→East" },
            { src: HUB_S, dst: HUB_W, label: "South→West" },
            { src: HUB_W, dst: HUB_C, label: "West→Central" },
            { src: HUB_C, dst: HUB_S, label: "Central→South" },
        ];

        for (let i = 0; i < pairs.length; i++) {
            const { src, dst, label } = pairs[i];
            setTimeout(async () => {
                try {
                    const order = await Order.create({
                        orderId: `ORD-TRF-${i}-${Date.now()}`,
                        customerName: `Traffic: ${src.name} → ${dst.name}`,
                        pickupLocation: { lat: src.lat, lng: src.lng },
                        dropLocation: { lat: dst.lat, lng: dst.lng },
                        weight: 2,
                        status: "pending"
                    });
                    await MissionService.createMission(order._id);
                    logger.info(`[Scenario:Traffic] Mission ${label} dispatched`);
                } catch (e) {
                    logger.error(`Scenario Traffic mission ${i} (${label}) failed: ${e.message}`);
                }
            }, i * 2500);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 2: ALTITUDE TRAFFIC CONFLICT
    // Drones launched from real named locations on crossing paths,
    // deliberately sharing altitudes to trigger lane reassignment
    // ─────────────────────────────────────────────────────────────
    async launchAltitudeConflict() {
        // 8 real campus location pairs on crossing flight corridors
        const missions = [
            // N↔S corridor (same altitude = guaranteed conflict)
            { src: node("HUB-N"),  dst: node("HUB-S"),  alt: 30, label: "HubNorth→HubSouth" },
            { src: node("HUB-S"),  dst: node("HUB-N"),  alt: 30, label: "HubSouth→HubNorth" },
            // E↔W corridor (same altitude = conflict with above)
            { src: node("HUB-E"),  dst: node("HUB-W"),  alt: 40, label: "HubEast→HubWest" },
            { src: node("HUB-W"),  dst: node("HUB-E"),  alt: 40, label: "HubWest→HubEast" },
            // Academic diagonal: LHC → Girls Hostel (crosses N-S corridor)
            { src: node("LHC"),    dst: node("GH2"),    alt: 40, label: "LHC→GirlsHostel2" },
            { src: node("GH2"),    dst: node("LHC"),    alt: 40, label: "GirlsHostel2→LHC" },
            // Hostel to Hub diagonal (crosses E-W corridor)
            { src: node("H1"),     dst: node("HUB-N"),  alt: 50, label: "Hall1→HubNorth" },
            { src: node("H9"),     dst: node("HUB-W"),  alt: 50, label: "Hall9→HubWest" },
        ];

        for (let i = 0; i < missions.length; i++) {
            const { src, dst, alt, label } = missions[i];
            setTimeout(async () => {
                try {
                    const drone = await Drone.findOne({ status: "idle" });
                    if (drone) {
                        drone.operatingAltitude = alt;
                        await drone.save();
                    }
                    const order = await Order.create({
                        orderId: `ORD-ALT-${i}-${Date.now()}`,
                        customerName: `AltConflict: ${label} @ ${alt}m`,
                        pickupLocation: { lat: src.lat, lng: src.lng },
                        dropLocation: { lat: dst.lat, lng: dst.lng },
                        weight: 1,
                        status: "pending"
                    });
                    await MissionService.createMission(order._id);
                    if (io) {
                        io.emit("event_log", {
                            message: `🛫 ALT CONFLICT [${label}] @ ${alt}m — lane negotiation active`,
                            type: "warning"
                        });
                    }
                    logger.info(`[Scenario:Altitude] ${label} @ ${alt}m dispatched`);
                } catch (e) {
                    logger.error(`Altitude conflict mission ${i} (${label}) failed: ${e.message}`);
                }
            }, i * 600); // 600ms gaps = maximum lane contention
        }
    }

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 3: HUB RUSH HOUR (CONGESTION)
    // 6 real delivery locations all converging on Hub Central
    // ─────────────────────────────────────────────────────────────
    async launchHubCongestion() {
        const hubCentral = node("HUB-C"); // Hub Central — real campus hub

        // 6 campus locations sending packages simultaneously to Hub Central
        const sources = [
            { ...node("H1"),   label: "Hall 1" },
            { ...node("LHC"),  label: "Lecture Hall Complex" },
            { ...node("H5"),   label: "Hall 5" },
            { ...node("H9"),   label: "Hall 9" },
            { ...node("GH"),   label: "Guest House" },
            { ...node("GATE"), label: "Main Gate" },
        ];

        for (let i = 0; i < sources.length; i++) {
            const src = sources[i];
            setTimeout(async () => {
                try {
                    const order = await Order.create({
                        orderId: `ORD-CONG-${i}-${Date.now()}`,
                        customerName: `Hub Rush: ${src.label} → Hub Central`,
                        pickupLocation: { lat: src.lat, lng: src.lng },
                        dropLocation: { lat: hubCentral.lat, lng: hubCentral.lng },
                        weight: 1,
                        status: "pending"
                    });
                    await MissionService.createMission(order._id);
                    logger.info(`[Scenario:Congestion] ${src.label} → Hub Central dispatched`);
                } catch (e) {
                    logger.error(`Scenario Congestion mission failed: ${e.message}`);
                }
            }, i * 1500);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 4: CRITICAL BATTERY FAILSAFE
    // Long cross-campus diagonal from Main Gate to Hall 9 (~1800m)
    // Drone starts at 35% with 5kg payload → hits 15% mid-flight
    // drone3DService then: diverts to Power Station → charges → resumes to destination
    // ─────────────────────────────────────────────────────────────
    async launchBatteryEmergency() {
        let drone = await Drone.findOne({ status: "idle" }).sort({ payloadCapacity: -1 });
        if (!drone) {
            logger.error("[ScenarioService] No idle drone for battery scenario");
            if (io) io.emit("event_log", { message: "❌ No idle drone available for battery scenario", type: "error" });
            return;
        }

        // 35% battery → enough to launch, exhausted mid-flight on 1800m route
        drone.batteryLevel = 35;
        drone.operatingAltitude = 50;
        await drone.save();

        // Real campus nodes: ~1800m diagonal (far NW to far SE of campus)
        const src = node("GH");   // Guest House (NW)
        const dst = node("H9");   // Hall 9 (SE)

        try {
            const order = await Order.create({
                orderId: `ORD-BATT-${Date.now()}`,
                customerName: `Battery Emergency: ${src.name} → ${dst.name}`,
                pickupLocation: { lat: src.lat, lng: src.lng },
                dropLocation: { lat: dst.lat, lng: dst.lng },
                weight: 5, // max payload → faster ML battery drain
                status: "pending"
            });

            if (io) {
                io.emit("event_log", {
                    message: `⚡ BATTERY TEST: ${drone.droneId} | ${src.name} → ${dst.name} | Battery: 35% | Payload: 5kg | Expect Power Station diversion`,
                    type: "warning"
                });
            }

            await MissionService.createMission(order._id);
            logger.info(`[Scenario:Battery] ${drone.droneId} launched: ${src.name} → ${dst.name} (35% battery, 5kg)`);

        } catch (e) {
            logger.error(`Scenario Battery mission failed: ${e.message}`);
            if (io) {
                io.emit("event_log", { message: `❌ Battery scenario failed: ${e.message}`, type: "error" });
            }
        }
    }
}

export default new ScenarioService();
