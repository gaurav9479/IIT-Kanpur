import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import morgan from "morgan";
import { rateLimit } from "express-rate-limit";
import correlationIdMiddleware from "./middleware/correlationId.js";
import logger from "./utils/logger.js";

import connectDB from "./config/db.js";

import droneRoutes from "./routes/drone.routes.js";
import orderRoutes from "./routes/order.routes.js";
import telemetryRoutes from "./routes/telemetry.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import authRoutes from "./routes/auth.routes.js";
import collisionRoutes from "./routes/collision.routes.js";
import navigationRoutes from "./routes/navigation.routes.js";
import missionRoutes from "./routes/mission.routes.js";
import scenarioRoutes from "./routes/scenario.routes.js";
import zoneRoutes from "./routes/zone.routes.js";
import aiRoutes from "./routes/ai.routes.js";
import collisionService from "./services/collision.service.js";
import collision3D from "./services/collision3D.js";
import zoneService from "./services/zone.service.js";

const app = express();
const httpServer = createServer(app);

// ✅ FIXED SOCKET.IO CORS (ALLOW MOBILE)
const io = new Server(httpServer, {
  cors: {
    origin: "*", // allow all (dev mode)
    methods: ["GET", "POST"],
  },
});

// ✅ MIDDLEWARES
app.use(correlationIdMiddleware);

// ✅ FIXED CORS FOR API
app.use(
  cors({
    origin: "*", // allow mobile + localhost
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(morgan("dev"));

// ✅ RATE LIMIT
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10000,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    status: 429,
    message: "Too many requests. Try again later.",
  },
});

app.use(limiter);

// ✅ ROUTES
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/drones", droneRoutes);
app.use("/api/v1/orders", orderRoutes);
app.use("/api/v1/telemetry", telemetryRoutes);
app.use("/api/v1/analytics", analyticsRoutes);
app.use("/api/v1/safety", collisionRoutes);
app.use("/api/v1/navigation", navigationRoutes);
app.use("/api/v1/missions", missionRoutes);
app.use("/api/v1/scenarios", scenarioRoutes);
app.use("/api/v1/zones", zoneRoutes);
app.use("/api/v1/ai", aiRoutes);

// ✅ HEALTH CHECK
app.get("/", (req, res) => {
  res.send("Drone Delivery API is running...");
});

// ✅ GLOBAL ERROR HANDLER
import ApiError from "./utils/ApiError.js";
app.use((err, req, res, next) => {
  let statusCode = err.statusCode || (err instanceof ApiError ? err.statusCode : 500);
  let message = err.message || "Internal Server Error";

  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue)[0];
    message = `Duplicate ${field} detected.`;
  }

  logger.error(`[Error] ${statusCode} - ${message}`);

  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    errors: err.errors || [],
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

// ✅ SOCKET.IO
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("join_admin", () => {
    socket.join("admin_dashboard");
    console.log("Joined admin_dashboard");
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

// ✅ CONNECT DB + SERVICES
connectDB().then(async () => {
  // Initialise zone service first — safety + navigation depend on its cache
  await zoneService.init(io);
  collisionService.startMonitoring();
  collision3D.startMonitoring3D();
});

// ✅ IMPORTANT FIX: LISTEN ON 0.0.0.0
const PORT = process.env.PORT || 5001;

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});

export { io };