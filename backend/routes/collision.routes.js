import { Router } from "express";
import { getCollisionStats, triggerManualCheck } from "../controllers/collision.controller.js";
import { protect, adminOnly } from "../middleware/auth.js";

const router = Router();

router.use(protect);
router.use(adminOnly);

router.get("/stats", getCollisionStats);
router.post("/check", triggerManualCheck);

export default router;
