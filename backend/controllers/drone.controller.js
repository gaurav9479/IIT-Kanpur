import droneService from "../services/drone.service.js";
import asyncHandler from "../utils/AsyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";

export const createDrone = asyncHandler(async (req, res) => {
  const { droneId, vehicleType, payloadCapacity } = req.body;
  const drone = await droneService.createDrone({
    droneId,
    vehicleType,
    payloadCapacity,
    status: "idle",
    batteryLevel: 100
  });
  return res.status(201).json(
    new ApiResponse(201, drone, "Asset added to fleet successfully")
  );
});

export const getAllDrones = asyncHandler(async (req, res) => {
  const drones = await droneService.getAllDrones();
  return res.status(200).json(
    new ApiResponse(200, drones, "Drones fetched successfully")
  );
});

export const getDroneById = asyncHandler(async (req, res) => {
  const drone = await droneService.getDroneById(req.params.id);
  if (!drone) {
    throw new ApiError(404, "Drone not found");
  }
  return res.status(200).json(
    new ApiResponse(200, drone, "Drone fetched successfully")
  );
});

export const updateDrone = asyncHandler(async (req, res) => {
  const drone = await droneService.updateDrone(req.params.id, req.body);
  if (!drone) {
    throw new ApiError(404, "Drone not found");
  }
  return res.status(200).json(
    new ApiResponse(200, drone, "Drone updated successfully")
  );
});

export const deleteDrone = asyncHandler(async (req, res) => {
  const drone = await droneService.deleteDrone(req.params.id);
  if (!drone) {
    throw new ApiError(404, "Drone not found");
  }
  return res.status(200).json(
    new ApiResponse(200, null, "Drone removed from fleet successfully")
  );
});
