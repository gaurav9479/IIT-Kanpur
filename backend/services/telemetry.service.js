import Telemetry from "../models/Telemetry.model.js";
import Drone from "../models/Drone.model.js";
import { io } from "../server.js";
import safetyService from "./safety.service.js";

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

    // Phase 10: Safety Checks
    const nfzViolation = safetyService.isInsideNFZ(telemetryData.location);
    const proximityAlerts = await safetyService.checkProximityAlerts(telemetryData.droneId, telemetryData.location);

    if (drone) {
      const socketData = {
        droneId: drone.droneId,
        location: drone.location,
        batteryLevel: drone.batteryLevel,
        altitude: telemetryData.altitude,
        speed: telemetryData.speed,
        safety: {
            nfzViolation,
            proximityAlerts
        }
      };

      io.emit(`drone_update_${drone.droneId}`, socketData);
      
      io.to("admin_dashboard").emit("telemetry_update", socketData);

      if (nfzViolation || proximityAlerts.length > 0) {
        io.to("admin_dashboard").emit("safety_alert", {
            droneId: drone.droneId,
            nfzViolation,
            proximityAlerts
        });
      }
    }

    return telemetry;
  }
}

export default new TelemetryService();
