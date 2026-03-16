import { NO_FLY_ZONES, COLLISION_THRESHOLD, SAFE_LANDING_ZONES } from "../config/safety.config.js";
import Drone from "../models/Drone.model.js";

class SafetyService {

    getDistance(coord1, coord2) {
        const R = 6371e3;
        const φ1 = (coord1.lat * Math.PI) / 180;
        const φ2 = (coord2.lat * Math.PI) / 180;
        const Δφ = ((coord2.lat - coord1.lat) * Math.PI) / 180;
        const Δλ = ((coord2.lng - coord1.lng) * Math.PI) / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }


    isInsideNFZ(location) {
        for (const zone of NO_FLY_ZONES) {
            const distance = this.getDistance(location, zone.center);
            if (distance <= zone.radius) {
                return zone.name;
            }
        }
        return null;
    }


    async checkProximityAlerts(currentDroneId, location) {
        const activeDrones = await Drone.find({
            droneId: { $ne: currentDroneId },
            status: "delivering"
        });

        const alerts = [];
        for (const otherDrone of activeDrones) {
            const distance = this.getDistance(location, otherDrone.location);
            if (distance <= COLLISION_THRESHOLD) {
                alerts.push({
                    targetDroneId: otherDrone.droneId,
                    distance: distance.toFixed(2),
                    message: `Proximity Alert: Drone ${otherDrone.droneId} is within ${distance.toFixed(2)}m`
                });
            }
        }
        return alerts;
    }


    findNearestSafeLandingZone(currentLocation) {
        let nearestZone = null;
        let minDistance = Infinity;

        for (const zone of SAFE_LANDING_ZONES) {
            const distance = this.getDistance(currentLocation, zone);
            if (distance < minDistance) {
                minDistance = distance;
                nearestZone = zone;
            }
        }
        return nearestZone;
    }
}

export default new SafetyService();
