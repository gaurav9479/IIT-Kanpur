import asyncHandler from "../utils/AsyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import missionService from "../services/mission.service.js";
import Mission from "../models/Mission.model.js";
import navigationService from "../services/navigation.service.js";

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

/**
 * POST /missions/preview-route
 * Body: { pickupLocation: {lat,lng}, dropLocation: {lat,lng} }
 * Returns computed waypoints WITHOUT creating a mission or assigning a drone.
 * Used by the MissionPlanner map to preview the real graph path.
 */
// Helper to find nearest hub for preview
const HUB_COORDS = [
  { name: "Hub North", lat: 26.5200, lng: 80.2320 },
  { name: "Hub South", lat: 26.5088, lng: 80.2330 },
  { name: "Hub East",  lat: 26.5148, lng: 80.2392 },
  { name: "Hub West",  lat: 26.5148, lng: 80.2248 },
  { name: "Hub Central", lat: 26.5140, lng: 80.2318 }
];

const findNearestHub = (loc) => {
  let nearest = HUB_COORDS[4]; // Default to Central
  let minDist = Infinity;
  HUB_COORDS.forEach(h => {
    const d = Math.sqrt((h.lat - loc.lat)**2 + (h.lng - loc.lng)**2);
    if (d < minDist) { minDist = d; nearest = h; }
  });
  return nearest;
};

export const previewRoute = asyncHandler(async (req, res) => {
  const { pickupLocation, dropLocation } = req.body;

  if (!pickupLocation || !dropLocation) {
    throw new ApiError(400, "pickupLocation and dropLocation are required");
  }

  // Find nearest hub to pickup for a realistic preview
  const hubLocation = findNearestHub(pickupLocation);


  try {
    const navData = await navigationService.getFullMissionPath(
      hubLocation,
      pickupLocation,
      dropLocation,
      { droneId: "PREVIEW" }
    );

    return res.status(200).json(
      new ApiResponse(200, {
        path: navData.path,
        distance: navData.distance,
        source: navData.source || "astar-grid-lifecycle",
        waypoints: navData.path.length,
      }, "Full mission lifecycle preview computed")
    );
  } catch (error) {
    // Fallback to simple Pickup -> Drop if full lifecycle fails
    const navData = await navigationService.get3DRoute(
      pickupLocation,
      dropLocation,
      { droneId: "PREVIEW" }
    );
    
    return res.status(200).json(
      new ApiResponse(200, {
        path: navData.path,
        distance: navData.distance,
        source: navData.source || "astar-grid",
        waypoints: navData.path.length,
        warning: "Hub-to-Pickup leg blocked; showing Pickup-to-Drop only."
      }, "Limited preview computed")
    );
  }
});

