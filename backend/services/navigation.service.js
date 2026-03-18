import axios from "axios";
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
import * as campusGraph from "../config/campusGraph.config.js";

const NAV_URL = process.env.NAV_MODULE_URL || "http://localhost:8001";

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
                if (!visited.has(neighbor)) {
                    const currentNode = CAMPUS_NODES.find(n => n.id === current);
                    const neighborNode = CAMPUS_NODES.find(n => n.id === neighbor);

                    // NFZ Check: Skip if the edge between nodes crosses an NFZ
                    if (this.isEdgeInsideNFZ(currentNode, neighborNode)) {
                        continue; 
                    }
                    queue.push([neighbor, [...path, neighbor]]);
                }
            }
        }
        
        return null;
    }

    async get3DRoute(start, end, options = {}) {
        const droneId = options.droneId;

        // 1. Attempt Distributed Microservice Call (External Pathfinding Module)
        try {
            const response = await axios.post(`${NAV_URL}/path`, {
                start,
                end,
                droneId,
                obstacles: options.obstacles || [],
                congestionScores: options.congestionScores || []
            }, { timeout: 2000 }); // 2-second fail-fast timeout

            if (response.data && response.data.path) {
                logger.info(`External Navigation successful for Drone ${droneId}`);
                return response.data;
            }
        } catch (error) {
            logger.warn(`External Navigation Module unreachable/timeout: ${error.message}. Switching to local UTM Navigation Engine.`);
        }

        // 2. Fallback Block - Graph Priority
        try {
            const fromNode = this.findNearestNode(start);
            const toNode = this.findNearestNode(end);
            
            if (!fromNode || !toNode) throw new Error("CANNOT_LOCATE_NEAREST_NODES");

            const graphPathNodes = this.findGraphPath(fromNode.id, toNode.id);
            
            if (!graphPathNodes) {
                throw new Error("NO_GRAPH_PATH");
            }

            // Stitching Logic: [Start] -> [Graph] -> [End]
            // Check NFZ for entry segment: Start -> fromNode
            const entryNFZ = this.isEdgeInsideNFZ(start, fromNode);
            if (entryNFZ) throw new Error(`START_SEGMENT_BLOCKED_BY_${entryNFZ}`);

            // Check NFZ for exit segment: toNode -> End
            const exitNFZ = this.isEdgeInsideNFZ(toNode, end);
            if (exitNFZ) throw new Error(`END_SEGMENT_BLOCKED_BY_${exitNFZ}`);

            const slotIndex = getTimeSlot(Date.now());
            const lane = assignLane(start, end, slotIndex, options.congestionScores || {});
            const altitude = lane ? lane.altitude : 50;

            // Build final path: Start -> middle nodes -> End
            const finalPath = [
                { lat: start.lat, lng: start.lng, z: altitude },
                ...graphPathNodes.map(p => ({ ...p, z: altitude })),
                { lat: end.lat, lng: end.lng, z: altitude }
            ];

            if (lane) {
                reserveSlot(lane.id, slotIndex, droneId);
                logger.info(`[NAV] Reserved Lane ${lane.id} Slot ${slotIndex} for ${droneId}`);
            }

            return {
                path: finalPath,
                distance: distanceCalculator.calculatePathDistance(finalPath),
                lane: lane ? lane.id : null,
                slotIndex,
                altitude,
                laneAssigned: !!lane,
                source: "graph-stitched"
            };
        } catch (error) {
            if (error.message === "NO_GRAPH_PATH") {
                logger.error(`No flight corridor exists between selected nodes.`);
                throw error; // Propagate specific validation error
            }
            // 3. Emergency fallback: attempt a 3-point path to avoid NFZs
            logger.warn(`Fallback routing triggered: ${error.message}`);

            // Check if direct line is blocked
            const blockingZone = this.isEdgeInsideNFZ(start, end);
            
            if (blockingZone) {
                logger.warn(`Direct path blocked by ${blockingZone}. Attempting reroute...`);
                // Simple detour: pick a waypoint offset from the midpoint
                const midLat = (start.lat + end.lat) / 2 + 0.002; // Offset north
                const midLng = (start.lng + end.lng) / 2 + 0.002; // Offset east
                const mid = { lat: midLat, lng: midLng };

                if (!this.isEdgeInsideNFZ(start, mid) && !this.isEdgeInsideNFZ(mid, end)) {
                    const path = [
                        { lat: start.lat, lng: start.lng, z: 50 },
                        { ...mid, z: 50 },
                        { lat: end.lat, lng: end.lng, z: 50 },
                    ];
                    return {
                        path,
                        distance: distanceCalculator.calculatePathDistance(path),
                        lane: 5,
                        laneAssigned: false,
                        altitude: 50,
                    };
                }
            }

            // Absolute last resort (straight line)
            return {
                path: [
                    { lat: start.lat, lng: start.lng, z: 50 },
                    { lat: end.lat,   lng: end.lng,   z: 50 },
                ],
                distance: distanceCalculator.calculate2DDistance(start, end),
                lane: 5,
                laneAssigned: false,
                altitude: 50,
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
}

export default new NavigationService();