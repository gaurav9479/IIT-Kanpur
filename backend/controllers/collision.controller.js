import collisionService from "../services/collision.service.js";
import asyncHandler from "../utils/AsyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";

export const getCollisionStats = asyncHandler(async (req, res) => {

    const stats = {
        isMonitoring: true,
        pollingInterval: "2s",
        thresholds: {
            safety: "10m",
            emergency: "3m"
        }
    };
    
    return res.status(200).json(
        new ApiResponse(200, stats, "Collision stats fetched successfully")
    );
});

export const triggerManualCheck = asyncHandler(async (req, res) => {
    await collisionService.checkAllDrones();
    return res.status(200).json(
        new ApiResponse(200, null, "Manual collision check triggered")
    );
});
