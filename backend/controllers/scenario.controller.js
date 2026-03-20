import scenarioService from "../services/scenario.service.js";
import Mission from "../models/Mission.model.js";
import Order from "../models/Order.model.js";
import Drone from "../models/Drone.model.js";
import { io } from "../server.js";

export const runScenario = async (req, res, next) => {
    try {
        const { name } = req.params;
        const result = await scenarioService.runScenario(name);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

export const resetEnvironment = async (req, res, next) => {
    try {
        await Mission.deleteMany({});
        await Order.deleteMany({});
        await Drone.updateMany({}, {
            status: "idle",
            batteryLevel: 100,
            location: { lat: 26.5145, lng: 80.2325 }
        });
        if (io) {
            io.emit("event_log", { message: "🔄 ENVIRONMENT RESET: All missions cleared, drones recharged to 100%.", type: "info" });
            io.emit("scenario_reset", { success: true });
        }
        res.status(200).json({ success: true, message: "Environment reset complete." });
    } catch (error) {
        next(error);
    }
};
