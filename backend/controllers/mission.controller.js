import asyncHandler from "../utils/AsyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import missionService from "../services/mission.service.js";
import Mission from "../models/Mission.model.js";

import Order from "../models/Order.model.js";

export const dispatchMission = asyncHandler(async (req, res) => {
  let { orderId, pickupLocation, dropLocation, weight } = req.body;

  // If orderId is not provided, create a new order first (MissionPlanner use case)
  if (!orderId) {
    if (!pickupLocation || !dropLocation || !weight) {
      throw new ApiError(400, "Either orderId or (pickupLocation, dropLocation, weight) is required");
    }

    const order = await Order.create({
      pickupLocation,
      dropLocation,
      weight,
      status: "pending"
    });
    orderId = order._id;
  }

  const mission = await missionService.createMission(orderId);

  return res.status(201).json(
    new ApiResponse(201, mission, "Mission dispatched successfully with 3D trajectory")
  );
});

export const getAllMissions = asyncHandler(async (req, res) => {
  const missions = await Mission.find()
    .populate("order")
    .populate("drone")
    .sort({ createdAt: -1 });

  return res.status(200).json(
    new ApiResponse(200, missions, "Missions fetched successfully")
  );
});

export const getMissionById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  // Manual validation to prevent CastError and support route fall-through
  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    return next(); // This will let Express try other routes or hit the 404 handler
  }

  const mission = await Mission.findById(id)
    .populate("order")
    .populate("drone");

  if (!mission) {
    throw new ApiError(404, "Mission not found");
  }

  return res.status(200).json(
    new ApiResponse(200, mission, "Mission fetched successfully")
  );
});
