import { Router } from "express";
import {
    getCollisionStats,
    triggerManualCheck,
    getQueueStatus,
    requestTakeoff,
    completeTakeoff,
    requestLanding,
    completeLanding,
    handleLostLink,
    handleLowBattery,
} from "../controllers/collision.controller.js";
// import { protect, adminOnly } from "../middleware/auth.js";

const router = Router();

// router.use(protect);
// router.use(adminOnly);

// ── EXISTING ──────────────────────────────────
router.get("/stats", getCollisionStats);
router.post("/check", triggerManualCheck);

// ── MEMBER 2 ADDITIONS ────────────────────────
router.get("/status", getQueueStatus);
router.post("/takeoff", requestTakeoff);
router.post("/takeoff/complete", completeTakeoff);
router.post("/landing", requestLanding);
router.post("/landing/complete", completeLanding);
router.post("/emergency/lost-link", handleLostLink);
router.post("/emergency/low-battery", handleLowBattery);

export default router;