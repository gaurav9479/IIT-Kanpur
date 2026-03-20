/**
 * drone3DService.js
 * Time-based 3D drone movement engine with battery management.
 *
 * Battery logic:
 *   - Every drone starts at 100% battery
 *   - Battery drains at ~0.02% per metre flown (≈ 80m per 1%)
 *   - When battery < 15% → drone is diverted to Power Station
 *   - At Power Station: drone charges for 3600 seconds (1 hour sim)
 *   - After charging: battery = 100%, drone resumes original mission
 *
 * Socket events emitted:
 *   - "drone_position_3d"    — every tick per drone
 *   - "altitude_change"      — when altitude layer changes mid-flight
 *   - "drone_low_battery"    — when battery drops below 15%
 *   - "drone_charging"       — each tick while charging (with progress)
 *   - "drone_charging_done"  — when charge completes
 */

import { io } from "../server.js";
import Drone from "../models/Drone.model.js";
import logger from "../utils/logger.js";
import altitudeManager from "./altitudeManager.js";
import collision3D from "./collision3D.js";
import aiService from "./ai.service.js";

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const DEFAULT_SPEED_MPS      = 10;       // m/s cruise speed
const TICK_MS                = 1000;     // 1-second update cadence
const EARTH_RADIUS_M         = 6_371_000;
const BATTERY_DRAIN_PER_M    = 0.02;    // FALLBACK: % per metre (used if ML model unavailable)
const BATTERY_LOW_THRESHOLD  = 15;      // % — triggers emergency charge
const CHARGE_DURATION_S      = 3600;    // 1 hour in seconds
const CHARGE_RATE_PER_S      = 100 / CHARGE_DURATION_S; // % per second

// Power Station coordinates (from notebook, cell 62)
const POWER_STATION = { lat: 26.5090, lng: 80.2375, alt: 40 };

// Map of droneId → active simulation state
const activeMissions = new Map();

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
  const v = Math.abs((p2.alt ?? p2.z ?? 50) - (p1.alt ?? p1.z ?? 50));
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
        alt: (p1.alt ?? 50) + ((p2.alt ?? 50) - (p1.alt ?? 50)) * t,
        segmentIndex: i,
        remainingMetres: totalPathLength(waypoints) - elapsedMetres,
        totalMetres: totalPathLength(waypoints),
      };
    }
    accumulated += segLen;
  }

  const last = waypoints[waypoints.length - 1];
  return {
    lat: last.lat,
    lng: last.lng,
    alt: last.alt ?? 50,
    segmentIndex: waypoints.length - 1,
    remainingMetres: 0,
    totalMetres: totalPathLength(waypoints),
  };
}

function totalPathLength(waypoints) {
  let total = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    total += segmentLength3D(waypoints[i], waypoints[i + 1]);
  }
  return total;
}

// ─────────────────────────────────────────────────────────────
// STATE BUILDER
// ─────────────────────────────────────────────────────────────

function buildDroneState3D(droneId, pos, speed, missionState, battery, status = "delivering") {
  const totalM  = missionState.totalMetres;
  const remainM = Math.max(0, pos.remainingMetres ?? 0);
  const etaSeconds = speed > 0 ? Math.round(remainM / speed) : 0;

  return {
    id:                droneId,
    droneId,
    lat:               +pos.lat.toFixed(6),
    lng:               +pos.lng.toFixed(6),
    alt:               +pos.alt.toFixed(1),
    speed,
    status,
    batteryLevel:      +battery.toFixed(1),
    timestamp:         Date.now(),
    altColor:          altitudeManager.getAltitudeColor(Math.round(pos.alt / 10) * 10),
    etaSeconds,
    etaLabel:          etaSeconds > 0 ? `${Math.ceil(etaSeconds / 60)}min ${etaSeconds % 60}s` : "Arriving",
    distanceRemaining: +remainM.toFixed(1),
    progressPct:       totalM > 0 ? +(((totalM - remainM) / totalM) * 100).toFixed(1) : 100,
  };
}

// ─────────────────────────────────────────────────────────────
// CHARGING SEQUENCE
// Runs a 3600-second charging cycle at Power Station.
// Emits "drone_charging" every second with progress.
// Resolves when battery = 100%.
// ─────────────────────────────────────────────────────────────

function startChargingCycle(droneId, batteryAtArrival) {
  return new Promise((resolve) => {
    let battery   = batteryAtArrival;
    let elapsed   = 0;
    const totalTime = CHARGE_DURATION_S;

    logger.info(`[BATTERY] ${droneId} — charging started at ${battery.toFixed(1)}%`);

    // Emit initial event
    io.emit("drone_low_battery", {
      droneId,
      batteryLevel: battery,
      message:      `${droneId} battery critical (${battery.toFixed(1)}%) — diverting to Power Station`,
      powerStation: POWER_STATION,
    });

    const chargeTicker = setInterval(async () => {
      elapsed  += 1;
      battery   = Math.min(100, batteryAtArrival + elapsed * CHARGE_RATE_PER_S);

      const minutesLeft  = Math.ceil((totalTime - elapsed) / 60);
      const progressPct  = +((elapsed / totalTime) * 100).toFixed(1);

      // Emit charging update
      const chargingState = {
        droneId,
        lat:          POWER_STATION.lat,
        lng:          POWER_STATION.lng,
        alt:          POWER_STATION.alt,
        speed:        0,
        status:       "charging",
        batteryLevel: +battery.toFixed(1),
        progressPct,
        etaLabel:     minutesLeft > 0 ? `${minutesLeft}min left` : "Completing…",
        timestamp:    Date.now(),
      };

      io.emit("drone_position_3d", chargingState);
      io.emit("drone_charging",    chargingState);

      try {
        await Drone.updateOne(
          { droneId },
          { status: "charging", batteryLevel: +battery.toFixed(1), lastTelemetry: new Date() }
        );
      } catch (_) {}

      // Done
      if (elapsed >= totalTime) {
        clearInterval(chargeTicker);

        logger.info(`[BATTERY] ${droneId} — charging complete (100%)`);
        io.emit("drone_charging_done", {
          droneId,
          batteryLevel: 100,
          message: `${droneId} fully charged — resuming mission`,
        });

        resolve(100); // return final battery
      }
    }, TICK_MS);
  });
}

// ─────────────────────────────────────────────────────────────
// BUILD A DETOUR PATH TO POWER STATION
// Returns a 3-waypoint path: currentPos → ascend to safe alt → POWER_STATION
// ─────────────────────────────────────────────────────────────

function buildDetourToPowerStation(currentPos, safeAlt = 40) {
  return [
    { lat: currentPos.lat, lng: currentPos.lng, alt: safeAlt },
    { lat: POWER_STATION.lat, lng: POWER_STATION.lng, alt: safeAlt },
    { ...POWER_STATION },
  ];
}

// ─────────────────────────────────────────────────────────────
// MAIN: START A 3D DELIVERY SIMULATION
// ─────────────────────────────────────────────────────────────

async function startDrone3D(droneId, path3D, speedMps = DEFAULT_SPEED_MPS, onComplete = null, initialBattery = 100) {
  if (activeMissions.has(droneId)) {
    logger.warn(`[3D] ${droneId} already has an active 3D mission — stopping previous`);
    stopDrone3D(droneId);
  }

  if (!path3D || path3D.length < 2) {
    logger.error(`[3D] ${droneId}: path must have at least 2 waypoints`);
    return;
  }

  // Fetch drone from database to get its preferred operating altitude
  const drone = await Drone.findOne({ droneId });
  const preferredAlt = drone?.operatingAltitude;

  // Assign altitude layer (uses preferredAlt if defined, else dynamic layer)
  const assignedAlt = preferredAlt || altitudeManager.assignLayer(droneId);

  // Normalise path
  const normPath = path3D.map(wp => ({
    lat: wp.lat,
    lng: wp.lng,
    alt: wp.alt ?? wp.z ?? assignedAlt,
  }));

  const pathLenM    = totalPathLength(normPath);
  const startTime   = Date.now();
  let elapsedMetres = 0;
  let battery       = Math.min(100, Math.max(0, initialBattery));
  let divertedToCharge = false;
  let lastPos       = normPath[0];

  logger.info(`[3D] ${droneId} — mission start | path=${normPath.length}pts len=${pathLenM.toFixed(0)}m alt=${assignedAlt}m speed=${speedMps}m/s battery=${battery}%`);

  // ── Query ML battery model for drain rate ────────────────────
  let drainPerM = BATTERY_DRAIN_PER_M; // fallback
  try {
    const mlResult = await aiService.predictBatteryDrain({
      distance:     pathLenM / 1000,
      batteryLevel: battery,
      payload:      1.0,
      windSpeed:    5.0,
      droneSpeed:   speedMps * 3.6,
    });
    if (mlResult && mlResult.drainPerKm) {
      drainPerM = mlResult.drainPerKm / 1000; // convert %/km → %/m
      logger.info(`[3D] ${droneId} — ML battery model: ${mlResult.batteryUsed}% drain, ${mlResult.drainPerKm}%/km (model: ${mlResult.model})`);

      io.emit("event_log", {
        message: `🔋 ML BATTERY MODEL: ${droneId} | Predicted drain: ${mlResult.batteryUsed}% | After: ${mlResult.batteryAfter}% | Model: ${mlResult.model}`,
        type: "info"
      });
    }
  } catch (err) {
    logger.warn(`[3D] ${droneId} — ML battery model unavailable, using fallback ${BATTERY_DRAIN_PER_M}%/m`);
  }

  const ticker = setInterval(async () => {
    const elapsedSec  = (Date.now() - startTime) / 1000;
    const newElapsedM = elapsedSec * speedMps;
    const deltaM      = newElapsedM - elapsedMetres;
    elapsedMetres     = newElapsedM;

    const pos = interpolate3DPath(normPath, elapsedMetres);

    // ── Battery drain (ML model rate) ────────────────────────
    battery = Math.max(0, battery - deltaM * drainPerM);

    const state = buildDroneState3D(droneId, pos, speedMps, { totalMetres: pathLenM }, battery);
    lastPos = pos;

    // Broadcast real-time position
    io.emit("drone_position_3d", state);

    // Persist to DB
    try {
      await Drone.updateOne(
        { droneId },
        {
          location:      { lat: state.lat, lng: state.lng },
          altitude:      state.alt,
          speed:         speedMps,
          batteryLevel:  +battery.toFixed(1),
          lastTelemetry: new Date(),
        }
      );
    } catch (err) {
      logger.error(`[3D] DB update failed for ${droneId}: ${err.message}`);
    }

    // ── ⚡ BATTERY EMERGENCY: divert to Power Station ────────
    if (!divertedToCharge && battery < BATTERY_LOW_THRESHOLD) {
      divertedToCharge = true;
      clearInterval(ticker);
      activeMissions.delete(droneId);

      logger.warn(`[BATTERY] ${droneId} battery at ${battery.toFixed(1)}% — diverting to Power Station`);

      // Build detour path
      const detourPath = buildDetourToPowerStation(pos, assignedAlt);
      const detourLen  = totalPathLength(detourPath);

      // Fly to Power Station first
      let detourElapsed = 0;
      const detourStart = Date.now();

      io.emit("drone_low_battery", {
        droneId,
        batteryLevel:  +battery.toFixed(1),
        message:       `⚡ ${droneId} battery low (${battery.toFixed(1)}%) — diverting to Power Station`,
        powerStation:  POWER_STATION,
      });

      const detourTicker = setInterval(async () => {
        detourElapsed = (Date.now() - detourStart) / 1000 * speedMps;
        const dPos = interpolate3DPath(detourPath, detourElapsed);
        battery = Math.max(0, battery - (speedMps * TICK_MS / 1000) * BATTERY_DRAIN_PER_M);

        const ds = buildDroneState3D(droneId, dPos, speedMps, { totalMetres: detourLen }, battery, "rerouting");
        io.emit("drone_position_3d", ds);

        if (dPos.remainingMetres <= 0 || detourElapsed >= detourLen) {
          clearInterval(detourTicker);
          activeMissions.delete(droneId);

          // ── Charge for 1 hour ─────────────────────────────
          const finalBattery = await startChargingCycle(droneId, battery);

          // ── Resume original mission ──────────────────────
          logger.info(`[3D] ${droneId} — resuming original mission from Power Station`);
          await startDrone3D(droneId, normPath, speedMps, onComplete, finalBattery);
        }
      }, TICK_MS);

      activeMissions.set(droneId, { ticker: detourTicker, path: detourPath, speedMps, startTime: detourStart });
      return;
    }

    // ── Mission complete ─────────────────────────────────────
    if (pos.remainingMetres <= 0 || elapsedMetres >= pathLenM) {
      clearInterval(ticker);
      activeMissions.delete(droneId);
      altitudeManager.releaseLayer(droneId);

      logger.info(`[3D] ${droneId} reached destination. Battery: ${battery.toFixed(1)}%`);
      io.emit("drone_position_3d", { ...state, status: "delivered", speed: 0 });

      try {
        await Drone.updateOne({ droneId }, { status: "idle", altitude: 0, speed: 0 });
      } catch (err) {
        logger.error(`[3D] Final DB update failed for ${droneId}: ${err.message}`);
      }

      if (typeof onComplete === "function") onComplete(droneId);
    }
  }, TICK_MS);

  activeMissions.set(droneId, { ticker, path: normPath, speedMps, startTime });
}

// ─────────────────────────────────────────────────────────────
// STOP / QUERY
// ─────────────────────────────────────────────────────────────

function stopDrone3D(droneId) {
  const mission = activeMissions.get(droneId);
  if (!mission) return false;
  clearInterval(mission.ticker);
  activeMissions.delete(droneId);
  altitudeManager.releaseLayer(droneId);
  logger.info(`[3D] ${droneId} simulation stopped`);
  return true;
}

function getActiveMissions() {
  return [...activeMissions.keys()];
}

function isActive(droneId) {
  return activeMissions.has(droneId);
}

export default {
  startDrone3D,
  stopDrone3D,
  getActiveMissions,
  isActive,
  totalPathLength,
  interpolate3DPath,
  haversineM,
  POWER_STATION,
  BATTERY_LOW_THRESHOLD,
};
