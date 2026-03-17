import asyncHandler from "../utils/AsyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import Drone from "../models/Drone.model.js";
import Mission from "../models/Mission.model.js";
import Order from "../models/Order.model.js";
import aiService from "../services/ai.service.js";
import missionService from "../services/mission.service.js";
import simulationService from "../services/simulation.service.js";

const AI_MODULE_URL = process.env.AI_MODULE_URL || "http://localhost:5001";
const NAV_MODULE_URL = process.env.NAV_MODULE_URL || "http://localhost:5002";

// ─── Dispatch Mission ─────────────────────────────────────
const dispatchMission = asyncHandler(async (req, res) => {
  const { orderId } = req.body;

  if (!orderId) {
    throw new ApiError(400, "Order ID is required");
  }

  const order = await Order.findById(orderId);
  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  const { pickupNode, dropoffNode, weight } = order;

  if (!pickupNode || !dropoffNode) {
    throw new ApiError(400, "Order is missing pickup or dropoff nodes");
  }

  const drone = await Drone.findOne({
    status: "idle",
    payloadCapacity: { $gte: weight }
  });

  if (!drone) {
    throw new ApiError(404, "No suitable idle drone found for this mission weight");
  }

  // ─── Phase 1: Battery prediction ─────────────────────────
  let batteryUsagePrediction;
  try {
    const distance = 100;
    batteryUsagePrediction = await aiService.predictETA({
      distance,
      droneSpeed: 15,
      congestionLevel: "low",
      payloadWeight: weight
    });
  } catch (error) {
    console.error("AI Service (predictETA) Error:", error.message);
    throw new ApiError(502, "AI Service (Battery Prediction) is unreachable or failed");
  }

  const safetyBuffer = 0.15;
  const totalRequiredBattery = batteryUsagePrediction * (1 + safetyBuffer);

  if (drone.batteryLevel < totalRequiredBattery) {
    throw new ApiError(400, `Insufficient battery: Required ${totalRequiredBattery.toFixed(2)}% (with buffer), Available ${drone.batteryLevel}%`);
  }

  // ─── Phase 2: A* Path Planning (missionService) ───────────
  let trajectory;
  try {
    const graph = await aiService.getGraph().catch(() => null);

    if (graph) {
      // missionService ka A* use karo
      trajectory = missionService.astar(graph, pickupNode, dropoffNode);
      if (!trajectory) {
        throw new Error("A* returned no path");
      }
      console.log(`A* path found: ${trajectory.length} waypoints`);
    } else {
      // Fallback: NAV module
      const activeMissions = await Mission.find({ status: "IN_PROGRESS" });
      const active_trajectories = activeMissions.map(m => m.trajectoryData).filter(Boolean);

      const navResponse = await axios.post(`${NAV_MODULE_URL}/get-route`, {
        startNode: drone.currentLocationNode,
        pickupNode,
        dropoffNode,
        active_trajectories
      });
      trajectory = navResponse.data.route;
    }
  } catch (error) {
    console.error("Path Planning Error:", error.message);
    throw new ApiError(502, "Path planning failed — check graph or navigation module");
  }

  // ─── Phase 3: Altitude Lane Assignment ───────────────────
  const currentTime = Math.floor(Date.now() / 1000);
  const congestionScores = await aiService.getCongestionScores().catch(() => ({}));
  const laneAssignment = missionService.assignAltitudeLane(drone.droneId, currentTime, congestionScores);

  if (!laneAssignment) {
    throw new ApiError(503, "No altitude lane available — all lanes congested. Try again shortly.");
  }

  console.log(`Drone ${drone.droneId} → Lane: ${laneAssignment.lane}m, Slot: ${laneAssignment.slot}`);

  // ─── Phase 4: Takeoff Queue ───────────────────────────────
  const hubId = order.pickupLocation?.hubId || "default_hub";
  missionService.addToTakeoffQueue(hubId, drone.droneId);

  // ─── Phase 5: Mission create in DB ───────────────────────
  const mission = await Mission.create({
    missionId: `MSN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    order: order._id,
    drone: drone._id,
    pickupNode,
    dropoffNode,
    status: "IN_PROGRESS",
    estimatedBatteryUsage: batteryUsagePrediction,
    trajectoryData: trajectory,
    altitudeLane: laneAssignment.lane,
    timeSlot: laneAssignment.slot
  });

  // ─── Phase 6: Drone & Order status update ────────────────
  drone.status = "delivering";
  await drone.save();

  order.status = "assigned";
  order.assignedDrone = drone._id;
  await order.save();

  // ─── Phase 7: Start simulation ────────────────────────────
  simulationService.startDeliverySimulation(order._id, drone._id);

  return res.status(201).json(
    new ApiResponse(201, {
      mission,
      altitudeLane: laneAssignment.lane,
      timeSlot: laneAssignment.slot,
      takeoffQueuePosition: missionService.getTakeoffQueueStatus(hubId).indexOf(drone.droneId) + 1
    }, "Mission dispatched successfully")
  );
});

// ─── Get Mission Status ───────────────────────────────────
const getMissionStatus = asyncHandler(async (req, res) => {
  const { droneId } = req.params;

  if (!droneId) {
    throw new ApiError(400, "Drone ID is required");
  }

  const assignment = missionService.getDroneAssignment(droneId);
  const mission = await Mission.findOne({ status: "IN_PROGRESS" })
    .populate("order")
    .populate("drone");

  return res.status(200).json(
    new ApiResponse(200, {
      assignment,   // lane + slot info
      mission
    }, "Mission status fetched")
  );
});

// ─── Land Drone ───────────────────────────────────────────
const landDrone = asyncHandler(async (req, res) => {
  const { droneId, hubId } = req.body;

  if (!droneId || !hubId) {
    throw new ApiError(400, "droneId and hubId are required");
  }

  // Landing queue mein daalo
  missionService.addToLandingQueue(hubId, droneId);

  const queuePosition = missionService.getLandingQueueStatus(hubId).indexOf(droneId) + 1;
  const shouldHold = missionService.shouldHold(droneId, hubId);

  return res.status(200).json(
    new ApiResponse(200, {
      droneId,
      hubId,
      queuePosition,
      action: shouldHold ? "holding_pattern" : "cleared_to_land"
    }, shouldHold
      ? `Drone ${droneId} in holding pattern — position ${queuePosition} in queue`
      : `Drone ${droneId} cleared to land`
    )
  );
});

// ─── Get Takeoff Queue Status ─────────────────────────────
const getTakeoffQueue = asyncHandler(async (req, res) => {
  const { hubId } = req.params;

  if (!hubId) {
    throw new ApiError(400, "Hub ID is required");
  }

  const queue = missionService.getTakeoffQueueStatus(hubId);

  return res.status(200).json(
    new ApiResponse(200, { hubId, queue }, "Takeoff queue fetched")
  );
});

export {
  dispatchMission,
  getMissionStatus,
  landDrone,
  getTakeoffQueue
};