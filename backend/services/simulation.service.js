import Drone from "../models/Drone.model.js";
import Order from "../models/Order.model.js";
import telemetryService from "./telemetry.service.js";
import MissionHistory from "../models/MissionHistory.model.js";
import aiService from "./ai.service.js";
import collisionService from "./collision.service.js";
import missionService from "./mission.service.js";
import { io } from "../server.js";

class SimulationService {

  async startDeliverySimulation(orderId, droneId) {
    console.log(`Starting simulation for Order: ${orderId}, Drone: ${droneId}`);

    const order = await Order.findById(orderId);
    const drone = await Drone.findById(droneId);

    if (!order || !drone) return;

    // ─── Step 1: Altitude Lane Assign ──────────────────────
    const currentTime = Math.floor(Date.now() / 1000);
    const congestionScores = await aiService.getCongestionScores().catch(() => ({}));
    const laneAssignment = missionService.assignAltitudeLane(drone.droneId, currentTime, congestionScores);

    if (!laneAssignment) {
      console.warn(`No altitude lane available for drone ${drone.droneId} — aborting`);
      return;
    }

    const assignedAltitude = laneAssignment.lane;
    console.log(`Drone ${drone.droneId} assigned altitude lane: ${assignedAltitude}m, slot: ${laneAssignment.slot}`);

    // ─── Step 2: Takeoff Queue ──────────────────────────────
    const hubId = order.pickupLocation?.hubId || "default_hub";
    missionService.addToTakeoffQueue(hubId, drone.droneId);

    // Wait until this drone is first in takeoff queue
    await this.waitForTakeoff(hubId, drone.droneId);
    missionService.processNextTakeoff(hubId);
    console.log(`Drone ${drone.droneId} cleared for takeoff from hub: ${hubId}`);

    // ─── Step 3: Simulation Steps ──────────────────────────
    const steps = [
      { status: "picked",     location: order.pickupLocation, msg: "Drone picked up the package" },
      { status: "in-flight",  location: this.interpolate(order.pickupLocation, order.dropLocation, 0.5), msg: "Drone is in-flight" },
      { status: "delivered",  location: order.dropLocation,   msg: "Drone delivered the package" }
    ];

    let stepIndex = 0;
    let currentBattery = drone.batteryLevel;

    const interval = setInterval(async () => {

      // ─── Emergency check har tick pe ─────────────────────
      const freshDrone = await Drone.findById(droneId);
      const emergency = await collisionService.handleEmergency(freshDrone);
      if (emergency?.action === "emergency_landing") {
        clearInterval(interval);
        missionService.releaseAltitudeLane(drone.droneId);
        console.warn(`Simulation aborted for ${drone.droneId}: emergency landing`);
        return;
      }

      if (stepIndex >= steps.length) {
        clearInterval(interval);

        // ─── Landing Queue ──────────────────────────────────
        const destHubId = order.dropLocation?.hubId || "default_hub";
        missionService.addToLandingQueue(destHubId, drone.droneId);
        await this.waitForLanding(destHubId, drone.droneId);
        missionService.processNextLanding(destHubId);
        console.log(`Drone ${drone.droneId} cleared for landing at hub: ${destHubId}`);

        // ─── Release lane ───────────────────────────────────
        missionService.releaseAltitudeLane(drone.droneId);

        // ─── Mission history save ───────────────────────────
        await MissionHistory.create({
          missionId: `HIST-${Date.now()}`,
          order: order._id,
          drone: drone._id,
          duration: steps.length * 5,
          totalBatteryUsed: drone.batteryLevel - currentBattery,
          finalStatus: "delivered"
        });

        await Drone.findByIdAndUpdate(droneId, { status: "idle" });

        // ─── Dashboard notify ───────────────────────────────
        io.to("admin_dashboard").emit("mission_complete", {
          droneId: drone.droneId,
          orderId,
          timestamp: new Date()
        });

        console.log(`Simulation completed for Order: ${orderId}`);
        return;
      }

      const currentStep = steps[stepIndex];

      // ─── Battery drain ──────────────────────────────────
      const batteryDrain = await aiService.predictBatteryDrain({
        distance: 100,
        payloadWeight: order.weight,
        droneSpeed: 15,
        altitude: assignedAltitude
      });

      currentBattery = Math.max(0, currentBattery - batteryDrain);

      // ─── DB updates ─────────────────────────────────────
      await Order.findByIdAndUpdate(orderId, { status: currentStep.status });

      await telemetryService.recordTelemetry({
        droneId: drone.droneId,
        location: currentStep.location,
        altitude: assignedAltitude,   // ← assigned lane altitude use ho raha hai
        speed: 15,
        batteryLevel: currentBattery,
        timestamp: new Date()
      });

      // ─── Dashboard live update ───────────────────────────
      io.to("admin_dashboard").emit("drone_position_update", {
        droneId: drone.droneId,
        location: currentStep.location,
        altitude: assignedAltitude,
        battery: currentBattery,
        status: currentStep.status,
        timestamp: new Date()
      });

      console.log(`Simulation Step [${currentStep.status}]: ${currentStep.msg} | Battery: ${currentBattery.toFixed(1)}%`);
      stepIndex++;

    }, 5000);
  }

  // ─── Wait for takeoff clearance ─────────────────────────
  waitForTakeoff(hubId, droneId) {
    return new Promise((resolve) => {
      const check = setInterval(() => {
        const queue = missionService.getTakeoffQueueStatus(hubId);
        if (queue[0] === droneId) {
          clearInterval(check);
          resolve();
        }
      }, 1000);
    });
  }

  // ─── Wait for landing clearance ─────────────────────────
  waitForLanding(hubId, droneId) {
    return new Promise((resolve) => {
      const check = setInterval(() => {
        const shouldHold = missionService.shouldHold(droneId, hubId);
        if (!shouldHold) {
          clearInterval(check);
          resolve();
        }
      }, 1000);
    });
  }

  // ─── Interpolate mid-point ──────────────────────────────
  interpolate(start, end, factor) {
    return {
      lat: start.lat + (end.lat - start.lat) * factor,
      lng: start.lng + (end.lng - start.lng) * factor
    };
  }
}

export default new SimulationService();