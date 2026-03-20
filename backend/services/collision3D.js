/**
 * collision3D.js
 * Production-grade 3D Collision Detection & Resolution Engine.
 *
 * Uses Haversine for horizontal distance + direct delta for vertical.
 * Resolution priority: 1) altitude change  2) reroute  3) hover
 *
 * Emits Socket.io events:
 *   - "collision_warning_3d"
 *   - "altitude_change"
 *   - "nfz_violation"
 */

import logger from "../utils/logger.js";
import { io } from "../server.js";
import Drone from "../models/Drone.model.js";
import altitudeManager from "./altitudeManager.js";
import { NO_FLY_ZONES } from "../config/safety.config.js";

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const HORIZONTAL_THRESHOLD_M  = 5;   // metres — collision if H-dist < this
const VERTICAL_THRESHOLD_M    = 5;   // metres — collision if V-diff < this
const EARTH_RADIUS_M          = 6_371_000;
const POLL_INTERVAL_MS        = 2000;

// Track which pairs are already in active resolution (avoid duplicate handling)
const activePairs = new Set();

// ─────────────────────────────────────────────────────────────
// GEOMETRY HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Haversine horizontal distance in metres between two lat/lng points.
 */
function haversineDistanceM(p1, p2) {
  const toRad = deg => (deg * Math.PI) / 180;
  const dLat = toRad(p2.lat - p1.lat);
  const dLng = toRad(p2.lng - p1.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/**
 * Full 3D Euclidean distance (horizontal Haversine + vertical delta).
 * @returns {Object} { total, horizontal, vertical } in metres
 */
function distance3D(droneA, droneB) {
  const horizontal = haversineDistanceM(
    { lat: droneA.location.lat, lng: droneA.location.lng },
    { lat: droneB.location.lat, lng: droneB.location.lng }
  );
  const altA = droneA.altitude ?? 50;
  const altB = droneB.altitude ?? 50;
  const vertical = Math.abs(altA - altB);
  const total = Math.sqrt(horizontal ** 2 + vertical ** 2);

  return { total, horizontal, vertical };
}

/**
 * Point-in-polygon test (ray casting).
 */
function isPointInPolygon(point, polygon) {
  let inside = false;
  const { lat, lng } = point;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat, yi = polygon[i].lng;
    const xj = polygon[j].lat, yj = polygon[j].lng;
    const intersect =
      yi > lng !== yj > lng && lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Returns the name of the NFZ the point is inside, or null.
 * NFZ applies at ALL altitudes.
 */
function getViolatedNFZ(location) {
  for (const zone of NO_FLY_ZONES) {
    if (isPointInPolygon(location, zone.positions)) {
      return zone.name;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// COLLISION RESOLUTION (Priority order)
// ─────────────────────────────────────────────────────────────

/**
 * Resolution 1: Try to escalate one drone to a higher altitude layer.
 */
async function resolveByAltitudeChange(droneA, droneB) {
  // Higher droneId backs off (deterministic ordering)
  const resolver = droneA.droneId > droneB.droneId ? droneA : droneB;
  const newAlt = altitudeManager.escalateLayer(resolver.droneId);

  if (newAlt !== null) {
    await Drone.updateOne({ droneId: resolver.droneId }, { altitude: newAlt });
    logger.info(`[3D-COL] Altitude resolution: ${resolver.droneId} → ${newAlt}m`);
    return { action: "altitude_change", droneId: resolver.droneId, newAltitude: newAlt };
  }

  return null; // escalation failed → try next resolution
}

/**
 * Resolution 2: Force hover (hold position) on the lower-priority drone.
 */
async function resolveByHover(droneA, droneB) {
  const hoverer = droneA.droneId > droneB.droneId ? droneA : droneB;
  await Drone.updateOne({ droneId: hoverer.droneId }, { status: "hovering" });

  io.to("admin_dashboard").emit("drone_position_3d", {
    droneId: hoverer.droneId,
    lat:     hoverer.location.lat,
    lng:     hoverer.location.lng,
    alt:     hoverer.altitude ?? 50,
    speed:   0,
    status:  "hovering",
    timestamp: Date.now(),
  });

  logger.warn(`[3D-COL] Hover resolution: ${hoverer.droneId} holding position`);
  return { action: "hover", droneId: hoverer.droneId };
}

// ─────────────────────────────────────────────────────────────
// MAIN: HANDLE A DETECTED CONFLICT
// ─────────────────────────────────────────────────────────────

async function handleConflict(droneA, droneB, distances) {
  const pairKey = [droneA.droneId, droneB.droneId].sort().join("__");
  if (activePairs.has(pairKey)) return; // Already resolving
  activePairs.add(pairKey);

  const severity = distances.total < 3 ? "CRITICAL" : "WARNING";

  const basePayload = {
    type:         "collision_warning_3d",
    severity,
    droneA:       droneA.droneId,
    droneB:       droneB.droneId,
    distanceTotal:    +distances.total.toFixed(2),
    distanceHorizontal: +distances.horizontal.toFixed(2),
    distanceVertical:   +distances.vertical.toFixed(2),
    altA:         droneA.altitude ?? 50,
    altB:         droneB.altitude ?? 50,
    timestamp:    new Date(),
  };

  // Emit collision warning immediately
  io.to("admin_dashboard").emit("collision_warning_3d", basePayload);
  io.emit(`drone_alert_${droneA.droneId}`, basePayload);
  io.emit(`drone_alert_${droneB.droneId}`, basePayload);

  logger.warn(`[3D-COL] ${severity} — ${droneA.droneId} ↔ ${droneB.droneId} | H:${distances.horizontal.toFixed(1)}m V:${distances.vertical.toFixed(1)}m`);

  // Priority 1: Altitude change
  let resolution = await resolveByAltitudeChange(droneA, droneB);

  // Priority 2: Hover (if altitude escalation not possible)
  if (!resolution) {
    resolution = await resolveByHover(droneA, droneB);
  }

  io.to("admin_dashboard").emit("collision_warning_3d", {
    ...basePayload,
    resolution,
  });

  // Release the pair lock after 8 seconds so re-checks can happen
  setTimeout(() => activePairs.delete(pairKey), 8000);
}

// ─────────────────────────────────────────────────────────────
// MAIN: CHECK ALL ACTIVE DRONES
// ─────────────────────────────────────────────────────────────

async function checkAllDrones3D() {
  try {
    const activeDrones = await Drone.find({
      status: { $in: ["delivering", "avoidance", "hovering"] },
    });

    if (activeDrones.length < 2) return;

    for (let i = 0; i < activeDrones.length; i++) {
      for (let j = i + 1; j < activeDrones.length; j++) {
        const droneA = activeDrones[i];
        const droneB = activeDrones[j];

        const distances = distance3D(droneA, droneB);

        // 3D collision condition: both thresholds must be breached
        const isCollisionRisk =
          distances.horizontal < HORIZONTAL_THRESHOLD_M &&
          distances.vertical   < VERTICAL_THRESHOLD_M;

        if (isCollisionRisk) {
          await handleConflict(droneA, droneB, distances);
        }
      }
    }
  } catch (err) {
    logger.error(`[3D-COL] Check error: ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────────────
// MAIN: CHECK EACH DRONE FOR NFZ VIOLATIONS (3D — all altitudes)
// ─────────────────────────────────────────────────────────────

async function checkNFZViolations3D() {
  try {
    const activeDrones = await Drone.find({
      status: { $in: ["delivering", "avoidance", "hovering"] },
    });

    for (const drone of activeDrones) {
      const nfzName = getViolatedNFZ(drone.location);
      if (nfzName) {
        const payload = {
          droneId:  drone.droneId,
          nfzName,
          location: drone.location,
          altitude: drone.altitude ?? 50,
          timestamp: new Date(),
        };

        io.to("admin_dashboard").emit("nfz_violation", payload);
        io.emit(`drone_alert_${drone.droneId}`, { type: "nfz_violation", ...payload });

        logger.error(`[3D-NFZ] ${drone.droneId} inside ${nfzName} at alt ${drone.altitude ?? 50}m`);

        // Force emergency hover inside NFZ
        await Drone.updateOne({ droneId: drone.droneId }, { status: "emergency_hover" });
      }
    }
  } catch (err) {
    logger.error(`[3D-NFZ] Check error: ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────────────
// MONITOR LOOP (called once on server start)
// ─────────────────────────────────────────────────────────────

function startMonitoring3D() {
  setInterval(async () => {
    await checkAllDrones3D();
    await checkNFZViolations3D();
  }, POLL_INTERVAL_MS);

  logger.info("[3D-COL] 3D Collision & NFZ monitoring started (2s interval)");
}

export default {
  startMonitoring3D,
  checkAllDrones3D,
  checkNFZViolations3D,
  distance3D,
  getViolatedNFZ,
  haversineDistanceM,
  HORIZONTAL_THRESHOLD_M,
  VERTICAL_THRESHOLD_M,
};
