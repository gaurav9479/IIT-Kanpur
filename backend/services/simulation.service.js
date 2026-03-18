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
import distanceCalculator from "../utils/distanceCalculator.js";

class SimulationService {
  CRUISE_SPEED_MPS = 15; // 15 meters per second
  UPDATE_INTERVAL_MS = 1000; // 1 second updates for smoothness

  async startDeliverySimulation(orderId, droneId) {
    console.log(`Starting simulation for Order: ${orderId}, Drone: ${droneId}`);
    
    const order = await Order.findById(orderId);
    const drone = await Drone.findById(droneId);

    if (!order || !drone) return;




    const mission = await Mission.findOne({ order: orderId, drone: droneId, status: "IN_PROGRESS" });
    
    let simulatedSteps = [];
    if (mission && mission.trajectoryData && mission.trajectoryData.length > 1) {
        simulatedSteps = this.generateSmoothPath(mission.trajectoryData, this.CRUISE_SPEED_MPS);
    } else {
        // Fallback to direct interpolation if no complex trajectory
        simulatedSteps = this.generateSmoothPath([
            { ...order.pickupLocation, z: 0 },
            { ...order.dropLocation, z: 0 }
        ], this.CRUISE_SPEED_MPS);
    }

    const steps = simulatedSteps;
    let stepIndex = 0;
    const interval = setInterval(async () => {
      if (stepIndex >= steps.length) {
        clearInterval(interval);
        
        // Release resources dynamically from mission data
        await navigationService.releaseMission(mission.lane, mission.slotIndex, drone.droneId);
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

      const batteryDrain = (mission?.estimatedBatteryUsage || 10) / steps.length;
      const newBatteryLevel = Math.max(0, drone.batteryLevel - batteryDrain);

      // FIX Task 8a: persist new battery level so next tick has correct baseline
      drone.batteryLevel = newBatteryLevel;

      // FEATURE 1: Ground Drone at 15% Battery
      if (newBatteryLevel < 15) {
          clearInterval(interval);
          
          await Drone.findByIdAndUpdate(droneId, { 
            status: "grounded",
            batteryLevel: newBatteryLevel
          });
          
          await Order.findByIdAndUpdate(orderId, { 
            status: "failed" 
          });
          
          if (mission) {
              await Mission.findOneAndUpdate(
                { order: orderId, drone: droneId },
                { status: "ABORTED" }
              );
              // Release airspace
              await navigationService.releaseMission(
                mission.lane || "LANE-001", mission.slotIndex || 0, drone.droneId
              );
          }
          
          io.emit("event_log", {
            message: `GROUNDED: Drone ${drone.droneId} battery at ${newBatteryLevel.toFixed(1)}% — removed from service`,
            type: "error"
          });
          
          io.to("admin_dashboard").emit("safety_alert", {
            droneId: drone.droneId,
            nfzViolation: false,
            proximityAlerts: [],
            emergencyLanding: null,
            grounded: true,
            reason: "BATTERY_CRITICAL",
            battery: newBatteryLevel
          });
          
          return;
      }

      // FIX Task 8b: emit critical battery alert when below 20%
      if (newBatteryLevel < 20) {
        io.emit("event_log", {
          message: `ALERT: Drone ${drone.droneId} battery critical at ${newBatteryLevel.toFixed(1)}%`,
          type: "warning"
        });
      }

      await Order.findByIdAndUpdate(orderId, { status: currentStep.status });

      // FIX: round lat/lng to 6 decimals for smooth map animation
      const roundedLocation = {
        lat: parseFloat((currentStep.location.lat).toFixed(6)),
        lng: parseFloat((currentStep.location.lng).toFixed(6)),
      };

      await telemetryService.recordTelemetry({
        droneId: drone.droneId,
        location: roundedLocation,
        altitude: currentStep.altitude || mission?.altitude || 50,
        speed: 15,
        batteryLevel: newBatteryLevel,
        timestamp: new Date()
      });

      console.log(`Simulation Step [${currentStep.status}]: ${currentStep.msg} (${stepIndex}/${steps.length})`);
      stepIndex++;
    }, this.UPDATE_INTERVAL_MS); 
  }

  /**
   * Generates a high-granularity path by interpolating between sparse graph nodes
   * based on a desired cruise speed.
   */
  generateSmoothPath(waypoints, speedMps) {
    const smoothSteps = [];
    
    for (let i = 0; i < waypoints.length - 1; i++) {
        const start = waypoints[i];
        const end = waypoints[i + 1];
        
        const dist = distanceCalculator.calculate2DDistance(start, end);
        const durationSec = dist / speedMps;
        const numIntervals = Math.max(1, Math.floor(durationSec)); // At least 1 step per segment

        for (let j = 0; j < numIntervals; j++) {
            const factor = j / numIntervals;
            smoothSteps.push({
                status: i === 0 && j === 0 ? "picked" : "in-flight",
                location: {
                    lat: start.lat + (end.lat - start.lat) * factor,
                    lng: start.lng + (end.lng - start.lng) * factor
                },
                altitude: start.z + ( (end.z || start.z) - start.z ) * factor,
                msg: `Cruising at ${speedMps}m/s`
            });
        }
    }
    
    // Ensure final destination is added
    const last = waypoints[waypoints.length - 1];
    smoothSteps.push({
        status: "delivered",
        location: { lat: last.lat, lng: last.lng },
        altitude: last.z || 0,
        msg: "Landing safe"
    });
    
    return smoothSteps;
  }


  interpolate(start, end, factor) {
    return {
      lat: start.lat + (end.lat - start.lat) * factor,
      lng: start.lng + (end.lng - start.lng) * factor
    };
  }
}

export default new SimulationService();
