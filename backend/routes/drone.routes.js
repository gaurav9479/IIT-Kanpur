import { Router } from "express";
import {
  createDrone,
  getAllDrones,
  getDroneById,
  updateDrone,
  deleteDrone
} from "../controllers/drone.controller.js";

import validate from "../middleware/validate.js";
import { droneSchema } from "../utils/validationSchemas.js";
// import { protect, restrictTo } from "../middleware/auth.js";

const router = Router();

// router.use(protect); // Secure all drone routes

router.route("/")
  .post(validate(droneSchema), createDrone)
  .get(getAllDrones);

router.route("/:id")
  .get(getDroneById)
  .patch(updateDrone)
  .delete(deleteDrone);

router.patch("/:id/status", updateDrone);

export default router;
