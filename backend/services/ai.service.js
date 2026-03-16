import axios from "axios";
import logger from "../utils/logger.js";

const AI_URL = process.env.AI_MODULE_URL || "http://localhost:8000";

class AIService {
    /**
     * Calls Random Forest Classifier for congestion prediction
     */
    async predictCongestion(numDrones, area, avgSpeed, timeOfDay) {
        try {
            const response = await axios.post(`${AI_URL}/predict/congestion`, {
                number_of_drones: numDrones,
                sector_area: area,
                avg_speed: avgSpeed,
                time_of_day: timeOfDay
            });
            return response.data.congestion_level; // low / medium / high
        } catch (error) {
            logger.error(`AI Congestion Prediction Error: ${error.message}`);
            return "low"; 
        }
    }


    async predictETA(data) {
        try {
            const response = await axios.post(`${AI_URL}/predict/eta`, {
                distance: data.distance,
                wind_speed: data.windSpeed || 0,
                drone_speed: data.droneSpeed,
                congestion_level: data.congestionLevel,
                payload_weight: data.payloadWeight
            });
            return response.data.eta_minutes;
        } catch (error) {
            logger.error(`AI ETA Prediction Error: ${error.message}`);
            return (data.distance / 15) * 60; // Fallback to simple math
        }
    }


    async predictBatteryDrain(data) {
        try {

            const response = await axios.post(`${AI_URL}/predict/battery`, {
                distance: data.distance,
                payload: data.payloadWeight,
                wind: data.windSpeed || 0,
                altitude: data.altitude,
                speed: data.droneSpeed
            });
            return response.data.predicted_drain;
        } catch (error) {
            logger.error(`AI Battery Prediction Error: ${error.message}`);
            return (data.distance / 1000) * 10; // Fallback: 10% per km
        }
    }
}

export default new AIService();
