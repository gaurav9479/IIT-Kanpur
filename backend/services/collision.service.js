import Drone from "../models/Drone.model.js";
import distanceCalculator from "../utils/distanceCalculator.js";
import { io } from "../server.js";
import logger from "../utils/logger.js";
import {
    COLLISION_THRESHOLD,
    VERTICAL_BUFFER_M,
    EMERGENCY_BATTERY_THRESHOLD,
    EMERGENCY_HOVER_DURATION_S,
    LOST_LINK_TIMEOUT_S,
    ALTITUDE_LANES,
} from "../config/safety.config.js";

// ─────────────────────────────────────────────
// TAKEOFF & LANDING QUEUES (always separate)
// ─────────────────────────────────────────────
const takeoffQueue = [];
const landingQueue = [];

class CollisionService {
    constructor() {
        this.SAFETY_THRESHOLD = COLLISION_THRESHOLD; // config se (10m)
        this.EMERGENCY_THRESHOLD = 3;
        this.POLL_INTERVAL = 2000;
    }

    // ─────────────────────────────────────────────
    // MONITORING (original + telemetry check added)
    // ─────────────────────────────────────────────
    async startMonitoring() {
        setInterval(async () => {
            await this.checkAllDrones();
            await this.checkTelemetryTimeouts();
        }, this.POLL_INTERVAL);
        console.log("Collision Monitoring Started (2s interval)");
    }

    async checkAllDrones() {
        try {
            const activeDrones = await Drone.find({
                status: { $in: ["delivering", "avoidance"] },
            });

            if (activeDrones.length < 2) return;

            for (let i = 0; i < activeDrones.length; i++) {
                for (let j = i + 1; j < activeDrones.length; j++) {
                    const droneA = activeDrones[i];
                    const droneB = activeDrones[j];

                    const distance = distanceCalculator.calculate3DDistance(
                        { lat: droneA.location.lat, lng: droneA.location.lng, altitude: droneA.altitude || 50 },
                        { lat: droneB.location.lat, lng: droneB.location.lng, altitude: droneB.altitude || 50 }
                    );

                    if (distance < this.SAFETY_THRESHOLD) {
                        await this.handlePotentialCollision(droneA, droneB, distance);
                    }
                }
            }
        } catch (error) {
            console.error("Collision Check Error:", error.message);
        }
    }

    // ─────────────────────────────────────────────
    // COLLISION HANDLER (original + vertical fix)
    // ─────────────────────────────────────────────
    async handlePotentialCollision(droneA, droneB, distance) {
        let action = "hold_position";
        let type = "collision_warning";

        if (distance < this.EMERGENCY_THRESHOLD) {
            action = "emergency_landing";
            type = "collision_critical";
        } else {
            const verticalDist = Math.abs(
                (droneA.altitude || 50) - (droneB.altitude || 50)
            );

            if (verticalDist < VERTICAL_BUFFER_M) {
                // Vertical resolution
                const resolution = await this.resolveVerticalConflict(droneA, droneB);
                action = resolution.action;
            } else {
                action = droneA.droneId > droneB.droneId ? "increase_altitude" : "slow_down";
            }
        }

        await Drone.updateMany(
            { droneId: { $in: [droneA.droneId, droneB.droneId] } },
            { status: "avoidance" }
        );

        const alertPayload = {
            type,
            droneA: droneA.droneId,
            droneB: droneB.droneId,
            distance: distance.toFixed(2),
            action,
            timestamp: new Date(),
        };

        io.to("admin_dashboard").emit("collision_alert", alertPayload);
        io.emit(`drone_alert_${droneA.droneId}`, alertPayload);
        io.emit(`drone_alert_${droneB.droneId}`, alertPayload);

        console.warn(`ALERT: ${type} between ${droneA.droneId} and ${droneB.droneId}! Action: ${action}`);
    }

    // ─────────────────────────────────────────────
    // VERTICAL CONFLICT RESOLUTION
    // Higher drone climbs to next altitude lane
    // ─────────────────────────────────────────────
    async resolveVerticalConflict(droneA, droneB) {
        const altA = droneA.altitude || 50;
        const altB = droneB.altitude || 50;

        const [climber, holder] = altA >= altB
            ? [droneA, droneB]
            : [droneB, droneA];

        const nextLane = ALTITUDE_LANES.find(
            (lane) => lane.altitude > climber.altitude + VERTICAL_BUFFER_M
        );

        if (!nextLane) {
            logger.warn(`[COLLISION] No higher lane for ${climber.droneId} — hovering`);
            await this.triggerHover(climber.droneId, "NO_HIGHER_LANE");
            return { action: "hover", climber: climber.droneId };
        }

        await Drone.updateOne(
            { droneId: climber.droneId },
            { altitude: nextLane.altitude }
        );

        io.to("admin_dashboard").emit("altitude_switch", {
            droneId: climber.droneId,
            newAltitude: nextLane.altitude,
            laneId: nextLane.id,
            timestamp: new Date(),
        });

        logger.info(
            `[COLLISION] Vertical fix: ${climber.droneId} → ${nextLane.altitude}m | ${holder.droneId} holds`
        );

        return {
            action: "altitude_switch",
            climber: climber.droneId,
            newAltitude: nextLane.altitude,
            holder: holder.droneId,
        };
    }

    // ─────────────────────────────────────────────
    // TAKEOFF QUEUE
    // ─────────────────────────────────────────────
    requestTakeoff(droneId, hubId) {
        const hubBusy = takeoffQueue.some((d) => d.hubId === hubId);
        takeoffQueue.push({ droneId, hubId, requestedAt: Date.now() });

        if (hubBusy) {
            logger.info(`[TAKEOFF] Drone ${droneId} queued at hub ${hubId}`);
            io.to("admin_dashboard").emit("takeoff_queued", { droneId, hubId });
            return { status: "QUEUED", position: takeoffQueue.length };
        }

        logger.info(`[TAKEOFF] Drone ${droneId} cleared for takeoff at ${hubId}`);
        return { status: "CLEARED" };
    }

    completeTakeoff(droneId) {
        const idx = takeoffQueue.findIndex((d) => d.droneId === droneId);
        if (idx !== -1) takeoffQueue.splice(idx, 1);
        logger.info(`[TAKEOFF] Drone ${droneId} airborne`);
    }

    // ─────────────────────────────────────────────
    // LANDING QUEUE
    // ─────────────────────────────────────────────
    requestLanding(droneId, hubId, isEmergency = false) {
        const zoneBusy = landingQueue.some((d) => d.hubId === hubId);
        const entry = { droneId, hubId, requestedAt: Date.now(), isEmergency };
        
        if (isEmergency) {
            landingQueue.unshift(entry);
            logger.warn(`[EMERGENCY] Priority landing cleared for Drone ${droneId} at ${hubId}`);
            return { status: "CLEARED_PRIORITY" };
        }

        landingQueue.push(entry);

        if (zoneBusy) {
            logger.info(`[LANDING] Drone ${droneId} in holding pattern at ${hubId}`);
            io.to("admin_dashboard").emit("landing_holding", { droneId, hubId });
            return { status: "HOLDING", position: landingQueue.length };
        }

        logger.info(`[LANDING] Drone ${droneId} cleared for landing at ${hubId}`);
        return { status: "CLEARED" };
    }

    async completeLanding(droneId) {
        const idx = landingQueue.findIndex((d) => d.droneId === droneId);
        if (idx !== -1) landingQueue.splice(idx, 1);
        await Drone.updateOne({ droneId }, { status: "idle", altitude: 0 });
        logger.info(`[LANDING] Drone ${droneId} landed`);
    }

    // ─────────────────────────────────────────────
    // EMERGENCY PROTOCOLS
    // ─────────────────────────────────────────────
    async triggerHover(droneId, reason = "MANUAL") {
        await Drone.updateOne({ droneId }, { status: "hovering" });

        const payload = {
            droneId,
            action: "HOVER",
            reason,
            triggeredAt: new Date(),
        };

        io.to("admin_dashboard").emit("drone_hover", payload);
        io.emit(`drone_alert_${droneId}`, payload);
        logger.warn(`[HOVER] Drone ${droneId} hovering — reason: ${reason}`);
        return payload;
    }

    async handleLostLink(droneId) {
        await Drone.updateOne({ droneId }, { status: "emergency_hover" });

        const payload = {
            droneId,
            action: "HOVER_THEN_RTH",
            hoverDuration: EMERGENCY_HOVER_DURATION_S,
            triggeredAt: new Date(),
        };

        io.to("admin_dashboard").emit("collision_alert", {
            type: "lost_link", ...payload,
        });

        logger.error(`[EMERGENCY] Lost link: ${droneId} — hover ${EMERGENCY_HOVER_DURATION_S}s then RTH`);
        return payload;
    }

    async handleLowBattery(droneId, battery, nearestHub) {
        if (battery > EMERGENCY_BATTERY_THRESHOLD) return null;

        await Drone.updateOne({ droneId }, { status: "emergency_landing" });

        // Use unified requestLanding with emergency flag
        this.requestLanding(droneId, nearestHub, true);

        const payload = {
            droneId,
            action: "PRIORITY_LANDING",
            battery,
            hubId: nearestHub,
            triggeredAt: new Date(),
        };

        io.to("admin_dashboard").emit("collision_alert", {
            type: "low_battery_emergency", ...payload,
        });

        logger.error(`[EMERGENCY] Low battery: ${droneId} at ${battery}% — priority landing`);
        return payload;
    }

    // ─────────────────────────────────────────────
    // TELEMETRY TIMEOUT CHECK (every tick)
    // ─────────────────────────────────────────────
    async checkTelemetryTimeouts() {
        try {
            const cutoff = new Date(Date.now() - LOST_LINK_TIMEOUT_S * 1000);

            const timedOut = await Drone.find({
                status: { $in: ["delivering", "avoidance"] },
                lastTelemetry: { $lt: cutoff },
            });

            for (const drone of timedOut) {
                await this.handleLostLink(drone.droneId);
            }
        } catch (err) {
            logger.error(`[TELEMETRY] Timeout check failed: ${err.message}`);
        }
    }

    // ─────────────────────────────────────────────
    // UTIL: Snapshots for dashboard (Member 4)
    // ─────────────────────────────────────────────
    getTakeoffQueue() { return [...takeoffQueue]; }
    getLandingQueue() { return [...landingQueue]; }
}

export default new CollisionService();