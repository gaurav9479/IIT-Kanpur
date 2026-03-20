import logger from "../utils/logger.js";
import mapService from "./map.service.js";
import gridOccupancyService from "./gridOccupancy.service.js";
import distanceCalculator from "../utils/distanceCalculator.js";
import safetyService from "./safety.service.js";
import {
    ALTITUDE_LANES,
    TIME_SLOT_DURATION_S,
    MAX_DRONES_PER_SLOT,
    NO_FLY_ZONES
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

    findNearestNode(location) {
        const { CAMPUS_NODES } = campusGraph;
        let nearest = null;
        let minDist = Infinity;
        
        for (const node of CAMPUS_NODES) {
            const dist = Math.sqrt(
                Math.pow(node.lat - location.lat, 2) +
                Math.pow(node.lng - location.lng, 2)
            );
            if (dist < minDist) {
                minDist = dist;
                nearest = node;
            }
        }
        return nearest;
    }

    /**
     * Checks if the line segment from p1 to p2 intersects with any NO_FLY_ZONE
     */
    isEdgeInsideNFZ(p1, p2) {
        for (const zone of NO_FLY_ZONES) {
            const poly = zone.positions;
            for (let i = 0; i < poly.length; i++) {
                const a = poly[i];
                const b = poly[(i + 1) % poly.length];
                if (this.doSegmentsIntersect(p1, p2, a, b)) {
                    return zone.name;
                }
            }
            // Also check if either point is INSIDE (redundant but safe)
            if (safetyService.isInsideNFZ(p1) || safetyService.isInsideNFZ(p2)) {
                return zone.name;
            }
        }
        return null;
    }

    /**
     * Helper to check if segment (p1,p2) intersects (p3,p4)
     */
    doSegmentsIntersect(p1, p2, p3, p4) {
        const ccw = (A, B, C) => (C.lat - A.lat) * (B.lng - A.lng) > (B.lat - A.lat) * (C.lng - A.lng);
        return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
    }

    getZoneCenterAndRadius(zoneName) {
        const zone = NO_FLY_ZONES.find(z => z.name === zoneName);
        if (!zone) return null;
        let sumLat = 0, sumLng = 0;
        zone.positions.forEach(p => { sumLat += p.lat; sumLng += p.lng; });
        const center = { lat: sumLat / zone.positions.length, lng: sumLng / zone.positions.length };
        
        let maxDist = 0;
        zone.positions.forEach(p => {
            const d = Math.sqrt(Math.pow(p.lat - center.lat, 2) + Math.pow(p.lng - center.lng, 2));
            if (d > maxDist) maxDist = d;
        });
        return { center, radius: maxDist };
    }

    /**
     * Check if a node's coordinates fall inside any NFZ polygon.
     * Used to filter BFS so drones never route through red zones.
     */
    isNodeInsideNFZ(nodeId) {
        const { CAMPUS_NODES } = campusGraph;
        const node = CAMPUS_NODES.find(n => n.id === nodeId);
        if (!node) return false;
        return !!safetyService.isInsideNFZ({ lat: node.lat, lng: node.lng });
    }

    findGraphPath(fromNodeId, toNodeId) {
        const { ADJACENCY, CAMPUS_NODES } = campusGraph;
        
        if (!ADJACENCY[fromNodeId] || !ADJACENCY[toNodeId]) {
            return null; // node not in graph
        }
        
        const visited = new Set();
        const queue = [[fromNodeId, [fromNodeId]]];
        
        while (queue.length > 0) {
            const [current, path] = queue.shift();
            
            if (current === toNodeId) {
                return path.map(nodeId => {
                    const node = CAMPUS_NODES.find(n => n.id === nodeId);
                    return { 
                        lat: node.lat, 
                        lng: node.lng, 
                        z: 50,
                        nodeId,
                        nodeName: node.name
                    };
                });
            }
            
            if (visited.has(current)) continue;
            visited.add(current);
            
            const neighbors = ADJACENCY[current] || [];
            for (const neighbor of neighbors) {
                // SKIP neighbors that are inside No-Fly Zones
                // (source and destination are allowed, only intermediate nodes blocked)
                if (!visited.has(neighbor)) {
                    if (neighbor !== fromNodeId && neighbor !== toNodeId && this.isNodeInsideNFZ(neighbor)) {
                        continue; // skip NFZ node — drone goes around
                    }
                    queue.push([neighbor, [...path, neighbor]]);
                }
            }
        }
        
        return null;
    }

    // ─────────────────────────────────────────────
    // A* GRID PATHFINDING — Routes around NFZ areas
    // Builds an 80x80 occupancy grid, marks NFZ cells
    // as blocked, runs A* with 8-dir movement, smooths.
    // ─────────────────────────────────────────────
    findAStarRoute(start, end) {
        const GRID = 150; // High resolution (increased from 120)
        const BOUNDS = {
            minLat: 26.5090, maxLat: 26.5215,
            minLng: 80.2240, maxLng: 80.2395
        };
        const latStep = (BOUNDS.maxLat - BOUNDS.minLat) / GRID;
        const lngStep = (BOUNDS.maxLng - BOUNDS.minLng) / GRID;

        // Build occupancy grid (1 = blocked by NFZ, 0 = safe)
        const grid = [];
        for (let r = 0; r < GRID; r++) {
            grid[r] = [];
            for (let c = 0; c < GRID; c++) {
                const lat = BOUNDS.minLat + r * latStep;
                const lng = BOUNDS.minLng + c * lngStep;
                grid[r][c] = safetyService.isInsideNFZ({ lat, lng }) ? 1 : 0;
            }
        }

        // Safety Buffer: Expand blocked areas by 1 cell only (150 grid = ~10m accuracy)
        const finalGrid = grid.map(row => [...row]);
        for (let r = 1; r < GRID - 1; r++) {
            for (let c = 1; c < GRID - 1; c++) {
                if (grid[r][c] === 1) {
                    finalGrid[r-1][c] = 1; finalGrid[r+1][c] = 1;
                    finalGrid[r][c-1] = 1; finalGrid[r][c+1] = 1;
                }
            }
        }

        // Convert lat/lng to grid cell
        const toCell = (lat, lng) => ({
            r: Math.max(0, Math.min(GRID - 1, Math.round((lat - BOUNDS.minLat) / latStep))),
            c: Math.max(0, Math.min(GRID - 1, Math.round((lng - BOUNDS.minLng) / lngStep)))
        });

        // Convert grid cell to lat/lng
        const toLatLng = (r, c) => ({
            lat: BOUNDS.minLat + r * latStep,
            lng: BOUNDS.minLng + c * lngStep
        });

        const sc = toCell(start.lat, start.lng);
        const ec = toCell(end.lat, end.lng);

        // Force start/end cells open
        finalGrid[sc.r][sc.c] = 0;
        finalGrid[ec.r][ec.c] = 0;

        // A* algorithm
        const heuristic = (r1, c1, r2, c2) => Math.sqrt((r1-r2)**2 + (c1-c2)**2);
        const openSet = [{ r: sc.r, c: sc.c, g: 0, f: heuristic(sc.r, sc.c, ec.r, ec.c), parent: null }];
        const closed = new Set();

        while (openSet.length > 0) {
            openSet.sort((a, b) => a.f - b.f);
            const cur = openSet.shift();

            if (cur.r === ec.r && cur.c === ec.c) {
                // Reconstruct raw path
                const raw = [];
                let t = cur;
                while (t) { raw.push([t.r, t.c]); t = t.parent; }
                raw.reverse();

                // ── TURNING-POINT PRESERVAL SMOOTHING ─────────────────
                // Keep first + last always, every minStep-th point, AND
                // any point where direction changes (NFZ boundary corner).
                // Guarantees detour curvature is preserved in final path.
                const MAX_WP  = 50;
                const minStep = Math.max(1, Math.floor(raw.length / MAX_WP));
                const smoothed = [raw[0]];

                for (let i = 1; i < raw.length - 1; i++) {
                    const prev = raw[i - 1];
                    const curr = raw[i];
                    const next = raw[i + 1];
                    const dr1 = curr[0] - prev[0];
                    const dc1 = curr[1] - prev[1];
                    const dr2 = next[0] - curr[0];
                    const dc2 = next[1] - curr[1];
                    const isTurn = (dr1 !== dr2) || (dc1 !== dc2);
                    const isStep = (i % minStep === 0);
                    if (isTurn || isStep) {
                        smoothed.push(curr);
                    }
                }
                smoothed.push(raw[raw.length - 1]);
                // ──────────────────────────────────────────────────────

                return smoothed.map(([r, c]) => {
                    const ll = toLatLng(r, c);
                    return { lat: ll.lat, lng: ll.lng, z: 50 };
                });
            }

            const key = `${cur.r},${cur.c}`;
            if (closed.has(key)) continue;
            closed.add(key);

            // 8-directional neighbors
            for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]) {
                const nr = cur.r + dr;
                const nc = cur.c + dc;
                if (nr < 0 || nr >= GRID || nc < 0 || nc >= GRID) continue;
                if (finalGrid[nr][nc] === 1) continue;
                if (closed.has(`${nr},${nc}`)) continue;

                const g = cur.g + (dr && dc ? 1.414 : 1);
                const existing = openSet.find(o => o.r === nr && o.c === nc);

                if (!existing) {
                    openSet.push({ r: nr, c: nc, g, f: g + heuristic(nr, nc, ec.r, ec.c), parent: cur });
                } else if (g < existing.g) {
                    existing.g = g;
                    existing.f = g + heuristic(nr, nc, ec.r, ec.c);
                    existing.parent = cur;
                }
            }
        }

        logger.warn('[NAV] A* grid pathfinding found no route.');
        return null;
    }

    async get3DRoute(start, end, options = {}) {
        const droneId = options.droneId;

        // ── A* GRID PATHFINDING — ONLY ALGORITHM ────────────────
        // Builds a 150×150 grid over the campus, marks all NFZ cells
        // with a safety buffer, and finds the optimal safe path.
        // No fallbacks. If A* cannot find a route, the mission is rejected.
        // ─────────────────────────────────────────────────────────
        const astarPath = this.findAStarRoute(start, end);

        if (!astarPath || astarPath.length < 2) {
            logger.error(`[NAV] A* found no safe route for ${droneId}. Mission rejected — no straight-line or alternative fallback.`);
            throw new Error(`No safe A* route found between the specified coordinates. Adjust start/end points away from NFZ boundaries.`);
        }

        const slotIndex = getTimeSlot(Date.now());
        const lane = assignLane(start, end, slotIndex, options.congestionScores || {});
        const altitude = options.operatingAltitude || (lane ? lane.altitude : 50);

        if (lane) {
            reserveSlot(lane.id, slotIndex, droneId);
            logger.info(`[NAV] Reserved Lane ${lane.id} Slot ${slotIndex} for ${droneId}`);
        }

        logger.info(`[NAV] A* route: ${astarPath.length} waypoints for ${droneId} | altitude: ${altitude}m`);
        return {
            path: astarPath.map(p => ({ ...p, z: altitude })),
            distance: distanceCalculator.calculatePathDistance(astarPath),
            lane: lane ? lane.id : null,
            slotIndex,
            altitude,
            laneAssigned: !!lane,
            source: "astar-grid"
        };
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
}

export default new NavigationService();