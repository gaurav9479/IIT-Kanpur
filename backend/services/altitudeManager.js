/**
 * altitudeManager.js
 * Manages altitude layer assignment for all active drones.
 * Implements the 3-layer smart airspace (40m / 50m / 60m) with
 * conflict detection and priority-based resolution.
 */

import logger from "../utils/logger.js";
import { io } from "../server.js";

// ─────────────────────────────────────────────────────────────
// ALTITUDE LAYER DEFINITIONS (meters)
// ─────────────────────────────────────────────────────────────
export const ALTITUDE_LAYERS = [
  { id: "ALT-40",  altitude: 40,  label: "Layer 1 (Low)",    color: "blue"   },
  { id: "ALT-50",  altitude: 50,  label: "Layer 2 (Mid)",    color: "green"  },
  { id: "ALT-60",  altitude: 60,  label: "Layer 3 (High)",   color: "orange" },
  { id: "ALT-70",  altitude: 70,  label: "Layer 4 (Emergency)", color: "red"  },
];

// Minimum vertical separation between drones in the same horizontal vicinity
export const VERTICAL_SEPARATION_M = 10;

// droneLayerMap: droneId → { layerId, altitude, assignedAt }
const droneLayerMap = new Map();

// layerCount: layerId → Set of droneIds
const layerCount = new Map(ALTITUDE_LAYERS.map(l => [l.id, new Set()]));

// ─────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────

/**
 * Assigns the optimal altitude layer to a drone.
 * Picks the least-congested layer starting from lowest.
 * Returns the assigned altitude (meters).
 */
function assignLayer(droneId) {
  // If already assigned, return current
  if (droneLayerMap.has(droneId)) {
    return droneLayerMap.get(droneId).altitude;
  }

  // Pick layer with fewest occupants
  const sorted = [...ALTITUDE_LAYERS].sort((a, b) => {
    const countA = layerCount.get(a.id)?.size ?? 0;
    const countB = layerCount.get(b.id)?.size ?? 0;
    return countA - countB;
  });

  const chosen = sorted[0];
  _assign(droneId, chosen);

  logger.info(`[ALT] ${droneId} → ${chosen.label} (${chosen.altitude}m)`);
  return chosen.altitude;
}

/**
 * Escalates a drone to the next available altitude layer.
 * Used during conflict resolution. Returns new altitude or null if at max.
 */
function escalateLayer(droneId) {
  const current = droneLayerMap.get(droneId);
  if (!current) return assignLayer(droneId);

  const currentIndex = ALTITUDE_LAYERS.findIndex(l => l.id === current.layerId);
  if (currentIndex === -1 || currentIndex >= ALTITUDE_LAYERS.length - 1) {
    logger.warn(`[ALT] ${droneId} already at max altitude — cannot escalate further`);
    return null; // No higher layer available
  }

  const nextLayer = ALTITUDE_LAYERS[currentIndex + 1];
  _release(droneId);
  _assign(droneId, nextLayer);

  io.to("admin_dashboard").emit("altitude_change", {
    droneId,
    previousAltitude: current.altitude,
    newAltitude: nextLayer.altitude,
    layerId: nextLayer.id,
    reason: "CONFLICT_ESCALATION",
    timestamp: new Date(),
  });

  logger.info(`[ALT] ${droneId} escalated ${current.altitude}m → ${nextLayer.altitude}m`);
  return nextLayer.altitude;
}

/**
 * Releases a drone from its altitude layer (on landing/mission complete).
 */
function releaseLayer(droneId) {
  if (!droneLayerMap.has(droneId)) return;
  const layer = droneLayerMap.get(droneId);
  _release(droneId);
  logger.info(`[ALT] ${droneId} released from ${layer.label}`);
}

/**
 * Returns current altitude assignment for a drone, or null.
 */
function getAssignment(droneId) {
  return droneLayerMap.get(droneId) ?? null;
}

/**
 * Returns a full snapshot of all layer occupancies.
 */
function getLayerSnapshot() {
  const snapshot = {};
  for (const layer of ALTITUDE_LAYERS) {
    snapshot[layer.id] = {
      ...layer,
      drones: [...(layerCount.get(layer.id) ?? [])],
      count: layerCount.get(layer.id)?.size ?? 0,
    };
  }
  return snapshot;
}

/**
 * Returns the color code for the given altitude.
 * Used by frontend to color-code markers.
 */
function getAltitudeColor(altitude) {
  const layer = ALTITUDE_LAYERS.find(l => l.altitude === altitude);
  return layer ? layer.color : "gray";
}

// ─────────────────────────────────────────────────────────────
// PRIVATE HELPERS
// ─────────────────────────────────────────────────────────────
function _assign(droneId, layer) {
  droneLayerMap.set(droneId, {
    layerId:    layer.id,
    altitude:   layer.altitude,
    label:      layer.label,
    assignedAt: Date.now(),
  });
  layerCount.get(layer.id)?.add(droneId);
}

function _release(droneId) {
  const entry = droneLayerMap.get(droneId);
  if (entry) {
    layerCount.get(entry.layerId)?.delete(droneId);
    droneLayerMap.delete(droneId);
  }
}

export default {
  assignLayer,
  escalateLayer,
  releaseLayer,
  getAssignment,
  getLayerSnapshot,
  getAltitudeColor,
  ALTITUDE_LAYERS,
  VERTICAL_SEPARATION_M,
};
