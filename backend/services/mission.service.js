import safetyService from "./safety.service.js";
import {
    ALTITUDE_LANES,
    LANE_CAPACITY,
    VERTICAL_BUFFER,
    TIME_SLOT_DURATION,
    CONGESTION_THRESHOLD,
    BATTERY_LOW,
    EMERGENCY_BATTERY_THRESHOLD
} from "../config/safety.config.js";
import Drone from "../models/Drone.model.js";

// ─── State ───────────────────────────────────────────────
const timeSlotTable = {};       // { "lane_slot": [droneIds] }
const takeoffQueue  = {};       // { hubId: [droneId, ...] }
const landingQueue  = {};       // { hubId: [droneId, ...] }
const droneAssignments = {};    // { droneId: { lane, slot } }

class MissionService {

    // ─── A* Path Planning ──────────────────────────────────
    // graph format expected from Member 1:
    // { nodes: { nodeId: {lat, lng} }, adjacency: { nodeId: [{id, weight}] } }

    astar(graph, startId, endId) {
        if (!graph || !graph.nodes[startId] || !graph.nodes[endId]) {
            console.error("Invalid graph or node IDs");
            return null;
        }

        const openSet  = new Map();
        const cameFrom = {};
        const gScore   = {};
        const fScore   = {};

        gScore[startId] = 0;
        fScore[startId] = this._heuristic(graph.nodes[startId], graph.nodes[endId]);
        openSet.set(startId, fScore[startId]);

        while (openSet.size > 0) {
            // lowest fScore node
            const current = [...openSet.entries()].reduce((a, b) =>
                a[1] < b[1] ? a : b
            )[0];

            if (current === endId) {
                return this._reconstructPath(cameFrom, current);
            }

            openSet.delete(current);

            for (const neighbor of graph.adjacency[current] || []) {
                const tentativeG = (gScore[current] ?? Infinity) + neighbor.weight;

                if (tentativeG < (gScore[neighbor.id] ?? Infinity)) {
                    cameFrom[neighbor.id] = current;
                    gScore[neighbor.id]   = tentativeG;
                    fScore[neighbor.id]   = tentativeG +
                        this._heuristic(graph.nodes[neighbor.id], graph.nodes[endId]);
                    openSet.set(neighbor.id, fScore[neighbor.id]);
                }
            }
        }

        console.error(`No path found from ${startId} to ${endId}`);
        return null; // ← collision.service.js mein None check karna
    }

    _heuristic(nodeA, nodeB) {
        return safetyService.getDistance(nodeA, nodeB);
    }

    _reconstructPath(cameFrom, current) {
        const path = [current];
        while (cameFrom[current]) {
            current = cameFrom[current];
            path.unshift(current);
        }
        return path;
    }

    // ─── Altitude Lane Assignment ──────────────────────────

    assignAltitudeLane(droneId, currentTime, congestionScores = {}) {
        const slot = Math.floor(currentTime / TIME_SLOT_DURATION);

        for (const lane of ALTITUDE_LANES) {
            // AI congestion check (Member 4 ka score)
            const congestion = congestionScores[lane] ?? 0;
            if (congestion >= CONGESTION_THRESHOLD) continue;

            const key    = `${lane}_${slot}`;
            const drones = timeSlotTable[key] || [];

            if (drones.length < LANE_CAPACITY) {
                timeSlotTable[key] = [...drones, droneId];
                droneAssignments[droneId] = { lane, slot };
                return { lane, slot };
            }
        }

        return null; // sab lanes full
    }

    releaseAltitudeLane(droneId) {
        const assignment = droneAssignments[droneId];
        if (!assignment) return;

        const { lane, slot } = assignment;
        const key = `${lane}_${slot}`;
        if (timeSlotTable[key]) {
            timeSlotTable[key] = timeSlotTable[key].filter(id => id !== droneId);
        }
        delete droneAssignments[droneId];
    }

    // ─── Takeoff Queue ─────────────────────────────────────

    addToTakeoffQueue(hubId, droneId) {
        if (!takeoffQueue[hubId]) takeoffQueue[hubId] = [];
        if (!takeoffQueue[hubId].includes(droneId)) {
            takeoffQueue[hubId].push(droneId);
        }
    }

    processNextTakeoff(hubId) {
        return takeoffQueue[hubId]?.shift() ?? null;
    }

    getTakeoffQueueStatus(hubId) {
        return takeoffQueue[hubId] || [];
    }

    // ─── Landing Queue ─────────────────────────────────────

    addToLandingQueue(hubId, droneId) {
        if (!landingQueue[hubId]) landingQueue[hubId] = [];
        if (!landingQueue[hubId].includes(droneId)) {
            landingQueue[hubId].push(droneId);
        }
    }

    processNextLanding(hubId) {
        return landingQueue[hubId]?.shift() ?? null;
    }

    getLandingQueueStatus(hubId) {
        return landingQueue[hubId] || [];
    }

    // ─── Holding Pattern (landing zone busy) ───────────────

    shouldHold(droneId, hubId) {
        const queue = landingQueue[hubId] || [];
        return queue[0] !== droneId; // sirf first wala land kare
    }

    // ─── Drone Assignment Summary ──────────────────────────

    getDroneAssignment(droneId) {
        return droneAssignments[droneId] ?? null;
    }

    getTimeSlotTable() {
        return timeSlotTable;
    }
}

export default new MissionService();