/**
 * predictiveCollision.js
 * The core trajectory extrapolation engine for SkyTrace.
 * 
 * WHY IN-MEMORY MAP?
 * We replaced the original MongoDB polling method because real-time predictive collision 
 * requires sub-millisecond access to the absolute latest telemetry. A network round-trip 
 * to MongoDB for 50 drones every second introduces unacceptable latency. The Map acts as
 * an O(1) state store, updated directly by the 3D simulation tick.
 */

import logger from "../utils/logger.js";
import { io } from "../server.js";
import { inverseHaversine, haversineDistance } from "../utils/trajectoryMath.js";
import altitudeManager from "./altitudeManager.js";
import Drone from "../models/Drone.model.js";

// O(1) Lookup Store for all active telemetry
// Key: droneId
// Value: { lat, lng, alt, speed, heading, status, timestamp, missionId }
export const droneStateMap = new Map();

// 15-second Pair Lock: Prevents duplicate resolution events for the same two drones.
// Key: [droneIdA, droneIdB].sort().join('-')
// Value: expiration timestamp (Date.now() + 15000)
const pairLocks = new Map();

const HORIZONTAL_THRESHOLD_M = 10;
const VERTICAL_THRESHOLD_M   = 50;
const PREDICTION_INTERVALS_S = [3, 6, 9, 12, 15]; // T+3 to T+15 seconds

/**
 * Sweeps the entire droneStateMap to predict and resolve future collisions.
 * 
 * WHY GRADUATED RESPONSE?
 * By predicting conflicts at multiple time intervals, we convert a reactive emergency 
 * into a scheduling problem. If we have >9 seconds, we can seamlessly reroute the drone 
 * using A* without disrupting its flight path. If we only have <5 seconds, we execute 
 * an emergency hover to prevent disaster.
 */
export async function checkPredictiveCollision() {
  const now = Date.now();
  
  // 1. Filter out stale or grounded drones
  const activeDrones = [];
  for (const [droneId, state] of droneStateMap.entries()) {
    // Remove stale data (older than 3 seconds)
    if (now - state.timestamp > 3000) continue;
    // Ignore landed or charging drones
    if (state.status === 'charging' || state.status === 'idle' || state.status === 'landed') continue;
    
    activeDrones.push({ droneId, ...state });
  }

  if (activeDrones.length < 2) return;

  // 2. O(n^2) Pairwise Check (acceptable for < 100 drones)
  for (let i = 0; i < activeDrones.length; i++) {
    for (let j = i + 1; j < activeDrones.length; j++) {
      const droneA = activeDrones[i];
      const droneB = activeDrones[j];
      
      const pairKey = [droneA.droneId, droneB.droneId].sort().join('-');
      
      // Skip if locked in active resolution
      if (pairLocks.has(pairKey) && pairLocks.get(pairKey) > now) continue;

      // 3. Extrapolate Trajectories across Time Intervals
      for (const t of PREDICTION_INTERVALS_S) {
        // Assume constant altitude for prediction (most flights are level-cruise)
        const posA = inverseHaversine(droneA.lat, droneA.lng, droneA.speed * t, droneA.heading);
        const posB = inverseHaversine(droneB.lat, droneB.lng, droneB.speed * t, droneB.heading);

        const distH = haversineDistance(posA, posB);
        const distV = Math.abs((droneA.alt || 50) - (droneB.alt || 50));

        // If they intersect at time T
        if (distH < HORIZONTAL_THRESHOLD_M && distV < VERTICAL_THRESHOLD_M) {
          // Lock pair for 15 seconds
          pairLocks.set(pairKey, now + 15000);
          
          await resolveWithTime(droneA, droneB, t, {
            lat: (posA.lat + posB.lat) / 2,
            lng: (posA.lng + posB.lng) / 2,
            alt: droneA.alt || 50
          });
          
          break; // Stop checking further time intervals for this pair
        }
      }
    }
  }
}

/**
 * Applies the graduated resolution strategy based on time to conflict.
 */
async function resolveWithTime(droneA, droneB, timeToConflict, conflictPoint) {
  // Deterministic Resolver: Higher Drone ID yields
  const resolver = droneA.droneId > droneB.droneId ? droneA : droneB;
  const other    = resolver === droneA ? droneB : droneA;

  let severity = 'CRITICAL';
  let action   = 'HOVER';

  if (timeToConflict > 9) {
    severity = 'EARLY';
    action = 'REROUTE';
    
    // 1. Place a temporary soft block on the A* grid at the conflict point
    altitudeManager.addTemporaryBlock(conflictPoint.lat, conflictPoint.lng, 15); // 15m radius
    
    // 2. Emit predictive_reroute to specific drone room
    io.to(`drone_${resolver.droneId}`).emit('predictive_reroute', {
      droneId: resolver.droneId,
      conflictPoint
    });
    
    logger.info(`[PREDICT] EARLY Warning: ${resolver.droneId} rerouting away from ${other.droneId} at T+${timeToConflict}s`);
    
  } else if (timeToConflict > 4) {
    severity = 'MODERATE';
    action = 'ALTITUDE';
    
    // Try to escalate lane, fallback to descent, fallback to hover
    let newAlt = altitudeManager.escalateLayer(resolver.droneId);
    if (newAlt) {
       await Drone.updateOne({ droneId: resolver.droneId }, { altitude: newAlt });
       droneStateMap.get(resolver.droneId).alt = newAlt; // Update in-memory state immediately
       
       io.to(`drone_${resolver.droneId}`).emit('altitude_change', {
         droneId: resolver.droneId,
         newAltitude: newAlt
       });
       logger.info(`[PREDICT] MODERATE Warning: ${resolver.droneId} escalating to ${newAlt}m avoiding ${other.droneId} at T+${timeToConflict}s`);
    } else {
       // Escalation failed, force hover
       action = 'HOVER';
       severity = 'CRITICAL';
       await Drone.updateOne({ droneId: resolver.droneId }, { status: "hovering" });
       droneStateMap.get(resolver.droneId).status = "hovering";
       droneStateMap.get(resolver.droneId).speed = 0;
       io.to(`drone_${resolver.droneId}`).emit('emergency_hover', { droneId: resolver.droneId });
       logger.warn(`[PREDICT] MODERATE Escalate Failed: ${resolver.droneId} forced to HOVER`);
    }

  } else {
    // CRITICAL: Immediate hover required to prevent collision
    severity = 'CRITICAL';
    action = 'HOVER';
    
    await Drone.updateOne({ droneId: resolver.droneId }, { status: "hovering" });
    droneStateMap.get(resolver.droneId).status = "hovering";
    droneStateMap.get(resolver.droneId).speed = 0;
    io.to(`drone_${resolver.droneId}`).emit('emergency_hover', { droneId: resolver.droneId });
    
    logger.warn(`[PREDICT] CRITICAL Warning: ${resolver.droneId} emergency HOVER avoiding ${other.droneId} at T+${timeToConflict}s`);
  }

  // Broadcast warning to Admin UI
  io.to('admin_dashboard').emit('predictive_warning', {
    type: severity,
    drone1: resolver.droneId,
    drone2: other.droneId,
    timeToConflict,
    conflictPoint,
    resolutionAction: action,
    timestamp: Date.now()
  });
}
