import { Router } from "express";
import { getFleetHealth, getMissionStats, getHistoricalTrends } from "../controllers/analytics.controller.js";
import { protect, restrictTo } from "../middleware/auth.js";

const router = Router();

router.use(protect);
router.use(restrictTo("admin"));

router.get("/health", getFleetHealth);
router.get("/missions", getMissionStats);
router.get("/trends", getHistoricalTrends);

export default router;
