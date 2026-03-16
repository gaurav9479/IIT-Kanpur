import { Router } from "express";
import { getFleetHealth, getMissionStats } from "../controllers/analytics.controller.js";

import { protect, adminOnly } from "../middleware/auth.js";

const router = Router();

router.use(protect);
router.use(adminOnly); // Only admins see analytics

router.get("/health", getFleetHealth);
router.get("/missions", getMissionStats);

export default router;
