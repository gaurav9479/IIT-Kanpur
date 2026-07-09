import logger from "../utils/logger.js";
import mapService from "./map.service.js";
import gridOccupancyService from "./gridOccupancy.service.js";
import distanceCalculator from "../utils/distanceCalculator.js";
import safetyService from "./safety.service.js";
import zoneService from "./zone.service.js";
import {
    ALTITUDE_LANES,
    TIME_SLOT_DURATION_S,
    MAX_DRONES_PER_SLOT,
} from "../config/safety.config.js";
import altitudeManager from "./altitudeManager.js";
import * as campusGraph from "../config/campusGraph.config.js";


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
     * Checks if the line segment from p1 to p2 intersects with any active NO_FLY zone
     */
    isEdgeInsideNFZ(p1, p2) {
        const activeNoFlyZones = zoneService.getActiveNoFlyZones();
        for (const zone of activeNoFlyZones) {
            const poly = zone.positions;
            for (let i = 0; i < poly.length; i++) {
                const a = poly[i];
                const b = poly[(i + 1) % poly.length];
                if (this.doSegmentsIntersect(p1, p2, a, b)) {
                    return zone.name;
                }
            }
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
        const zone = zoneService.getActiveNoFlyZones().find(z => z.name === zoneName);
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
     * Check if a node's coordinates fall inside any active NFZ polygon.
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
            return null;
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
                        z: 80,
                        nodeId,
                        nodeName: node.name
                    };
                });
            }
            
            if (visited.has(current)) continue;
            visited.add(current);
            
            const neighbors = ADJACENCY[current] || [];
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    if (neighbor !== fromNodeId && neighbor !== toNodeId && this.isNodeInsideNFZ(neighbor)) {
                        continue;
                    }
                    queue.push([neighbor, [...path, neighbor]]);
                }
            }
        }
        
        return null;
    }

    findAStarRoute(start, end) {
        const GRID = 200;
        const BOUNDS = {
            minLat: 26.5070, maxLat: 26.5230,
            minLng: 80.2220, maxLng: 80.2420
        };
        const latStep = (BOUNDS.maxLat - BOUNDS.minLat) / GRID;
        const lngStep = (BOUNDS.maxLng - BOUNDS.minLng) / GRID;

        const RESTRICTED_COST = 5.0;
        const grid = [];

        const activeNoFly = zoneService.getActiveNoFlyZones();
        const activeRestricted = zoneService.getActiveRestrictedZones();
        const tempBlocks = altitudeManager.getTemporaryBlocks();

        // Identify if start/end points are inside a Restricted Zone to allow normal cost passage
        const startRestricted = activeRestricted.find(z => safetyService.isPointInPolygon(start, z.positions));
        const endRestricted   = activeRestricted.find(z => safetyService.isPointInPolygon(end,   z.positions));

        for (let r = 0; r < GRID; r++) {
            grid[r] = [];
            for (let c = 0; c < GRID; c++) {
                const lat = BOUNDS.minLat + r * latStep;
                const lng = BOUNDS.minLng + c * lngStep;
                const pt = { lat, lng };

                // Check NO_FLY (STRICT hard block)
                let blocked = false;
                for (const zone of activeNoFly) {
                    if (safetyService.isPointInPolygon(pt, zone.positions)) {
                        blocked = true;
                        break;
                    }
                }
                if (blocked) { grid[r][c] = 1; continue; }

                // Check RESTRICTED (soft cost)
                let cost = 0;
                for (const zone of activeRestricted) {
                    if (safetyService.isPointInPolygon(pt, zone.positions)) {
                        // EXCEPTION: If this is the Restricted Zone containing our target, cost is normal (0)
                        if (zone.id === startRestricted?.id || zone.id === endRestricted?.id) {
                            cost = 0;
                        } else {
                            cost = RESTRICTED_COST;
                        }
                        break;
                    }
                }
                
                // Check Temporary Predictive Collision Blocks (soft cost)
                if (cost === 0) {
                    for (const tb of tempBlocks) {
                        const dist = distanceCalculator.calculateDistance(pt.lat, pt.lng, tb.lat, tb.lng);
                        // tb.radius is in meters, distanceCalculator returns km by default usually, wait, let's assume it returns km
                        // distanceCalculator.calculateDistance returns km. tb.radius is in meters.
                        if (dist * 1000 <= tb.radius) {
                            cost = RESTRICTED_COST;
                            break;
                        }
                    }
                }
                grid[r][c] = cost;
            }
        }

        // Safety buffer: expand hard-blocked cells by 1 cell
        const finalGrid = grid.map(row => [...row]);

        for (let r = 1; r < GRID - 1; r++) {
            for (let c = 1; c < GRID - 1; c++) {
                if (grid[r][c] === 1) {
                    finalGrid[r-1][c] = 1; finalGrid[r+1][c] = 1;
                    finalGrid[r][c-1] = 1; finalGrid[r][c+1] = 1;
                }
            }
        }

        // Convert lat/lng ↔ grid cell
        const toCell = (lat, lng) => ({
            r: Math.max(0, Math.min(GRID - 1, Math.round((lat - BOUNDS.minLat) / latStep))),
            c: Math.max(0, Math.min(GRID - 1, Math.round((lng - BOUNDS.minLng) / lngStep)))
        });
        const toLatLng = (r, c) => ({
            lat: BOUNDS.minLat + r * latStep,
            lng: BOUNDS.minLng + c * lngStep
        });

        const sc = toCell(start.lat, start.lng);
        const ec = toCell(end.lat, end.lng);

        // Force start/end cells and their neighbors open (2-cell radius) to ensure connectivity
        for (let dr = -2; dr <= 2; dr++) {
            for (let dc = -2; dc <= 2; dc++) {
                const r = sc.r + dr;
                const c = sc.c + dc;
                if (finalGrid[r]?.[c] === 1) finalGrid[r][c] = 0;
                
                const er = ec.r + dr;
                const ec_ = ec.c + dc;
                if (finalGrid[er]?.[ec_] === 1) finalGrid[er][ec_] = 0;
            }
        }
        finalGrid[sc.r][sc.c] = 0;
        finalGrid[ec.r][ec.c] = 0;

        // A* — g-cost uses cell value as movement cost multiplier
        const heuristic = (r1, c1, r2, c2) => Math.sqrt((r1-r2)**2 + (c1-c2)**2);
        const openSet = [{ r: sc.r, c: sc.c, g: 0, f: heuristic(sc.r, sc.c, ec.r, ec.c), parent: null }];
        const closed = new Set();
        const gMap = new Map();
        gMap.set(`${sc.r},${sc.c}`, 0);

        while (openSet.length > 0) {
            openSet.sort((a, b) => a.f - b.f);
            const cur = openSet.shift();

            if (cur.r === ec.r && cur.c === ec.c) {
                // Reconstruct raw path
                const raw = [];
                let t = cur;
                while (t) { raw.push([t.r, t.c]); t = t.parent; }
                raw.reverse();

                // Smoothing with turning-point preservation
                const MAX_WP  = 50;
                const minStep = Math.max(1, Math.floor(raw.length / MAX_WP));
                const smoothed = [raw[0]];
                for (let i = 1; i < raw.length - 1; i++) {
                    const prev = raw[i - 1], curr = raw[i], next = raw[i + 1];
                    const isTurn = (curr[0]-prev[0] !== next[0]-curr[0]) || (curr[1]-prev[1] !== next[1]-curr[1]);
                    if (isTurn || i % minStep === 0) smoothed.push(curr);
                }
                smoothed.push(raw[raw.length - 1]);

                return smoothed.map(([r, c]) => {
                    const ll = toLatLng(r, c);
                    return { lat: ll.lat, lng: ll.lng };
                });
            }

            const key = `${cur.r},${cur.c}`;
            if (closed.has(key)) continue;
            closed.add(key);

            for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]) {
                const nr = cur.r + dr;
                const nc = cur.c + dc;
                if (nr < 0 || nr >= GRID || nc < 0 || nc >= GRID) continue;
                if (finalGrid[nr][nc] === 1) continue; // hard block
                if (closed.has(`${nr},${nc}`)) continue;

                // Movement cost: base (diagonal = 1.414, cardinal = 1) × cell multiplier
                const cellCost = finalGrid[nr][nc] > 1 ? finalGrid[nr][nc] : 1;
                const moveCost = (dr && dc ? 1.414 : 1) * cellCost;
                const g = cur.g + moveCost;
                const nk = `${nr},${nc}`;

                if (!gMap.has(nk) || g < gMap.get(nk)) {
                    gMap.set(nk, g);
                    const existing = openSet.find(o => o.r === nr && o.c === nc);
                    if (existing) {
                        existing.g = g;
                        existing.f = g + heuristic(nr, nc, ec.r, ec.c);
                        existing.parent = cur;
                    } else {
                        openSet.push({ r: nr, c: nc, g, f: g + heuristic(nr, nc, ec.r, ec.c), parent: cur });
                    }
                }
            }
        }

        logger.warn('[NAV] A* grid pathfinding found no route.');
        return null;
    }

    async get3DRoute(start, end, options = {}) {
        const droneId = options.droneId;
        let altitude = options.operatingAltitude || 80;
        const astarPath = this.findAStarRoute(start, end);

        if (!astarPath || astarPath.length < 2) {
            logger.error(`[NAV] A* found no safe route for ${droneId}. Mission rejected.`);
            throw new Error(`No safe A* route found between the specified coordinates.`);
        }

        const slotIndex = getTimeSlot(Date.now());
        const lane = assignLane(start, end, slotIndex, options.congestionScores || {});
        if (lane) {
            altitude = options.operatingAltitude || lane.altitude;
        }

        if (lane) {
            reserveSlot(lane.id, slotIndex, droneId);
        }

        // Add vertical segments for takeoff and landing
        const fullPath = [
            { lat: start.lat, lng: start.lng, z: 0 },
            { lat: start.lat, lng: start.lng, z: altitude },
            ...astarPath.map(p => ({ ...p, z: altitude })),
            { lat: end.lat, lng: end.lng, z: altitude },
            { lat: end.lat, lng: end.lng, z: 0 }
        ];

        return {
            path: fullPath,
            distance: distanceCalculator.calculatePathDistance(astarPath),
            lane: lane ? lane.id : null,
            slotIndex,
            altitude,
            source: "astar-grid"
        };
    }

    async getFullMissionPath(hub, pickup, drop, options = {}) {
        const droneId = options.droneId;
        const altitude = options.operatingAltitude || 80;

        // Leg 1: Hub to Pickup
        const path1 = this.findAStarRoute(hub, pickup);
        if (!path1) throw new Error("Mission planning failed: Cannot find safe route from Hub to Pickup point. Target may be inside a restricted zone.");

        // Leg 2: Pickup to Drop
        const path2 = this.findAStarRoute(pickup, drop);
        if (!path2) throw new Error("Mission planning failed: Cannot find safe route from Pickup to Drop-off point. Destination may be inside a restricted zone.");

        // Leg 3: Drop to Hub
        const path3 = this.findAStarRoute(drop, hub);
        if (!path3) throw new Error("Mission planning failed: Cannot find safe route back to Hub from Drop-off point.");

        const combinedPath = [
            // --- HUB TAKEOFF ---
            { lat: hub.lat, lng: hub.lng, z: 0, phase: "Hub Takeoff" },
            { lat: hub.lat, lng: hub.lng, z: altitude, phase: "Hub Takeoff" },
            
            // --- CRUISE TO PICKUP ---
            ...path1.map(p => ({ ...p, z: altitude, phase: "To Pickup" })),
            
            // --- PICKUP LANDING ---
            { lat: pickup.lat, lng: pickup.lng, z: altitude, phase: "Pickup Approach" },
            { lat: pickup.lat, lng: pickup.lng, z: 0, phase: "Pickup Approach" },
            
            // --- WAIT AT PICKUP (Simulated loading) ---
            { lat: pickup.lat, lng: pickup.lng, z: 0, phase: "Loading Package" },
            { lat: pickup.lat, lng: pickup.lng, z: 0, phase: "Loading Package" },
            
            // --- PICKUP TAKEOFF ---
            { lat: pickup.lat, lng: pickup.lng, z: altitude, phase: "Pickup Takeoff" },
            
            // --- CRUISE TO DROP ---
            ...path2.map(p => ({ ...p, z: altitude, phase: "Active Delivery" })),
            
            // --- DROP LANDING ---
            { lat: drop.lat, lng: drop.lng, z: altitude, phase: "Delivery Approach" },
            { lat: drop.lat, lng: drop.lng, z: 0, phase: "Delivery Approach" },
            
            // --- WAIT AT DROP (Simulated delivery) ---
            { lat: drop.lat, lng: drop.lng, z: 0, phase: "Dropping Package" },
            { lat: drop.lat, lng: drop.lng, z: 0, phase: "Dropping Package" },
            
            // --- DROP TAKEOFF ---
            { lat: drop.lat, lng: drop.lng, z: altitude, phase: "RTH Takeoff" },
            
            // --- CRUISE TO HUB ---
            ...path3.map(p => ({ ...p, z: altitude, phase: "Returning to Hub" })),
            
            // --- HUB LANDING ---
            { lat: hub.lat, lng: hub.lng, z: altitude, phase: "Final Approach" },
            { lat: hub.lat, lng: hub.lng, z: 0, phase: "Landed" }
        ];

        return {
            path: combinedPath,
            distance: distanceCalculator.calculatePathDistance([...path1, ...path2, ...path3]),
            altitude,
            source: "astar-grid-lifecycle"
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
    // A* (grid-based — original interface unchanged)
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