import { Router } from "express";
import { runScenario, resetEnvironment } from "../controllers/scenario.controller.js";

const router = Router();

router.post("/run/:name", runScenario);
router.post("/reset", resetEnvironment);

export default router;
