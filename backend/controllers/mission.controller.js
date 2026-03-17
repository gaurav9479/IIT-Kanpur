import asyncHandler from "../utils/AsyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import Drone from "../models/Drone.model.js";
import Mission from "../models/Mission.model.js";
import Order from "../models/Order.model.js";
import navigationService from "../services/navigation.service.js";
import { NO_FLY_ZONES } from "../config/safety.config.js";

const dispatchMission = asyncHandler(async (req, res) => {
  const { orderId } = req.body;

  if (!orderId) {
    throw new ApiError(400, "Order ID is required");
  }

  const order = await Order.findById(orderId);
  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  const { pickupLocation, dropLocation, weight } = order;

  if (!pickupLocation || !dropLocation) {
    throw new ApiError(400, "Order is missing coordinates");
  }

  const drone = await Drone.findOne({
    status: "idle",
    payloadCapacity: { $gte: weight }
  });

  if (!drone) {
    throw new ApiError(404, "No suitable idle drone found for this payload");
  }


  let navData;
  try {
    navData = await navigationService.get3DRoute(
      drone.location, 
      pickupLocation,
      { droneId: drone.droneId }
    );
    
    navData = await navigationService.get3DRoute(
      pickupLocation,
      dropLocation,
      { droneId: drone.droneId, obstacles: [] }
    );
  } catch (error) {
    console.error("Navigation Module Error:", error.message);
    throw new ApiError(502, "Navigation Module (3D Path Planning) is unreachable");
  }

  const { path, distance } = navData;


  let batteryUsagePrediction;
  try {
    batteryUsagePrediction = await aiService.predictBatteryDrain({
      distance,
      droneSpeed: 15,
      altitude: 15, 
      payloadWeight: weight
    });
  } catch (error) {
    console.error("AI Service Error:", error.message);
    throw new ApiError(502, "AI Service (Battery Prediction) failed");
  }

  const safetyBuffer = 1.15; 
  const totalRequiredBattery = batteryUsagePrediction * safetyBuffer;

  if (drone.batteryLevel < totalRequiredBattery) {
    throw new ApiError(400, `Insufficient battery: Required ${totalRequiredBattery.toFixed(1)}%, Available ${drone.batteryLevel}%`);
  }


  const mission = await Mission.create({
    missionId: `MSN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    order: order._id,
    drone: drone._id,
    pickupNode: "IITK-NODE",
    dropoffNode: "DEST-NODE",
    status: "IN_PROGRESS",
    estimatedBatteryUsage: batteryUsagePrediction,
    totalDistance: distance,
    trajectoryData: path,
    constraints: { noFlyZones: NO_FLY_ZONES }
  });

  drone.status = "delivering";
  await drone.save();

  order.status = "assigned";
  order.assignedDrone = drone._id;
  await order.save();

  return res.status(201).json(
    new ApiResponse(201, mission, "Mission dispatched successfully with 3D trajectory")
  );
});

export {
  dispatchMission
};
