/**
 * drone3DService.js
 * Time-based 3D drone movement engine with battery management.
 */

import { io } from "../server.js";
import Drone from "../models/Drone.model.js";
import logger from "../utils/logger.js";
import altitudeManager from "./altitudeManager.js";
import collision3D from "./collision3D.js";
import aiService from "./ai.service.js";
import safetyService from "./safety.service.js";
import collisionService from "./collision.service.js";
import { droneStateMap } from "./predictiveCollision.js";
import { ALTITUDE_LANES } from "../config/safety.config.js";

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const DEFAULT_SPEED_MPS      = 10;       
const TICK_MS                = 1000;     
const EARTH_RADIUS_M         = 6_371_000;
const BATTERY_DRAIN_PER_M    = 0.09;    
const BATTERY_LOW_THRESHOLD  = 15;      
const CHARGE_DURATION_S      = 3600;    
const CHARGE_RATE_PER_S      = 100 / CHARGE_DURATION_S;

const POWER_STATION = { lat: 26.5090, lng: 80.2375, alt: 0 };

// Map of droneId → active simulation state
const activeMissions = new Map();
// Alert de-spamming cache: droneId_type → lastTimestamp
const alertCache = new Map();

function shouldAlert(droneId, type) {
  const key = `${droneId}_${type}`;
  const now = Date.now();
  if (alertCache.has(key) && now - alertCache.get(key) < 10000) return false;
  alertCache.set(key, now);
  return true;
}

// ─────────────────────────────────────────────────────────────
// GEOMETRY UTILITIES
// ─────────────────────────────────────────────────────────────

function haversineM(p1, p2) {
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(p2.lat - p1.lat);
  const dLng = toRad(p2.lng - p1.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

function segmentLength3D(p1, p2) {
  const h = haversineM(p1, p2);
  const v = Math.abs((p2.alt ?? p2.z ?? 80) - (p1.alt ?? p1.z ?? 80));
  return Math.sqrt(h ** 2 + v ** 2);
}

function interpolate3DPath(waypoints, elapsedMetres) {
  let accumulated = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const p1 = waypoints[i];
    const p2 = waypoints[i + 1];
    const segLen = segmentLength3D(p1, p2);
    if (accumulated + segLen >= elapsedMetres) {
      const t = (elapsedMetres - accumulated) / segLen;
      return {
        lat: p1.lat + (p2.lat - p1.lat) * t,
        lng: p1.lng + (p2.lng - p1.lng) * t,
        alt: (p1.z ?? p1.alt ?? 80) + ((p2.z ?? p2.alt ?? 80) - (p1.z ?? p1.alt ?? 80)) * t,
        phase: p1.phase || p2.phase || "delivering",
        segmentIndex: i,
        remainingMetres: totalPathLength(waypoints) - elapsedMetres,
        totalMetres: totalPathLength(waypoints),
      };
    }
    accumulated += segLen;
  }
  const last = waypoints[waypoints.length - 1];
  return {
    lat: last.lat, lng: last.lng, alt: last.z ?? last.alt ?? 0,
    phase: last.phase || "landed", segmentIndex: waypoints.length - 1,
    remainingMetres: 0, totalMetres: totalPathLength(waypoints),
  };
}

function totalPathLength(waypoints) {
  let total = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    total += segmentLength3D(waypoints[i], waypoints[i + 1]);
  }
  return total;
}

function getFriendlyStatus(phase) {
  const p = (phase || "").toLowerCase();
  if (p.includes("loading") || p.includes("pickup")) return "picking up";
  if (p.includes("delivery") || p.includes("active")) return "delivering";
  if (p.includes("rth") || p.includes("returning") || p.includes("final") || p.includes("landed")) return "delivered";
  return "delivering";
}

function buildDroneState3D(droneId, pos, speed, missionState, battery, status = "delivering", phase = "delivery") {
  const totalM  = missionState.totalMetres;
  const remainM = Math.max(0, pos.remainingMetres ?? 0);
  const etaSeconds = speed > 0 ? Math.round(remainM / speed) : 0;
  
  // Calculate heading based on previous position if available
  let heading = 0;
  const prevState = droneStateMap.get(droneId);
  if (prevState && (prevState.lat !== pos.lat || prevState.lng !== pos.lng)) {
      const toRad = (deg) => (deg * Math.PI) / 180;
      const toDeg = (rad) => (rad * 180) / Math.PI;
      const lat1 = toRad(prevState.lat);
      const lat2 = toRad(pos.lat);
      const dLng = toRad(pos.lng - prevState.lng);
      const y = Math.sin(dLng) * Math.cos(lat2);
      const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
      heading = (toDeg(Math.atan2(y, x)) + 360) % 360;
  } else if (prevState) {
      heading = prevState.heading; // Maintain heading if hovering
  }

  return {
    id: droneId, droneId, lat: +pos.lat.toFixed(6), lng: +pos.lng.toFixed(6), alt: +pos.alt.toFixed(1),
    speed, status, phase, batteryLevel: +battery.toFixed(1), timestamp: Date.now(),
    heading: +heading.toFixed(2),
    altColor: altitudeManager.getAltitudeColor(Math.round(pos.alt / 10) * 10),
    etaSeconds, etaLabel: etaSeconds > 0 ? `${Math.ceil(etaSeconds / 60)}min ${etaSeconds % 60}s` : "Arriving",
    distanceRemaining: +remainM.toFixed(1), progressPct: totalM > 0 ? +(((totalM - remainM) / totalM) * 100).toFixed(1) : 100,
  };
}

// ─────────────────────────────────────────────────────────────
// CHARGING
// ─────────────────────────────────────────────────────────────
function startChargingCycle(droneId, batteryAtArrival) {
  return new Promise((resolve) => {
    let battery = batteryAtArrival;
    let elapsed = 0;
    const totalTime = CHARGE_DURATION_S;
    const chargeTicker = setInterval(async () => {
      elapsed += 1;
      battery = Math.min(100, batteryAtArrival + elapsed * CHARGE_RATE_PER_S);
      const state = {
        droneId, lat: POWER_STATION.lat, lng: POWER_STATION.lng, alt: POWER_STATION.alt,
        speed: 0, heading: 0, status: "charging", batteryLevel: +battery.toFixed(1), timestamp: Date.now(),
      };
      
      droneStateMap.set(droneId, state);
      
      io.to("admin_dashboard").emit("drone_position_3d", state);
      io.to(`drone_${droneId}`).emit("drone_position_3d", state);
      
      await Drone.updateOne({ droneId }, { status: "charging", batteryLevel: +battery.toFixed(1) });
      if (elapsed >= totalTime) {
        clearInterval(chargeTicker);
        resolve(100);
      }
    }, TICK_MS);
  });
}

function buildDetourToPowerStation(currentPos, safeAlt = 80) {
  return [
    { lat: currentPos.lat, lng: currentPos.lng, alt: safeAlt },
    { lat: POWER_STATION.lat, lng: POWER_STATION.lng, alt: safeAlt },
    { ...POWER_STATION },
  ];
}

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────
async function startDrone3D(droneId, path3D, speedMps = DEFAULT_SPEED_MPS, onComplete = null, initialBattery = 100, payload = 1.0, drainMultiplier = 1.0) {
  if (activeMissions.has(droneId)) stopDrone3D(droneId);
  const drone = await Drone.findOne({ droneId });
  const assignedAlt = drone?.operatingAltitude || altitudeManager.assignLayer(droneId);
  const normPath = path3D.map(wp => ({ lat: wp.lat, lng: wp.lng, alt: wp.alt ?? wp.z ?? assignedAlt }));
  const pathLenM = totalPathLength(normPath);
  const startTime = Date.now();
  let elapsedMetres = 0;
  let battery = initialBattery;
  let divertedToCharge = false;

  let drainPerM = BATTERY_DRAIN_PER_M * drainMultiplier;
  try {
    const ml = await aiService.predictBatteryDrain({ distance: pathLenM/1000, batteryLevel: battery, payload, windSpeed: 5.0, droneSpeed: speedMps*3.6 });
    if (ml?.drainPerKm) drainPerM = (ml.drainPerKm / 1000) * drainMultiplier;
  } catch (_) {}

  const ticker = setInterval(async () => {
    const elapsedSec = (Date.now() - startTime) / 1000;
    const newElapsedM = elapsedSec * speedMps;
    const deltaM = newElapsedM - elapsedMetres;
    elapsedMetres = newElapsedM;
    const pos = interpolate3DPath(normPath, elapsedMetres);

    // 🛡️ LANDING QUEUE
    const nextWp = normPath[pos.segmentIndex + 1];
    if (nextWp && nextWp.alt === 0 && pos.alt > 0) {
      const locId = `${nextWp.lat.toFixed(4)}_${nextWp.lng.toFixed(4)}`;
      const clearance = collisionService.requestLanding(droneId, locId);
      if (clearance.status === "HOLDING") {
        elapsedMetres -= deltaM; // Hover
        const state = buildDroneState3D(droneId, pos, 0, { totalMetres: pathLenM }, battery, "hovering", "queue");
        droneStateMap.set(droneId, state);
        io.to("admin_dashboard").emit("drone_position_3d", state);
        io.to(`drone_${droneId}`).emit("drone_position_3d", state);
        if (shouldAlert(droneId, "QUEUE")) io.to("admin_dashboard").emit("event_log", { message: `⏳ QUEUE: ${droneId} holding for landing at ${locId}`, type: "warning" });
        return;
      }
    }

    battery = Math.max(0, battery - deltaM * drainPerM);
    const status = getFriendlyStatus(pos.phase);
    const state = buildDroneState3D(droneId, pos, speedMps, { totalMetres: pathLenM }, battery, status, pos.phase);

    droneStateMap.set(droneId, state);

    io.to("admin_dashboard").emit("drone_position_3d", state);
    io.to(`drone_${droneId}`).emit("drone_position_3d", state);
    
    // 🧠 INTELLIGENT ALTITUDE ADJUSTMENT (Congestion Avoidance)
    if (Math.floor(elapsedSec) % 5 === 0 && Math.floor(elapsedSec) > 0) {
        try {
            const laneStatus = await aiService.getLanesStatus();
            if (laneStatus?.lanes) {
                // Find current lane by matching altitude from config
                const currentLaneDef = ALTITUDE_LANES.find(l => Math.abs(l.altitude - pos.alt) < 10);
                if (currentLaneDef) {
                    const status = laneStatus.lanes.find(ls => ls.lane_id === parseInt(currentLaneDef.id.replace('L','')) || ls.lane_id === currentLaneDef.id);
                    if (status?.congestion_level === 'high') {
                        const newLayer = altitudeManager.escalateLayer(droneId);
                        if (newLayer) {
                            for (let i = pos.segmentIndex + 1; i < normPath.length; i++) normPath[i].alt = newLayer;
                            if (shouldAlert(droneId, "REROUTE")) {
                                io.emit("event_log", { message: `🚀 TRAFFIC: ${droneId} switched to ${newLayer}m to avoid congestion`, type: "info" });
                            }
                        }
                    }
                }
            }
        } catch (_) {}
    }

    // 🛡️ SAFETY CHECKS
    const violation = state.alt > 10 ? safetyService.isInsideNFZ({ lat: state.lat, lng: state.lng }) : null;
    if (violation && shouldAlert(droneId, "NFZ")) {
      io.emit("event_log", { message: `🚨 NFZ: ${droneId} in ${violation}`, type: "error" });
    }

    // Proximity
    for (const [otherId, otherMission] of activeMissions.entries()) {
      if (otherId === droneId) continue;
      const other = otherMission.lastState;
      if (!other) continue;
      const d2 = safetyService.getDistance(state, other);
      if (d2 < 50 && Math.abs(state.alt - other.alt) < 10 && shouldAlert(droneId, `PROX_${otherId}`)) {
        io.emit("event_log", { message: `⚠️ PROXIMITY: ${droneId} ↔ ${otherId} (${d2.toFixed(0)}m)`, type: "warning" });
      }
    }

    activeMissions.get(droneId).lastState = state;
    await Drone.updateOne({ droneId }, { location: { lat: state.lat, lng: state.lng }, altitude: state.alt, batteryLevel: state.batteryLevel, status });

    if (!divertedToCharge && battery < BATTERY_LOW_THRESHOLD) {
      divertedToCharge = true;
      clearInterval(ticker);
      const detour = buildDetourToPowerStation(pos, assignedAlt);
      await startDrone3D(droneId, detour, speedMps, async () => {
        const full = await startChargingCycle(droneId, battery);
        startDrone3D(droneId, normPath, speedMps, onComplete, full);
      }, battery);
      return;
    }

    if (pos.remainingMetres <= 0) {
      clearInterval(ticker);
      activeMissions.delete(droneId);
      droneStateMap.delete(droneId);
      altitudeManager.releaseLayer(droneId);
      await Drone.updateOne({ droneId }, { status: "idle", altitude: 0 });
      if (onComplete) onComplete(droneId);
    }
  }, TICK_MS);

  activeMissions.set(droneId, { ticker, lastState: null });
}

function stopDrone3D(droneId) {
  const m = activeMissions.get(droneId);
  if (m) { clearInterval(m.ticker); activeMissions.delete(droneId); altitudeManager.releaseLayer(droneId); return true; }
  return false;
}

export default { startDrone3D, stopDrone3D, haversineM, POWER_STATION, BATTERY_LOW_THRESHOLD };
