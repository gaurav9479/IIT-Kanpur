import { Router } from "express";
import { dispatchMission, getAllMissions, getMissionById } from "../controllers/mission.controller.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.use(protect); // Secure all mission routes

router.route("/").get(getAllMissions);
router.route("/dispatch").post(dispatchMission);
router.route("/:id").get(getMissionById);

export default router;
