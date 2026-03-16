import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import morgan from "morgan";
import logger from "./utils/logger.js";

import connectDB from "./config/db.js";


import droneRoutes from "./routes/drone.routes.js";
import orderRoutes from "./routes/order.routes.js";
import telemetryRoutes from "./routes/telemetry.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import authRoutes from "./routes/auth.routes.js";
import collisionRoutes from "./routes/collision.routes.js";
import collisionService from "./services/collision.service.js";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});


app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(morgan("dev"));


app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/drones", droneRoutes);
app.use("/api/v1/orders", orderRoutes);
app.use("/api/v1/telemetry", telemetryRoutes);
app.use("/api/v1/analytics", analyticsRoutes);
app.use("/api/v1/safety", collisionRoutes);

connectDB().then(() => {
  collisionService.startMonitoring();
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

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export { io };