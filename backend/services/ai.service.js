import axios from "axios";
import logger from "../utils/logger.js";

const AI_URL = process.env.AI_MODULE_URL || "http://localhost:8000";

class AIService {
    /**
     * Predicts congestion for a specific lane.
     */
    async predictCongestion(laneId, droneCount, weatherData = {}) {
        const results = await this.predictCongestionBatch([{ laneId, droneCount }], weatherData);
        return results ? results[0] : null;
    }

    /**
     * Predicts congestion for multiple lanes in one call.
     */
    async predictCongestionBatch(laneDataList, weatherData = {}) {
        try {
            const payload = laneDataList.map(item => ({
                lane_id: typeof item.laneId === 'string' ? parseInt(item.laneId.replace('L', '')) : item.laneId,
                hour: new Date().getHours(),
                num_drones: item.droneCount,
                payload_kg: 2.0,
                wind_speed: weatherData.windSpeed || 5.0,
                distance_km: 1.5,
                temperature: weatherData.temperature || 25.0,
                visibility_km: weatherData.visibility || 10.0,
                day_of_week: new Date().getDay(),
                battery_level: 100.0,
                drone_speed_kmh: 40.0,
                hub_distance_km: 1.0
            }));

            const response = await axios.post(`${AI_URL}/predict/congestion/batch`, payload);
            return response.data.predictions;
        } catch (error) {
            logger.error(`[AI-SERVICE] Batch congestion prediction failed: ${error.message}`);
            return null;
        }
    }

    /**
     * Predicts ETA and battery usage for a mission.
     */
    async predictETA(params) {
        try {
            const response = await axios.post(`${AI_URL}/predict/eta`, {
                distance_km: params.distance || 1.0,
                wind_speed: params.windSpeed || 5.0,
                payload_kg: params.payload || 2.0,
                drone_speed_kmh: 40.0,
                num_drones: params.numDrones || 1,
                temperature: params.temperature || 25.0,
                visibility_km: params.visibility || 10.0,
                battery_level: params.batteryLevel || 100.0,
                hour: new Date().getHours(),
                day_of_week: new Date().getDay()
            });
            return response.data;
        } catch (error) {
            logger.error(`[AI-SERVICE] ETA prediction failed: ${error.message}`);
            return null;
        }
    }

    /**
     * Gets status for all lanes.
     */
    async getLanesStatus() {
        try {
            const response = await axios.get(`${AI_URL}/lanes/status`);
            return response.data;
        } catch (error) {
            logger.error(`[AI-SERVICE] Lanes status fetch failed: ${error.message}`);
            return null;
        }
    }
    /**
     * Predict battery drain using the RandomForest ML model (battery_model.pkl).
     * Falls back to ETA-based estimate if model is unavailable.
     */
    async predictBatteryDrain(params) {
        try {
            const response = await axios.post(`${AI_URL}/predict/battery`, {
                distance_km:     params.distance || 1.0,
                wind_speed:      params.windSpeed || 5.0,
                payload_kg:      params.payload || 2.0,
                drone_speed_kmh: params.droneSpeed || 35.0,
                num_drones:      params.numDrones || 1,
                temperature:     params.temperature || 30.0,
                visibility_km:   params.visibility || 8.0,
                battery_level:   params.batteryLevel || 100.0,
                hour:            new Date().getHours(),
                day_of_week:     new Date().getDay(),
            });
            logger.info(`[AI-SERVICE] Battery ML prediction: ${JSON.stringify(response.data)}`);
            return response.data; // { batteryUsed, batteryAfter, drainPerKm, safeToFly, model }
        } catch (error) {
            logger.warn(`[AI-SERVICE] Battery model unavailable, falling back to ETA: ${error.message}`);
            const result = await this.predictETA(params);
            return result ? { batteryUsed: result.batteryUsed, batteryAfter: result.batteryAfter, model: "fallback-eta" } : null;
        }
    }
}

export default new AIService();
