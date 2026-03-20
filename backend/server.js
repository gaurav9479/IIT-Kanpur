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
import collisionService from "./services/collision.service.js";
import collision3D from "./services/collision3D.js";


const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5001", "http://127.0.0.1:5001"],
    methods: ["GET", "POST"],
    credentials: true
  },
});


app.use(correlationIdMiddleware);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(morgan("dev"));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    status: 429,
    message: "Too many requests from this IP, please try again after 15 minutes"
  }
});

app.use(limiter);


app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/drones", droneRoutes);
app.use("/api/v1/orders", orderRoutes);
app.use("/api/v1/telemetry", telemetryRoutes);
app.use("/api/v1/analytics", analyticsRoutes);
app.use("/api/v1/safety", collisionRoutes);
app.use("/api/v1/navigation", navigationRoutes);
app.use("/api/v1/missions", missionRoutes);

// Global Error Handler
import ApiError from "./utils/ApiError.js";
app.use((err, req, res, next) => {
  let statusCode = err.statusCode || (err instanceof ApiError ? err.statusCode : 500);
  let message = err.message || "Internal Server Error";
  
  // Handle MongoDB Duplicate Key Error
  if (err.code === 11000) {
    statusCode = 409; // Conflict
    const field = Object.keys(err.keyValue)[0];
    message = `Duplicate ${field} detected. Please use a unique value.`;
  }

  logger.error(`[Error] ${statusCode} - ${message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
  
  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    errors: err.errors || [],
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

connectDB().then(() => {
  collisionService.startMonitoring();
  collision3D.startMonitoring3D();
});

app.get("/", (req, res) => {
  res.send("Drone Delivery API is running...");
});


io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("join_admin", () => {
    socket.join("admin_dashboard");
    console.log("Socket joined admin_dashboard");
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

const PORT = process.env.PORT || 5001;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export { io };