
class DistanceCalculator {
    constructor() {
        this.EARTH_RADIUS_METERS = 6371000;
    }

    /**
     * Calculates distance between two drones in 3D space (meters)
     * @param {Object} pos1 - { lat, lng, altitude }
     * @param {Object} pos2 - { lat, lng, altitude }
     */
    calculate3DDistance(pos1, pos2) {
        const horizontalDistance = this.calculate2DDistance(pos1, pos2);
        const verticalDistance = Math.abs((pos2.altitude || 0) - (pos1.altitude || 0));
        return Math.sqrt(Math.pow(horizontalDistance, 2) + Math.pow(verticalDistance, 2));
    }

    calculate2DDistance(pos1, pos2) {
        const dLat = (pos2.lat - pos1.lat) * Math.PI / 180;
        const dLng = (pos2.lng - pos1.lng) * Math.PI / 180;
        
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(pos1.lat * Math.PI / 180) * Math.cos(pos2.lat * Math.PI / 180) *
                  Math.sin(dLng / 2) * Math.sin(dLng / 2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return this.EARTH_RADIUS_METERS * c;
    }

    calculatePathDistance(path) {
        let total = 0;
        for (let i = 0; i < path.length - 1; i++) {
            total += this.calculate2DDistance(path[i], path[i + 1]);
        }
        return total;
    }
}

export default new DistanceCalculator();
