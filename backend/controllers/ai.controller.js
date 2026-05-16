import aiService from "../services/ai.service.js";
import axios from "axios";
import logger from "../utils/logger.js";

const AI_URL = process.env.AI_MODULE_URL || "http://localhost:8000";

export const getAIHealth = async (req, res) => {
    try {
        const response = await axios.get(`${AI_URL}/health`, { timeout: 10000 });
        res.status(200).json(response.data);
    } catch (error) {
        logger.error(`[AI-CONTROLLER] Health check failed: ${error.message}`);
        res.status(503).json({ status: "offline", error: error.message });
    }
};

export const getLanesStatus = async (req, res) => {
    try {
        const data = await aiService.getLanesStatus();
        if (!data) {
            return res.status(503).json({ success: false, message: "AI module unreachable" });
        }
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const predictCongestion = async (req, res) => {
    try {
        const data = await aiService.predictCongestion(
            req.body.lane_id,
            req.body.num_drones,
            req.body
        );
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const predictETA = async (req, res) => {
    try {
        const data = await aiService.predictETA(req.body);
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const predictBattery = async (req, res) => {
    try {
        const data = await aiService.predictBatteryDrain(req.body);
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
