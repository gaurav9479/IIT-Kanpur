import { Router } from "express";
import {
  createDrone,
  getAllDrones,
  getDroneById,
  updateDrone,
} from "../controllers/drone.controller.js";

import validate from "../middleware/validate.js";
import { droneSchema } from "../utils/validationSchemas.js";
import { protect, adminOnly } from "../middleware/auth.js";

const router = Router();

router.use(protect); // Secure all drone routes

router.route("/")
  .post(validate(droneSchema), createDrone)
  .get(getAllDrones);

router.route("/:id")
  .get(getDroneById)
  .patch(updateDrone);

export default router;
