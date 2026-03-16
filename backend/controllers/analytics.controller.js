import analyticsService from "../services/analytics.service.js";
import asyncHandler from "../utils/AsyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";

export const getFleetHealth = asyncHandler(async (req, res) => {
  const healthData = await analyticsService.getFleetHealth();
  return res.status(200).json(
    new ApiResponse(200, healthData, "Fleet health data fetched successfully")
  );
});

export const getMissionStats = asyncHandler(async (req, res) => {
  const stats = await analyticsService.getMissionStats();
  return res.status(200).json(
    new ApiResponse(200, stats, "Mission stats fetched successfully")
  );
});
