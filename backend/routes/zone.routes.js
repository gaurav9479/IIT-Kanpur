import express from "express";
import {
  getZones,
  createZone,
  updateZone,
  deleteZone,
  toggleZoneVisibility,
} from "../controllers/zone.controller.js";

const router = express.Router();

router.get("/", getZones);
router.post("/", createZone);
router.put("/:id", updateZone);
router.delete("/:id", deleteZone);
router.patch("/:id/toggle", toggleZoneVisibility);

export default router;
