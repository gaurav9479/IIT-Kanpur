import asyncHandler from "../utils/AsyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import Drone from "../models/Drone.model.js";
import Mission from "../models/Mission.model.js";
import Order from "../models/Order.model.js";
import aiService from "../services/ai.service.js";


const AI_MODULE_URL = process.env.AI_MODULE_URL || "http://localhost:5001";
const NAV_MODULE_URL = process.env.NAV_MODULE_URL || "http://localhost:5002";


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
    status: "IDLE",
    maxWeightCapacity: { $gte: weight }
  });

  if (!drone) {
    throw new ApiError(404, "No suitable IDLE drone found for this mission weight");
  }


  // Phase 14: Use ML AI Service for Predictions
  let batteryUsagePrediction;
  try {
    // Placeholder for distance calculation. In a real scenario, this would come from a pathfinding service or pre-calculated.
    // For now, we'll use a dummy value or derive it from nodes if possible.
    // Assuming a simple Euclidean distance or a lookup from a graph service.
    // For this example, let's assume a dummy distance for demonstration.
    const distance = 100; // Example: distance in km or units relevant to the AI model

    batteryUsagePrediction = await aiService.predictETA({
      distance,
      droneSpeed: 15, // Example drone speed
      congestionLevel: "low", // Default or fetched from another service (e.g., weather, traffic)
      payloadWeight: weight
    });
    
    // logic remains similar: check if prediction fits safety
  } catch (error) {
    // As per instruction, aiService is expected to handle its own fallbacks/errors.
    // If aiService throws an error, it means a critical failure.
    console.error("AI Service (predictETA) Error:", error.message);
    throw new ApiError(502, "AI Service (Battery Prediction) is unreachable or failed");
  }

  const safetyBuffer = 0.15;
  const totalRequiredBattery = batteryUsagePrediction * (1 + safetyBuffer);

  if (drone.batteryLevel < totalRequiredBattery) {
    throw new ApiError(400, `Insufficient battery: Required ${totalRequiredBattery.toFixed(2)}% (with buffer), Available ${drone.batteryLevel}%`);
  }


  let trajectory;
  try {

    const activeMissions = await Mission.find({ status: "IN_PROGRESS" });
    const active_trajectories = activeMissions.map(m => m.trajectoryData).filter(Boolean);

    const navResponse = await axios.post(`${NAV_MODULE_URL}/get-route`, {
      startNode: drone.currentLocationNode,
      pickupNode: pickupNode,
      dropoffNode: dropoffNode,
      active_trajectories
    });

    trajectory = navResponse.data.route;
  } catch (error) {
    console.error("Navigation Module Error:", error.message);
    throw new ApiError(502, "Navigation Module (Path Planning) is unreachable");
  }


  const mission = await Mission.create({
    missionId: `MSN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    order: order._id,
    drone: drone._id,
    pickupNode,
    dropoffNode,
    status: "IN_PROGRESS",
    estimatedBatteryUsage: batteryUsagePrediction,
    trajectoryData: trajectory
  });

  
  drone.status = "EN_ROUTE";
  await drone.save();

  
  order.status = "assigned";
  order.assignedDrone = drone._id;
  await order.save();

  return res.status(201).json(
    new ApiResponse(201, mission, "Mission dispatched successfully")
  );
});

export {
  dispatchMission
};
