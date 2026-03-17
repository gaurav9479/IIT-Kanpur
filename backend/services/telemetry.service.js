import Telemetry from "../models/Telemetry.model.js";
import Drone from "../models/Drone.model.js";
import { io } from "../server.js";
import safetyService from "./safety.service.js";
import mapService from "./map.service.js";
import gridOccupancyService from "./gridOccupancy.service.js";
import { EMERGENCY_BATTERY_THRESHOLD } from "../config/safety.config.js";

class TelemetryService {
  async recordTelemetry(telemetryData) {

    const telemetry = await Telemetry.create(telemetryData);


    const drone = await Drone.findOneAndUpdate(
      { droneId: telemetryData.droneId },
      {
        location: telemetryData.location,
        batteryLevel: telemetryData.batteryLevel,
      },
      { new: true }
    );

    // Update Grid Occupancy for Conflict Resolution
    const gridPos = mapService.getGridCoords(telemetryData.location.lat, telemetryData.location.lng);
    gridOccupancyService.updateDroneLocation(telemetryData.droneId, gridPos.row, gridPos.col);

    const nfzViolation = safetyService.isInsideNFZ(telemetryData.location);
    const proximityAlerts = await safetyService.checkProximityAlerts(telemetryData.droneId, telemetryData.location);
    
    let emergencyLanding = null;
    if (telemetryData.batteryLevel <= EMERGENCY_BATTERY_THRESHOLD) {
        emergencyLanding = safetyService.findNearestSafeLandingZone(telemetryData.location);
        await Drone.findOneAndUpdate(
            { droneId: telemetryData.droneId },
            { status: "idle" } 
        );
    }

    if (drone) {
      const socketData = {
        droneId: drone.droneId,
        location: drone.location,
        gridPos,
        batteryLevel: drone.batteryLevel,
        altitude: telemetryData.altitude,
        speed: telemetryData.speed,
        safety: {
            nfzViolation,
            proximityAlerts,
            emergencyLanding
        }
      };

      io.emit(`drone_update_${drone.droneId}`, socketData);
      
      io.to("admin_dashboard").emit("telemetry_update", socketData);

      if (nfzViolation || proximityAlerts.length > 0 || emergencyLanding) {
        io.to("admin_dashboard").emit("safety_alert", {
            droneId: drone.droneId,
            nfzViolation,
            proximityAlerts,
            emergencyLanding
        });
      }
    }

    return telemetry;
  }
}

export default new TelemetryService();
