import { Router } from "express";
import { dispatchMission } from "../controllers/mission.controller.js";

const router = Router();

router.route("/dispatch").post(dispatchMission);

export default router;
