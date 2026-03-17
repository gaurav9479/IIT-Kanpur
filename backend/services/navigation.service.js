import axios from "axios";
import logger from "../utils/logger.js";
import mapService from "./map.service.js";
import gridOccupancyService from "./gridOccupancy.service.js";
import { NO_FLY_ZONES } from "../config/safety.config.js";

const NAV_URL = process.env.NAV_MODULE_URL || "http://localhost:5002";

class NavigationService {

    async get3DRoute(start, end, options = {}) {
        const droneId = options.droneId;
        
        // 1. Attempt Distributed Microservice Call (External Pathfinding Module)
        try {
            const response = await axios.post(`${NAV_URL}/path`, {
                start,
                end,
                droneId,
                obstacles: options.obstacles || []
            }, { timeout: 2000 }); // 2-second fail-fast timeout

            if (response.data && response.data.path) {
                logger.info(`External Navigation successful for Drone ${droneId}`);
                return response.data;
            }
        } catch (error) {
            logger.warn(`External Navigation Module unreachable/timeout: ${error.message}. Switching to local UTM Navigation Engine.`);
        }

        // 2. Fallback: Internal A* Logic (Production Grade)
        try {
            const startGrid = mapService.getGridCoords(start.lat, start.lng);
            const endGrid = mapService.getGridCoords(end.lat, end.lng);
            const grid = mapService.getGrid();

            const path = this.runAStar(grid, startGrid, endGrid, droneId);
            
            if (path) {
                // Map grid back to Lat/Lon
                const latLonPath = path.map(p => ({
                    ...mapService.getLatLon(p[0], p[1]),
                    z: 15 // Default cruising altitude
                }));

                return {
                    path: latLonPath,
                    distance: this.calculatePathDistance(latLonPath)
                };
            }

            throw new Error("No safe path found via internal A* engine");
        } catch (error) {
            logger.error(`UTM Critical Navigation Failure: ${error.message}. Generating emergency direct vector.`);
            
            const distance = this.calculateDirectDistance(start, end);
            return {
                path: [
                    { ...start, z: 0 },
                    { ...end, z: 15 }
                ],
                distance
            };
        }
    }

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
                [current.pos[0] - 1, current.pos[1]], [current.pos[0] + 1, current.pos[1]],
                [current.pos[0], current.pos[1] - 1], [current.pos[0], current.pos[1] + 1]
            ];

            for (const [r, c] of neighbors) {
                if (r < 0 || r >= rows || c < 0 || c >= cols || grid[r][c] === 1 || closedSet.has(`${r},${c}`)) continue;

                // Conflict Resolution: Check if another drone is in this cell
                // (Optional: In production we might allow passing through if it's transient, 
                // but for safest-path we avoid it)
                if (!gridOccupancyService.isCellSafe(r, c, droneId)) continue;

                const gScore = current.g + 1;
                const existing = openSet.find(o => o.pos[0] === r && o.pos[1] === c);

                if (!existing) {
                    openSet.push({ pos: [r, c], g: gScore, f: gScore + heuristic([r, c], endPoint), parent: current });
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
            total += this.calculateDirectDistance(path[i], path[i+1]);
        }
        return total;
    }

    calculateDirectDistance(coord1, coord2) {
        const R = 6371e3; 
        const φ1 = coord1.lat * Math.PI/180;
        const φ2 = coord2.lat * Math.PI/180;
        const Δφ = (coord2.lat-coord1.lat) * Math.PI/180;
        const Δλ = (coord2.lng-coord1.lng) * Math.PI/180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }
}

export default new NavigationService();
