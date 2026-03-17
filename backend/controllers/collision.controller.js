import collisionService from "../services/collision.service.js";
import asyncHandler from "../utils/AsyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";

// ── EXISTING ──────────────────────────────────

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

// ── MEMBER 2 ADDITIONS ────────────────────────

// GET /api/collision/status
export const getQueueStatus = asyncHandler(async (req, res) => {
    const takeoffQueue = collisionService.getTakeoffQueue();
    const landingQueue = collisionService.getLandingQueue();

    return res.status(200).json(
        new ApiResponse(200, { takeoffQueue, landingQueue }, "Queue status fetched")
    );
});

// POST /api/collision/takeoff
export const requestTakeoff = asyncHandler(async (req, res) => {
    const { droneId, hubId } = req.body;

    if (!droneId || !hubId) {
        return res.status(400).json(
            new ApiResponse(400, null, "droneId and hubId are required")
        );
    }

    const result = collisionService.requestTakeoff(droneId, hubId);
    return res.status(200).json(
        new ApiResponse(200, result, `Drone ${droneId} takeoff ${result.status}`)
    );
});

// POST /api/collision/takeoff/complete
export const completeTakeoff = asyncHandler(async (req, res) => {
    const { droneId } = req.body;

    if (!droneId) {
        return res.status(400).json(
            new ApiResponse(400, null, "droneId is required")
        );
    }

    collisionService.completeTakeoff(droneId);
    return res.status(200).json(
        new ApiResponse(200, { droneId }, `Drone ${droneId} airborne`)
    );
});

// POST /api/collision/landing
export const requestLanding = asyncHandler(async (req, res) => {
    const { droneId, hubId } = req.body;

    if (!droneId || !hubId) {
        return res.status(400).json(
            new ApiResponse(400, null, "droneId and hubId are required")
        );
    }

    const result = collisionService.requestLanding(droneId, hubId);
    return res.status(200).json(
        new ApiResponse(200, result, `Drone ${droneId} landing ${result.status}`)
    );
});

// POST /api/collision/landing/complete
export const completeLanding = asyncHandler(async (req, res) => {
    const { droneId } = req.body;

    if (!droneId) {
        return res.status(400).json(
            new ApiResponse(400, null, "droneId is required")
        );
    }

    await collisionService.completeLanding(droneId);
    return res.status(200).json(
        new ApiResponse(200, { droneId }, `Drone ${droneId} landed successfully`)
    );
});

// POST /api/collision/emergency/lost-link
export const handleLostLink = asyncHandler(async (req, res) => {
    const { droneId } = req.body;

    if (!droneId) {
        return res.status(400).json(
            new ApiResponse(400, null, "droneId is required")
        );
    }

    const result = await collisionService.handleLostLink(droneId);
    return res.status(200).json(
        new ApiResponse(200, result, `Lost link emergency triggered for ${droneId}`)
    );
});

// POST /api/collision/emergency/low-battery
export const handleLowBattery = asyncHandler(async (req, res) => {
    const { droneId, battery, nearestHub } = req.body;

    if (!droneId || battery === undefined || !nearestHub) {
        return res.status(400).json(
            new ApiResponse(400, null, "droneId, battery, and nearestHub are required")
        );
    }

    const result = await collisionService.handleLowBattery(droneId, battery, nearestHub);

    if (!result) {
        return res.status(200).json(
            new ApiResponse(200, { battery }, "Battery normal — no emergency triggered")
        );
    }

    return res.status(200).json(
        new ApiResponse(200, result, `Low battery emergency triggered for ${droneId}`)
    );
});