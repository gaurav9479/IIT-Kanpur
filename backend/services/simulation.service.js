import Drone from "../models/Drone.model.js";
import Order from "../models/Order.model.js";
import telemetryService from "./telemetry.service.js";
import MissionHistory from "../models/MissionHistory.model.js";
import aiService from "./ai.service.js";
import { io } from "../server.js";
import Mission from "../models/Mission.model.js";
import logger from "../utils/logger.js";

import navigationService from "./navigation.service.js";
import collisionService from "./collision.service.js";

class SimulationService {

  async startDeliverySimulation(orderId, droneId) {
    console.log(`Starting simulation for Order: ${orderId}, Drone: ${droneId}`);
    
    const order = await Order.findById(orderId);
    const drone = await Drone.findById(droneId);

    if (!order || !drone) return;


    let steps = [
      { status: "picked", location: order.pickupLocation, msg: "Drone picked up the package" },
      { status: "in-flight", location: this.interpolate(order.pickupLocation, order.dropLocation, 0.5), msg: "Drone is in-flight" },
      { status: "delivered", location: order.dropLocation, msg: "Drone delivered the package" }
    ];

    const mission = await Mission.findOne({ order: orderId, drone: droneId, status: "IN_PROGRESS" });
    if (mission && mission.trajectoryData && mission.trajectoryData.length > 0) {
        steps = mission.trajectoryData.map(point => ({
            status: "in-flight",
            location: { lat: point.lat, lng: point.lng },
            altitude: point.z || 50,
            msg: "Tracing 3D Path"
        }));
        steps[steps.length - 1].status = "delivered";
    }

    let stepIndex = 0;
    const interval = setInterval(async () => {
      if (stepIndex >= steps.length) {
        clearInterval(interval);
        
        // Release resources
        await navigationService.releaseMission("LANE-001", 0, drone.droneId);
        await collisionService.requestLanding(drone.droneId, order.hubId || "HUB-01");

        await MissionHistory.create({
          missionId: `HIST-${Date.now()}`,
          order: order._id,
          drone: drone._id,
          duration: steps.length * 5, 
          totalBatteryUsed: (steps.length) * 2, 
          finalStatus: "delivered"
        });

        await Drone.findByIdAndUpdate(droneId, { status: "idle" });
        await Order.findByIdAndUpdate(orderId, { status: "delivered" });

        console.log(`Simulation completed for Order: ${orderId}`);
        return;
      }

      const currentStep = steps[stepIndex];
      
      // --- FAILURE SIMULATION LOGIC ---
      const failureRoll = Math.random();
      const isFailureLevel = process.env.SIM_FAILURE === "true"; // Control via Env var for testing
      
      if (isFailureLevel && failureRoll < 0.05) { // 5% chance of failure per step
          const failureType = failureRoll < 0.015 ? "CRASH" : (failureRoll < 0.03 ? "BATTERY_FAIL" : "SIGNAL_LOSS");
          
          if (failureType === "CRASH") {
              clearInterval(interval);
              logger.error(`CRITICAL: Drone ${drone.droneId} suffered catastrophic hardware failure (CRASH)!`);
              io.emit("event_log", { message: `CRITICAL: Drone ${drone.droneId} CRASHED mid-flight!`, type: "error" });
              
              await Drone.findByIdAndUpdate(droneId, { status: "maintenance", batteryLevel: 0 });
              await Order.findByIdAndUpdate(orderId, { status: "failed" });
              await Mission.findOneAndUpdate({ order: orderId, drone: droneId }, { status: "FAILED" });
              
              // Trigger Auto-Reassignment logic after 5s "System Analysis"
              setTimeout(async () => {
                  const missionService = (await import("./mission.service.js")).default;
                  await missionService.reassignMission(orderId, drone.droneId);
              }, 5000);
              
              return; 
          } else if (failureType === "BATTERY_FAIL") {
              logger.warn(`ALERT: Drone ${drone.droneId} reporting rapid battery thermal runaway!`);
              io.emit("event_log", { message: `ALERT: Drone ${drone.droneId} Battery Critical Failure! Emergency Landing initiated.`, type: "error" });
              // Force battery to critical, safety.service will handle landing in next recordTelemetry
              await Drone.findByIdAndUpdate(droneId, { batteryLevel: 2 }); 
          } else if (failureType === "SIGNAL_LOSS") {
              logger.warn(`WARNING: Signal degradation for Drone ${drone.droneId}. Skipping telemetry update.`);
              io.emit("event_log", { message: `WARNING: Signal Loss for ${drone.droneId}. Attempting reconnection...`, type: "warning" });
              stepIndex++;
              return; // Skip this telemetry update
          }
      }
      // ---------------------------------

      const batteryDrain = await aiService.predictBatteryDrain({
        distance: (mission?.totalDistance || 100) / steps.length, 
        payloadWeight: order.weight,
        droneSpeed: 15,
        altitude: currentStep.altitude || 50
      });
      
      const newBatteryLevel = Math.max(0, drone.batteryLevel - batteryDrain);

      await Order.findByIdAndUpdate(orderId, { status: currentStep.status });

      await telemetryService.recordTelemetry({
        droneId: drone.droneId,
        location: currentStep.location,
        altitude: currentStep.altitude || 50,
        speed: 15,
        batteryLevel: newBatteryLevel,
        timestamp: new Date()
      });

      console.log(`Simulation Step [${currentStep.status}]: ${currentStep.msg}`);
      stepIndex++;
    }, 5000); 
  }


  interpolate(start, end, factor) {
    return {
      lat: start.lat + (end.lat - start.lat) * factor,
      lng: start.lng + (end.lng - start.lng) * factor
    };
  }
}

export default new SimulationService();
