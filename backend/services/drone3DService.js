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
import safetyService from "./safety.service.js";
import collisionService from "./collision.service.js";
import { ALTITUDE_LANES } from "../config/safety.config.js";


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
const POWER_STATION = { lat: 26.5090, lng: 80.2375, alt: 0 };

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
    lat: last.lat,
    lng: last.lng,
    alt: last.z ?? last.alt ?? 0,
    phase: last.phase || "landed",
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

function getFriendlyStatus(phase) {
  const p = (phase || "").toLowerCase();
  if (p.includes("loading") || p.includes("pickup")) return "picking up";
  if (p.includes("delivery") || p.includes("active")) return "delivering";
  if (p.includes("rth") || p.includes("returning") || p.includes("final") || p.includes("landed")) return "delivered";
  return "delivering";
}

// ─────────────────────────────────────────────────────────────
// STATE BUILDER
// ─────────────────────────────────────────────────────────────

function buildDroneState3D(droneId, pos, speed, missionState, battery, status = "delivering", phase = "delivery") {
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
    phase,                       // 'pickup' | 'delivery' | 'returning'
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

function buildDetourToPowerStation(currentPos, safeAlt = 80) {
  return [
    { lat: currentPos.lat, lng: currentPos.lng, alt: safeAlt },
    { lat: POWER_STATION.lat, lng: POWER_STATION.lng, alt: safeAlt },
    { ...POWER_STATION },
  ];
}

// ─────────────────────────────────────────────────────────────
// MAIN: START A 3D DELIVERY SIMULATION
// ─────────────────────────────────────────────────────────────

async function startDrone3D(droneId, path3D, speedMps = DEFAULT_SPEED_MPS, onComplete = null, initialBattery = 100, payload = 1.0, drainMultiplier = 1.0) {
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
  // Phase tracking: first half of path = pickup approach, second half = delivery
  // The mission.service always dispatches a single path from hub→pickup→drop.
  // We mark everything as 'delivery' by default; missionService can pass pickupIdx to split.
  let missionPhase  = "delivery";

  logger.info(`[3D] ${droneId} — mission start | path=${normPath.length}pts len=${pathLenM.toFixed(0)}m alt=${assignedAlt}m speed=${speedMps}m/s battery=${battery}%`);

  // ── Query ML battery model for drain rate ────────────────────
  let drainPerM = BATTERY_DRAIN_PER_M * drainMultiplier; // fallback (scaled)
  try {
    const mlResult = await aiService.predictBatteryDrain({
      distance:     pathLenM / 1000,
      batteryLevel: battery,
      payload,            // actual mission weight (not hardcoded 1.0)
      windSpeed:    5.0,
      droneSpeed:   speedMps * 3.6,
    });
    if (mlResult && mlResult.drainPerKm) {
      // Apply drainMultiplier on top of ML prediction for scenario control
      drainPerM = (mlResult.drainPerKm / 1000) * drainMultiplier;
      logger.info(`[3D] ${droneId} — ML battery model: ${mlResult.batteryUsed}% drain, ${mlResult.drainPerKm}%/km × ${drainMultiplier}x = ${(drainPerM * 1000).toFixed(3)}%/km effective`);

      io.emit("event_log", {
        message: `🔋 ML BATTERY MODEL: ${droneId} | Payload: ${payload}kg | Drain: ${mlResult.batteryUsed}% × ${drainMultiplier}x multiplier | Model: ${mlResult.model}`,
        type: "info"
      });
    }
  } catch (err) {
    logger.warn(`[3D] ${droneId} — ML battery model unavailable, using fallback ${(BATTERY_DRAIN_PER_M * drainMultiplier).toFixed(4)}%/m (×${drainMultiplier})`);
  }

  const ticker = setInterval(async () => {
    const elapsedSec  = (Date.now() - startTime) / 1000;
    const newElapsedM = elapsedSec * speedMps;
    const deltaM      = newElapsedM - elapsedMetres;
    elapsedMetres     = newElapsedM;

    const pos = interpolate3DPath(normPath, elapsedMetres);

    // ── 🛡️ LANDING QUEUE ENFORCEMENT ──────────────────────────
    // If the next phase of the path is a descent to 0m, check clearance
    const nextWp = normPath[pos.segmentIndex + 1];
    if (nextWp && nextWp.alt === 0 && pos.alt > 0) {
      const locationId = `${nextWp.lat.toFixed(4)}_${nextWp.lng.toFixed(4)}`;
      const clearance = collisionService.requestLanding(droneId, locationId);

      if (clearance.status === "HOLDING") {
        // FREEZE PROGRESS: Stay at current cruise altitude and don't advance elapsedMetres
        elapsedMetres -= deltaM; // revert the meter increment
        const hoverPos = { ...pos, alt: pos.alt }; // maintain current alt
        
        io.emit("drone_position_3d", buildDroneState3D(droneId, hoverPos, 0, { totalMetres: pathLenM }, battery, "hovering", "landing_queue"));
        
        if (Math.floor(elapsedSec) % 5 === 0) {
          io.emit("event_log", {
            message: `⏳ QUEUED: ${droneId} holding at ${pos.alt.toFixed(0)}m. Waiting for landing clearance at ${locationId}. Position: ${clearance.position}`,
            type: "warning"
          });
        }
        return; // skip the rest of the tick
      }
    }

    // ── Battery drain (ML model rate) ────────────────────────
    battery = Math.max(0, battery - deltaM * drainPerM);

    const friendlyStatus = getFriendlyStatus(pos.phase);
    const state = buildDroneState3D(droneId, pos, speedMps, { totalMetres: pathLenM }, battery, friendlyStatus, pos.phase);

    
    // If we just landed (alt reached 0), notify collision service
    if (pos.alt === 0 && deltaM > 0) {
      collisionService.completeLanding(droneId);
    }

    // Broadcast real-time position
    io.emit("drone_position_3d", state);
    io.emit(`drone_update_${droneId}`, {
        droneId,
        location: { lat: state.lat, lng: state.lng },
        altitude: state.alt,
        speed: speedMps,
        batteryLevel: state.batteryLevel,
        status: friendlyStatus
    });

    // Persist to DB
    try {
      await Drone.updateOne(
        { droneId },
        {
          location:      { lat: state.lat, lng: state.lng },
          altitude:      state.alt,
          speed:         speedMps,
          status:        friendlyStatus,
          batteryLevel:  +battery.toFixed(1),
          lastTelemetry: new Date(),
        }
      );

      // Also sync Order status if it matches the phase
      if (friendlyStatus === "delivered") {
          const Mission = (await import("../models/Mission.model.js")).default;
          const Order = (await import("../models/Order.model.js")).default;
          const activeMission = await Mission.findOne({ drone: drone?._id, status: "IN_PROGRESS" });
          if (activeMission) {
              await Order.findByIdAndUpdate(activeMission.order, { status: "delivered" });
          }
      } else if (friendlyStatus === "delivering") {
          const Mission = (await import("../models/Mission.model.js")).default;
          const Order = (await import("../models/Order.model.js")).default;
          const activeMission = await Mission.findOne({ drone: drone?._id, status: "IN_PROGRESS" });
          if (activeMission) {
              await Order.findByIdAndUpdate(activeMission.order, { status: "in-flight" });
          }
      }
    } catch (err) {
      logger.error(`[3D] DB update failed for ${droneId}: ${err.message}`);
    }

    // ── 🧠 INTELLIGENT ALTITUDE ADJUSTMENT ───────────────────
    // Check lane congestion every 5 seconds and switch if "high"
    if (!divertedToCharge && Math.floor(elapsedSec) % 5 === 0 && Math.floor(elapsedSec) > 0) {
        const mission = await Drone.findOne({ droneId }).then(d => d.status === 'delivering' ? d : null);
        // Find mission to get current lane
        const dbMission = await (async () => {
            try {
                const Mission = (await import("../models/Mission.model.js")).default;
                return await Mission.findOne({ drone: drone?._id, status: "IN_PROGRESS" });
            } catch (_) { return null; }
        })();

        if (dbMission && dbMission.lane) {
            try {
                const laneStatus = await aiService.getLanesStatus();
                if (laneStatus && laneStatus.lanes) {
                    const currentLane = laneStatus.lanes.find(l => `L${l.lane_id}` === dbMission.lane || l.lane_id === dbMission.lane);
                    
                    if (currentLane && currentLane.congestion_level === 'high') {
                        logger.info(`[3D] Congestion detected in ${dbMission.lane} for ${droneId}. Searching for altitude adjustment...`);
                        
                        // Find a lane with same direction but lower congestion
                        const currentLaneDef = ALTITUDE_LANES.find(l => l.id === dbMission.lane || l.id === `L${currentLane.lane_id}`);
                        if (currentLaneDef) {
                            const betterLane = ALTITUDE_LANES.find(l => 
                                l.direction === currentLaneDef.direction && 
                                l.id !== currentLaneDef.id &&
                                (laneStatus.lanes.find(ls => `L${ls.lane_id}` === l.id)?.congestion_level !== 'high')
                            );

                            if (betterLane) {
                                const oldAlt = state.alt;
                                const newAlt = betterLane.altitude;
                                
                                logger.info(`[3D] ${droneId} switching altitude: ${oldAlt}m → ${newAlt}m to avoid congestion in ${dbMission.lane}`);
                                
                                // Update remaining waypoints in normPath
                                for (let i = Math.min(normPath.length - 1, state.segmentIndex + 1); i < normPath.length; i++) {
                                    normPath[i].alt = newAlt;
                                }

                                // Update DB Mission
                                dbMission.lane = betterLane.id;
                                await dbMission.save();

                                io.emit("altitude_change", {
                                    droneId,
                                    previousAltitude: oldAlt,
                                    newAltitude: newAlt,
                                    layerId: betterLane.id,
                                    reason: "CONGESTION_AVOIDANCE",
                                    timestamp: new Date(),
                                });

                                io.emit("event_log", {
                                    message: `🚀 INTELLIGENT REROUTE: ${droneId} changed altitude ${oldAlt}m → ${newAlt}m to avoid traffic congestion.`,
                                    type: "info"
                                });
                            }
                        }
                    }
                }
            } catch (err) {
                logger.error(`[3D] Altitude adjustment check failed: ${err.message}`);
            }
        }
    }

    // ── 🛡️ SAFETY CHECK 1: NFZ boundary detection ────────────
    // Checks the actual in-memory position. Only check above 10m to allow takeoff/landing.
    const nfzViolation = state.alt > 10 ? safetyService.isInsideNFZ({ lat: state.lat, lng: state.lng }) : null;
    if (nfzViolation) {
      const alertMsg = `🚨 NFZ VIOLATION: ${droneId} entered "${nfzViolation}" @ (${state.lat.toFixed(4)}, ${state.lng.toFixed(4)})`;
      logger.error(`[SAFETY] ${alertMsg}`);
      io.emit("safety_alert", {
        type:    "NFZ_VIOLATION",
        droneId,
        zone:    nfzViolation,
        lat:     state.lat,
        lng:     state.lng,
        message: alertMsg,
      });
      io.emit("event_log", { message: alertMsg, type: "error" });
    }

    // ── 🛡️ SAFETY CHECK 2: Live proximity (uses in-memory positions) ──
    // Compares against all other active drones from activeMissions map
    // to avoid stale DB reads
    for (const [otherId, otherMission] of activeMissions.entries()) {
      if (otherId === droneId) continue;
      const otherState = otherMission.lastState;
      if (!otherState) continue;
      const dist2D = safetyService.getDistance(
        { lat: state.lat, lng: state.lng },
        { lat: otherState.lat, lng: otherState.lng }
      );
      const altDiff = Math.abs(state.alt - (otherState.alt ?? 80));
      if (dist2D < 50 && altDiff < 10) {
        const proximityMsg = `⚠️ PROXIMITY: ${droneId} ↔ ${otherId} | ${dist2D.toFixed(1)}m apart | ΔAlt: ${altDiff.toFixed(1)}m`;
        logger.warn(`[SAFETY] ${proximityMsg}`);
        io.emit("safety_alert", {
          type:      "PROXIMITY",
          droneId,
          otherId,
          distance:  +dist2D.toFixed(1),
          altDiff:   +altDiff.toFixed(1),
          message:   proximityMsg,
        });
        io.emit("event_log", { message: proximityMsg, type: "warning" });
      }
    }

    // Store last known state for other drones' proximity checks
    const missionState = activeMissions.get(droneId);
    if (missionState) missionState.lastState = state;

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
// RETURN TO HUB
// Called after every successful delivery.
// Checks if any orders are pending — if none, flies home.
// ─────────────────────────────────────────────────────────────
async function _returnToHubIfIdle(droneId, currentPos, battery, speedMps) {
  // Small delay to let DB settle
  await new Promise(r => setTimeout(r, 2000));

  // Check for pending orders in the queue
  const Order = (await import("../models/Order.model.js")).default;
  const pendingCount = await Order.countDocuments({ status: "pending" });

  if (pendingCount > 0) {
    logger.info(`[RTH] ${droneId}: ${pendingCount} pending order(s) in queue — staying on standby.`);
    return; // Mission service will pick it up for next dispatch
  }

  // Fetch drone's home hub from DB
  const droneDoc = await Drone.findOne({ droneId });
  if (!droneDoc) return;

  const hub = droneDoc.homeHub || { lat: 26.5140, lng: 80.2318, name: 'Hub Central' };

  // Don't return if already very close to hub (< 30m away)
  const distToHub = haversineM(currentPos, hub);
  if (distToHub < 30) {
    logger.info(`[RTH] ${droneId}: already at hub (${distToHub.toFixed(0)}m away) — skipping RTH`);
    return;
  }

  logger.info(`[RTH] ${droneId}: No pending orders — returning to ${hub.name} (${distToHub.toFixed(0)}m away)`);

  io.emit("event_log", {
    message: `🏠 RTH: ${droneId} returning to ${hub.name} — no pending orders in queue`,
    type: "info"
  });

  // Build a 3-waypoint path: current → cruise altitude → hub → land
  const cruiseAlt = 80; // safe return altitude
  const returnPath = [
    { lat: currentPos.lat, lng: currentPos.lng, alt: cruiseAlt },
    { lat: (currentPos.lat + hub.lat) / 2, lng: (currentPos.lng + hub.lng) / 2, alt: cruiseAlt }, // midpoint
    { lat: hub.lat, lng: hub.lng, alt: cruiseAlt },
    { lat: hub.lat, lng: hub.lng, alt: 0 }, // descend and land
  ];

  // Mark drone as returning
  await Drone.updateOne({ droneId }, { status: "delivering" });
  io.emit("drone_position_3d", { droneId, lat: currentPos.lat, lng: currentPos.lng, alt: currentPos.alt, status: "returning", speed: speedMps });

  const returnPathLen = totalPathLength(returnPath);
  let returnElapsed = 0;
  const returnStart = Date.now();

  const returnTicker = setInterval(async () => {
    returnElapsed = ((Date.now() - returnStart) / 1000) * speedMps;
    const rPos = interpolate3DPath(returnPath, returnElapsed);
    const rBattery = Math.max(0, battery - returnElapsed * BATTERY_DRAIN_PER_M);

    const rState = buildDroneState3D(droneId, rPos, speedMps, { totalMetres: returnPathLen }, rBattery, "delivered");
    io.emit("drone_position_3d", rState);
    io.emit(`drone_update_${droneId}`, {
        droneId,
        location: { lat: rPos.lat, lng: rPos.lng },
        altitude: rPos.alt,
        speed: speedMps,
        batteryLevel: +rBattery.toFixed(1),
        status: "delivered"
    });

    // Update DB location
    try {
      await Drone.updateOne(
        { droneId },
        { 
          location: { lat: rPos.lat, lng: rPos.lng }, 
          altitude: rPos.alt, 
          status: "delivered",
          batteryLevel: +rBattery.toFixed(1), 
          lastTelemetry: new Date() 
        }
      );
    } catch (_) {}

    if (rPos.remainingMetres <= 0 || returnElapsed >= returnPathLen) {
      clearInterval(returnTicker);
      activeMissions.delete(droneId);

      logger.info(`[RTH] ${droneId} landed at ${hub.name}. Battery: ${rBattery.toFixed(1)}%`);

      // Mark as idle at hub
      await Drone.updateOne(
        { droneId },
        { status: "idle", altitude: 0, speed: 0, location: { lat: hub.lat, lng: hub.lng } }
      );

      io.emit("drone_position_3d", { ...rState, lat: hub.lat, lng: hub.lng, alt: 0, status: "idle", speed: 0 });
      io.emit("event_log", {
        message: `✅ ${droneId} landed at ${hub.name} and is ready for next mission.`,
        type: "info"
      });
    }
  }, TICK_MS);

  activeMissions.set(droneId, { ticker: returnTicker, path: returnPath, speedMps, startTime: returnStart });
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
