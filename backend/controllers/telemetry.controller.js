import telemetryService from "../services/telemetry.service.js";
import asyncHandler from "../utils/AsyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";

export const recordTelemetry = asyncHandler(async (req, res) => {
  const telemetry = await telemetryService.recordTelemetry(req.body);
  return res.status(201).json(
    new ApiResponse(201, telemetry, "Telemetry recorded and direct broadcast sent")
  );
});
