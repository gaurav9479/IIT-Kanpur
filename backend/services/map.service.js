import { NO_FLY_ZONES } from '../config/safety.config.js';

class MapService {
    constructor() {
        // IITK Road Network Bounds (from Drone_Map_IITK.ipynb)
        this.BOUNDS = {
            minLat: 26.5030,
            maxLat: 26.5150,
            minLng: 80.2220,
            maxLng: 80.2360
        };

        this.GRID_SIZE = 100; // 100x100 grid (Scale: ~1.2m per cell)
        this.grid = Array(this.GRID_SIZE).fill().map(() => Array(this.GRID_SIZE).fill(0));
        
        this.initializeMap();
    }

    initializeMap() {
        // Mark No-Fly Zones as obstacles
        NO_FLY_ZONES.forEach((nfz) => {
            if (nfz.positions) {
                this.markPolygonObstacle(nfz.positions);
            } else if (nfz.center && nfz.radius) {
                this.markCircularObstacle(nfz.center, nfz.radius);
            }
        });
    }

    getGridCoords(lat, lng) {
        // Linear mapping from lat/lng to [0, GRID_SIZE-1]
        const row = Math.floor(((lat - this.BOUNDS.minLat) / (this.BOUNDS.maxLat - this.BOUNDS.minLat)) * this.GRID_SIZE);
        const col = Math.floor(((lng - this.BOUNDS.minLng) / (this.BOUNDS.maxLng - this.BOUNDS.minLng)) * this.GRID_SIZE);

        return {
            row: Math.max(0, Math.min(this.GRID_SIZE - 1, row)),
            col: Math.max(0, Math.min(this.GRID_SIZE - 1, col))
        };
    }

    getLatLon(row, col) {
        const lat = this.BOUNDS.minLat + (row / this.GRID_SIZE) * (this.BOUNDS.maxLat - this.BOUNDS.minLat);
        const lng = this.BOUNDS.minLng + (col / this.GRID_SIZE) * (this.BOUNDS.maxLng - this.BOUNDS.minLng);
        
        return { lat, lng };
    }

    markCircularObstacle(center, radiusInMeters) {
        if (!center) return;
        const centerGrid = this.getGridCoords(center.lat, center.lng);
        
        // Convert radius in meters to grid units (Approximate)
        const gridRadius = Math.ceil(radiusInMeters / 22);

        for (let r = centerGrid.row - gridRadius; r <= centerGrid.row + gridRadius; r++) {
            for (let c = centerGrid.col - gridRadius; c <= centerGrid.col + gridRadius; c++) {
                if (r >= 0 && r < this.GRID_SIZE && c >= 0 && c < this.GRID_SIZE) {
                    const dist = Math.sqrt(Math.pow(r - centerGrid.row, 2) + Math.pow(c - centerGrid.col, 2));
                    if (dist <= gridRadius) {
                        this.grid[r][c] = 1; 
                    }
                }
            }
        }
    }

    markPolygonObstacle(positions) {
        // Brute force check all grid cells (100x100 = 10,000 checks, super fast)
        for (let r = 0; r < this.GRID_SIZE; r++) {
            for (let c = 0; c < this.GRID_SIZE; c++) {
                const coord = this.getLatLon(r, c);
                if (this.isPointInPolygon(coord, positions)) {
                    this.grid[r][c] = 1;
                }
            }
        }
    }

    isPointInPolygon(point, polygon) {
        let isInside = false;
        const x = point.lat;
        const y = point.lng;

        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].lat, yi = polygon[i].lng;
            const xj = polygon[j].lat, yj = polygon[j].lng;

            const intersect = ((yi > y) !== (yj > y)) &&
                (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) isInside = !isInside;
        }
        return isInside;
    }

    getGrid() {
        return this.grid;
    }
}

export default new MapService();
