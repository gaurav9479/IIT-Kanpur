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
        const cellSet = this.gridState.get(newKey);
        cellSet.add(droneId);

        // --- TRAFFIC WARNING (Validated by AI) ---
        if (cellSet.size >= 3) {
            import('./ai.service.js').then(async (m) => {
                const aiService = m.default;
                // Use a default lane (L1) as grid cells don't map 1:1 to lanes
                // but we want the AI's opinion on '3+ drones' density.
                const aiResult = await aiService.predictCongestion(1, cellSet.size);
                
                import('../server.js').then(({ io }) => {
                    const confidence = aiResult ? `(AI Confidence: ${(aiResult.confidence * 100).toFixed(0)}%)` : '';
                    
                    io.emit("event_log", {
                        message: `🚩 TRAFFIC WARNING: High congestion at Node [${row}, ${col}] — ${cellSet.size} drones active. ${confidence}`,
                        type: "warning"
                    });
                    
                    io.emit("safety_alert", {
                        type: "traffic",
                        droneId: droneId,
                        message: `High density at [${row}, ${col}] ${confidence}`,
                        action: aiResult?.is_congested ? "Urgent: Deploy Detour" : "Monitor Corridor",
                        timestamp: new Date().toISOString()
                    });
                });
            });
        }
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
