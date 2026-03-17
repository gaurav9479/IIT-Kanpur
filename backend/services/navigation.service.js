import logger from "../utils/logger.js";
import mapService from "./map.service.js";
import gridOccupancyService from "./gridOccupancy.service.js";
import {
    ALTITUDE_LANES,
    TIME_SLOT_DURATION_S,
    MAX_DRONES_PER_SLOT,
} from "../config/safety.config.js";

// ─────────────────────────────────────────────
// TIME-SLOT OCCUPANCY TABLE
// Key: "laneId_slotIndex" → [droneIds]
// ─────────────────────────────────────────────
const occupancyTable = {};

function getSlotKey(laneId, slotIndex) {
    return `${laneId}_${slotIndex}`;
}

function getTimeSlot(timestampMs) {
    return Math.floor(timestampMs / (TIME_SLOT_DURATION_S * 1000));
}

function isSlotAvailable(laneId, slotIndex) {
    const key = getSlotKey(laneId, slotIndex);
    return (occupancyTable[key] || []).length < MAX_DRONES_PER_SLOT;
}

function reserveSlot(laneId, slotIndex, droneId) {
    const key = getSlotKey(laneId, slotIndex);
    if (!occupancyTable[key]) occupancyTable[key] = [];

    if (occupancyTable[key].length >= MAX_DRONES_PER_SLOT) {
        return { success: false, reason: "Slot full" };
    }

    occupancyTable[key].push(droneId);
    return { success: true };
}

function releaseSlot(laneId, slotIndex, droneId) {
    const key = getSlotKey(laneId, slotIndex);
    if (!occupancyTable[key]) return;
    occupancyTable[key] = occupancyTable[key].filter((id) => id !== droneId);
}

// ─────────────────────────────────────────────
// LANE ASSIGNMENT
// ─────────────────────────────────────────────
function detectPathDirection(start, end) {
    const dLat = Math.abs(end.lat - start.lat);
    const dLng = Math.abs(end.lng - start.lng);
    return dLat >= dLng ? "NORTH_SOUTH" : "EAST_WEST";
}

function assignLane(start, end, slotIndex, congestionScores = {}) {
    const direction = detectPathDirection(start, end);

    const candidateLanes = ALTITUDE_LANES.filter(
        (lane) => lane.direction === direction
    );

    const sorted = candidateLanes.sort((a, b) => {
        const scoreA = congestionScores[a.id] ?? 0;
        const scoreB = congestionScores[b.id] ?? 0;
        return scoreA - scoreB;
    });

    for (const lane of sorted) {
        if (isSlotAvailable(lane.id, slotIndex)) {
            return lane;
        }
    }

    return null;
}

// ─────────────────────────────────────────────
// NAVIGATION SERVICE
// ─────────────────────────────────────────────
class NavigationService {

    async get3DRoute(start, end, options = {}) {
        const droneId = options.droneId;
        const congestionScores = options.congestionScores || {};

        try {
            const startGrid = mapService.getGridCoords(start.lat, start.lng);
            const endGrid = mapService.getGridCoords(end.lat, end.lng);
            const grid = mapService.getGrid();

            const path = this.runAStar(grid, startGrid, endGrid, droneId);

            if (!path) throw new Error("No safe path found internal A*");

            const latLonPath = path.map(p => ({
                ...mapService.getLatLon(p[0], p[1]),
                z: 15
            }));

            // ── Lane + Slot Assignment ──
            const slotIndex = getTimeSlot(Date.now());
            const lane = assignLane(start, end, slotIndex, congestionScores);

            if (!lane) {
                logger.warn(`[NAV] All lanes full for drone ${droneId} — slot ${slotIndex}`);
                return {
                    path: latLonPath,
                    distance: this.calculatePathDistance(latLonPath),
                    lane: null,
                    slotIndex,
                    altitude: 15,
                    laneAssigned: false,
                };
            }

            const reservation = reserveSlot(lane.id, slotIndex, droneId);
            if (!reservation.success) {
                logger.warn(`[NAV] Slot reservation failed: ${reservation.reason}`);
            }

            logger.info(
                `[NAV] Drone ${droneId} → Lane ${lane.id} (${lane.altitude}m) | Slot ${slotIndex} | Nodes: ${latLonPath.length}`
            );

            const finalPath = latLonPath.map(p => ({ ...p, z: lane.altitude }));

            return {
                path: finalPath,
                distance: this.calculatePathDistance(finalPath),
                lane,
                slotIndex,
                altitude: lane.altitude,
                laneAssigned: true,
            };

        } catch (error) {
            logger.warn(`[NAV] Internal Navigation Failed: ${error.message}. Falling back to direct path.`);

            const distance = this.calculateDirectDistance(start, end);
            return {
                path: [
                    { ...start, z: 0 },
                    { ...end, z: 15 }
                ],
                distance,
                lane: null,
                laneAssigned: false,
            };
        }
    }

    releaseMission(laneId, slotIndex, droneId) {
        releaseSlot(laneId, slotIndex, droneId);
        logger.info(`[NAV] Drone ${droneId} released from Lane ${laneId} Slot ${slotIndex}`);
    }

    getOccupancySnapshot() {
        return { ...occupancyTable };
    }

    // ─────────────────────────────────────────────
    // A* (original — unchanged)
    // ─────────────────────────────────────────────
    runAStar(grid, start, end, droneId) {
        const rows = grid.length;
        const cols = grid[0].length;
        const startPoint = [start.row, start.col];
        const endPoint = [end.row, end.col];

        const heuristic = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
        const openSet = [{ pos: startPoint, g: 0, f: heuristic(startPoint, endPoint), parent: null }];
        const closedSet = new Set();

        while (openSet.length > 0) {
            openSet.sort((a, b) => a.f - b.f);
            const current = openSet.shift();

            if (current.pos[0] === endPoint[0] && current.pos[1] === endPoint[1]) {
                const path = [];
                let temp = current;
                while (temp) {
                    path.push(temp.pos);
                    temp = temp.parent;
                }
                return path.reverse();
            }

            closedSet.add(`${current.pos[0]},${current.pos[1]}`);

            const neighbors = [
                [current.pos[0] - 1, current.pos[1]],
                [current.pos[0] + 1, current.pos[1]],
                [current.pos[0], current.pos[1] - 1],
                [current.pos[0], current.pos[1] + 1]
            ];

            for (const [r, c] of neighbors) {
                if (
                    r < 0 || r >= rows ||
                    c < 0 || c >= cols ||
                    grid[r][c] === 1 ||
                    closedSet.has(`${r},${c}`)
                ) continue;

                if (!gridOccupancyService.isCellSafe(r, c, droneId)) continue;

                const gScore = current.g + 1;
                const existing = openSet.find(o => o.pos[0] === r && o.pos[1] === c);

                if (!existing) {
                    openSet.push({
                        pos: [r, c],
                        g: gScore,
                        f: gScore + heuristic([r, c], endPoint),
                        parent: current
                    });
                } else if (gScore < existing.g) {
                    existing.g = gScore;
                    existing.f = gScore + heuristic([r, c], endPoint);
                    existing.parent = current;
                }
            }
        }
        return null;
    }

    calculatePathDistance(path) {
        let total = 0;
        for (let i = 0; i < path.length - 1; i++) {
            total += this.calculateDirectDistance(path[i], path[i + 1]);
        }
        return total;
    }

    calculateDirectDistance(coord1, coord2) {
        const R = 6371e3;
        const φ1 = coord1.lat * Math.PI / 180;
        const φ2 = coord2.lat * Math.PI / 180;
        const Δφ = (coord2.lat - coord1.lat) * Math.PI / 180;
        const Δλ = (coord2.lng - coord1.lng) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }
}

export default new NavigationService();