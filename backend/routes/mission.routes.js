import { Router } from "express";
import {
  dispatchMission,
  getMissionStatus,
  landDrone,
  getTakeoffQueue
} from "../controllers/mission.controller.js";

const router = Router();

router.route("/dispatch").post(dispatchMission);
router.route("/status/:droneId").get(getMissionStatus);
router.route("/land").post(landDrone);
router.route("/takeoff-queue/:hubId").get(getTakeoffQueue);

export default router;