import { Router } from "express";
import { dispatchMission, getAllMissions, getMissionById } from "../controllers/mission.controller.js";
// import { protect, restrictTo } from "../middleware/auth.js";
import validate from "../middleware/validate.js";
import { missionDispatchSchema } from "../utils/validationSchemas.js";

const router = Router();

router.get("/", getAllMissions);
router.post("/dispatch", validate(missionDispatchSchema), dispatchMission);
router.get("/:id", getMissionById);

export default router;
