/**
 * zone.controller.js — REST handlers for airspace zone management.
 *
 * Endpoints:
 *   GET    /api/v1/zones            — list all zones
 *   POST   /api/v1/zones            — create zone
 *   PUT    /api/v1/zones/:id        — update zone (shape + metadata)
 *   DELETE /api/v1/zones/:id        — delete zone
 *   PATCH  /api/v1/zones/:id/toggle — toggle visibility
 */

import zoneService from "../services/zone.service.js";
import ApiError from "../utils/ApiError.js";

// GET /api/v1/zones
export const getZones = async (req, res, next) => {
  try {
    const zones = zoneService.getZones();
    res.json({ success: true, data: zones });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/zones
export const createZone = async (req, res, next) => {
  try {
    const { name, type, geometry, altitude_min, altitude_max, start_time, end_time } = req.body;

    if (!name || !type || !geometry) {
      throw new ApiError(400, "name, type, and geometry are required.");
    }
    if (!["NO_FLY", "RESTRICTED", "PRIORITY"].includes(type)) {
      throw new ApiError(400, "type must be NO_FLY, RESTRICTED, or PRIORITY.");
    }
    if (!["Polygon", "Circle", "Rectangle"].includes(geometry.type)) {
      throw new ApiError(400, "geometry.type must be Polygon, Circle, or Rectangle.");
    }

    const zone = await zoneService.createZone({
      name,
      type,
      geometry,
      altitude_min: altitude_min ?? 0,
      altitude_max: altitude_max ?? 120,
      start_time: start_time || null,
      end_time: end_time || null,
    });

    res.status(201).json({ success: true, data: zone });
  } catch (err) {
    next(err);
  }
};

// PUT /api/v1/zones/:id
export const updateZone = async (req, res, next) => {
  try {
    const { id } = req.params;
    const allowed = ["name", "type", "geometry", "altitude_min", "altitude_max", "start_time", "end_time", "visible"];
    const updates = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const zone = await zoneService.updateZone(id, updates);
    res.json({ success: true, data: zone });
  } catch (err) {
    if (err.message?.includes("not found")) {
      return next(new ApiError(404, err.message));
    }
    next(err);
  }
};

// DELETE /api/v1/zones/:id
export const deleteZone = async (req, res, next) => {
  try {
    await zoneService.deleteZone(req.params.id);
    res.json({ success: true, message: "Zone deleted." });
  } catch (err) {
    if (err.message?.includes("not found")) {
      return next(new ApiError(404, err.message));
    }
    next(err);
  }
};

// PATCH /api/v1/zones/:id/toggle
export const toggleZoneVisibility = async (req, res, next) => {
  try {
    const zone = await zoneService.toggleVisibility(req.params.id);
    res.json({ success: true, data: zone });
  } catch (err) {
    if (err.message?.includes("not found")) {
      return next(new ApiError(404, err.message));
    }
    next(err);
  }
};
