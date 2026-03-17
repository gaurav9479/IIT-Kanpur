import Drone from "../models/Drone.model.js";
import distanceCalculator from "../utils/distanceCalculator.js";
import { io } from "../server.js";

class CollisionService {
    constructor() {
        this.SAFETY_THRESHOLD = 10;
        this.EMERGENCY_THRESHOLD = 3;
        this.POLL_INTERVAL = 2000;
        this.VERTICAL_BUFFER = 10;
        this.BATTERY_EMERGENCY = 5;
        this.BATTERY_LOW = 15;
    }

    async startMonitoring() {
        setInterval(async () => {
            await this.checkAllDrones();
        }, this.POLL_INTERVAL);
        console.log("Collision Monitoring Started (2s interval)");
    }

    async checkAllDrones() {
        try {
            const activeDrones = await Drone.find({ status: { $in: ["delivering", "avoidance"] } });

            if (activeDrones.length < 2) return;

            // ─── Pair-wise collision check ───────────────────────
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

                    // ─── Vertical conflict check ─────────────────
                    if (this.hasVerticalConflict(droneA.altitude || 50, droneB.altitude || 50)) {
                        io.to("admin_dashboard").emit("collision_alert", {
                            type: "vertical_conflict",
                            droneA: droneA.droneId,
                            droneB: droneB.droneId,
                            altA: droneA.altitude || 50,
                            altB: droneB.altitude || 50,
                            message: `Vertical conflict: ${droneA.droneId} & ${droneB.droneId}`,
                            timestamp: new Date()
                        });
                    }
                }
            }

            // ─── Battery emergency check for each drone ──────────
            for (const drone of activeDrones) {
                await this.handleEmergency(drone);
            }

        } catch (error) {
            console.error("Collision Check Error:", error.message);
        }
    }

    async handlePotentialCollision(droneA, droneB, distance) {
        let action = "hold_position";
        let type = "collision_warning";

        if (distance < this.EMERGENCY_THRESHOLD) {
            action = "emergency_landing";
            type = "collision_critical";
        } else {
            action = droneA.droneId > droneB.droneId ? "increase_altitude" : "slow_down";
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
            timestamp: new Date()
        };

        io.to("admin_dashboard").emit("collision_alert", alertPayload);
        io.emit(`drone_alert_${droneA.droneId}`, alertPayload);
        io.emit(`drone_alert_${droneB.droneId}`, alertPayload);

        console.warn(`ALERT: ${type} between ${droneA.droneId} and ${droneB.droneId}! Action: ${action}`);
    }

    // ─── Vertical Conflict Check ──────────────────────────────
    hasVerticalConflict(altA, altB) {
        return Math.abs(altA - altB) < this.VERTICAL_BUFFER;
    }

    // ─── Emergency Protocol ───────────────────────────────────
    async handleEmergency(drone) {
        // Case 1: Battery critical → emergency landing
        if (drone.batteryLevel <= this.BATTERY_EMERGENCY) {
            await Drone.findOneAndUpdate(
                { droneId: drone.droneId },
                { status: "charging" }
            );

            const payload = {
                type: "emergency_landing",
                droneId: drone.droneId,
                reason: "critical_battery",
                batteryLevel: drone.batteryLevel,
                timestamp: new Date()
            };

            io.to("admin_dashboard").emit("collision_alert", payload);
            io.emit(`drone_alert_${drone.droneId}`, payload);

            console.warn(`EMERGENCY: ${drone.droneId} battery critical (${drone.batteryLevel}%) → emergency landing`);
            return { action: "emergency_landing", droneId: drone.droneId };
        }

        // Case 2: Battery low → holding pattern
        if (drone.batteryLevel <= this.BATTERY_LOW) {
            const payload = {
                type: "holding_pattern",
                droneId: drone.droneId,
                reason: "low_battery",
                batteryLevel: drone.batteryLevel,
                timestamp: new Date()
            };

            io.to("admin_dashboard").emit("collision_alert", payload);
            io.emit(`drone_alert_${drone.droneId}`, payload);

            console.warn(`WARNING: ${drone.droneId} battery low (${drone.batteryLevel}%) → holding pattern`);
            return { action: "holding_pattern", droneId: drone.droneId };
        }

        return null; // No emergency
    }

    // ─── Lost Link Protocol ───────────────────────────────────
    async handleLostLink(drone) {
        await Drone.findOneAndUpdate(
            { droneId: drone.droneId },
            { status: "idle" }
        );

        const payload = {
            type: "lost_link",
            droneId: drone.droneId,
            action: "return_to_hub",
            timestamp: new Date()
        };

        io.to("admin_dashboard").emit("collision_alert", payload);
        io.emit(`drone_alert_${drone.droneId}`, payload);

        console.warn(`LOST LINK: ${drone.droneId} → returning to hub`);
        return { action: "return_to_hub", droneId: drone.droneId };
    }
}

export default new CollisionService();