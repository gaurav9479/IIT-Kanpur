import asyncHandler from "../utils/AsyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import missionService from "../services/mission.service.js";

import missionService from "../services/mission.service.js";

const dispatchMission = asyncHandler(async (req, res) => {
  const { orderId } = req.body;

  if (!orderId) {
    throw new ApiError(400, "Order ID is required");
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

export const getMissionById = asyncHandler(async (req, res) => {
  const mission = await Mission.findById(req.params.id)
    .populate("order")
    .populate("drone");

  if (!mission) {
    throw new ApiError(404, "Mission not found");
  }

  return res.status(200).json(
    new ApiResponse(200, mission, "Mission fetched successfully")
  );
});

export {
  dispatchMission,
  getAllMissions,
  getMissionById
};
