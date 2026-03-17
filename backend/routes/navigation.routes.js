import express from "express";
import {
    getGridPath,
    get3DRoute,
    releaseMission,
    getOccupancy,
} from "../controllers/navigation.controller.js";
import { protect, adminOnly } from "../middleware/auth.js";

const router = express.Router();

// ── EXISTING (tutorial) ───────────────────────
router.post("/grid-path", getGridPath);

// ── MEMBER 2 ADDITIONS (production) ──────────
router.post("/route", protect, get3DRoute);
router.post("/release", protect, releaseMission);
router.get("/occupancy", protect, adminOnly, getOccupancy);

export default router;