import Drone from "../models/Drone.model.js";
import distanceCalculator from "../utils/distanceCalculator.js";
import { io } from "../server.js";

class CollisionService {
    constructor() {
        this.SAFETY_THRESHOLD = 10; 
        this.EMERGENCY_THRESHOLD = 3; 
        this.POLL_INTERVAL = 2000; 
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
}

export default new CollisionService();
