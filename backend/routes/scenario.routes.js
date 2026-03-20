import { Router } from "express";
import { runScenario } from "../controllers/scenario.controller.js";

const router = Router();

router.post("/run/:name", runScenario);

export default router;
