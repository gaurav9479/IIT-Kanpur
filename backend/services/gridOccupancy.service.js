class GridOccupancyService {
    constructor() {
        this.occupancyMap = new Map(); // droneId -> { row, col }
        this.gridState = new Map(); // "row,col" -> Set of droneIds
    }

    updateDroneLocation(droneId, row, col) {
        // Remove from old position
        const oldPos = this.occupancyMap.get(droneId);
        if (oldPos) {
            const oldKey = `${oldPos.row},${oldPos.col}`;
            const oldSet = this.gridState.get(oldKey);
            if (oldSet) {
                oldSet.delete(droneId);
                if (oldSet.size === 0) this.gridState.delete(oldKey);
            }
        }

        // Add to new position
        this.occupancyMap.set(droneId, { row, col });
        const newKey = `${row},${col}`;
        if (!this.gridState.has(newKey)) {
            this.gridState.set(newKey, new Set());
        }
        this.gridState.get(newKey).add(droneId);
    }

    isCellSafe(row, col, droneId) {
        const key = `${row},${col}`;
        const dronesInCell = this.gridState.get(key);
        
        if (!dronesInCell) return true;
        
        // Safe if the only drone in the cell is itself
        if (dronesInCell.size === 1 && dronesInCell.has(droneId)) return true;
        
        return false; // Cell is occupied by another drone
    }

    getCongestionData() {
        const data = [];
        for (const [key, drones] of this.gridState.entries()) {
            const [row, col] = key.split(',').map(Number);
            data.push({ x: row, y: col, density: drones.size });
        }
        return data;
    }

    removeDrone(droneId) {
        const pos = this.occupancyMap.get(droneId);
        if (pos) {
            const key = `${pos.row},${pos.col}`;
            const set = this.gridState.get(key);
            if (set) {
                set.delete(droneId);
                if (set.size === 0) this.gridState.delete(key);
            }
        }
        this.occupancyMap.delete(droneId);
    }
}

export default new GridOccupancyService();
