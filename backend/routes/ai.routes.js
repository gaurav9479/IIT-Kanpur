import { Router } from "express";
import { 
    getAIHealth, 
    getLanesStatus, 
    predictCongestion, 
    predictETA, 
    predictBattery 
} from "../controllers/ai.controller.js";

const router = Router();

router.get("/health", getAIHealth);
router.get("/lanes", getLanesStatus);
router.post("/predict-congestion", predictCongestion);
router.post("/predict-eta", predictETA);
router.post("/predict-battery", predictBattery);

export default router;
