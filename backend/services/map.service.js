import { NO_FLY_ZONES } from '../config/safety.config.js';

class MapService {
    constructor() {
        // IITK Campus Boundaries (Approximate)
        this.BOUNDS = {
            minLat: 26.5000,
            maxLat: 26.5200,
            minLng: 80.2200,
            maxLng: 80.2500
        };

        this.GRID_SIZE = 100; // 100x100 grid for higher resolution
        this.grid = Array(this.GRID_SIZE).fill().map(() => Array(this.GRID_SIZE).fill(0));
        
        this.initializeMap();
    }

    initializeMap() {
        // Mark No-Fly Zones as obstacles
        NO_FLY_ZONES.forEach((nfz) => {
            const { center, radius } = nfz;
            this.markCircularObstacle(center, radius);
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
        const centerGrid = this.getGridCoords(center.lat, center.lng);
        
        // Convert radius in meters to grid units (Approximate)
        // Lat range: 0.02 deg ~ 2200m -> 1 grid unit ~ 22m
        const gridRadius = Math.ceil(radiusInMeters / 22);

        for (let r = centerGrid.row - gridRadius; r <= centerGrid.row + gridRadius; r++) {
            for (let c = centerGrid.col - gridRadius; c <= centerGrid.col + gridRadius; c++) {
                if (r >= 0 && r < this.GRID_SIZE && c >= 0 && c < this.GRID_SIZE) {
                    const dist = Math.sqrt(Math.pow(r - centerGrid.row, 2) + Math.pow(c - centerGrid.col, 2));
                    if (dist <= gridRadius) {
                        this.grid[r][c] = 1; // Mark as obstacle
                    }
                }
            }
        }
    }

    getGrid() {
        return this.grid;
    }
}

export default new MapService();
