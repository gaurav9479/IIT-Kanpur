import { Router } from "express";
import { recordTelemetry } from "../controllers/telemetry.controller.js";

import validate from "../middleware/validate.js";
import { telemetrySchema } from "../utils/validationSchemas.js";

const router = Router();

router.route("/").post(validate(telemetrySchema), recordTelemetry);

export default router;
