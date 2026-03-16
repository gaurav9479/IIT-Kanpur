
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
        const dLat = (pos2.lat - pos1.lat) * Math.PI / 180;
        const dLng = (pos2.lng - pos1.lng) * Math.PI / 180;
        
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(pos1.lat * Math.PI / 180) * Math.cos(pos2.lat * Math.PI / 180) *
                  Math.sin(dLng / 2) * Math.sin(dLng / 2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const horizontalDistance = this.EARTH_RADIUS_METERS * c;

        const verticalDistance = Math.abs(pos2.altitude - pos1.altitude);

        return Math.sqrt(Math.pow(horizontalDistance, 2) + Math.pow(verticalDistance, 2));
    }
}

export default new DistanceCalculator();
