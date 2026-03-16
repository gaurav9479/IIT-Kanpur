import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import { createServer } from "http"
import { Server } from "socket.io"

import connectDB from "./config/db.js"
import missionRouter from "./routes/mission.routes.js"

dotenv.config()

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  }
})

connectDB()

app.use(cors())
app.use(express.json())

// Routes
app.use("/api/v1/missions", missionRouter)

app.get("/", (req, res) => {
  res.send("Drone Delivery Backend Running")
})

// Socket.io logic
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id)

  // Join the admin_dashboard room
  socket.on("join_admin", () => {
    socket.join("admin_dashboard")
    console.log(`Socket ${socket.id} joined admin_dashboard`)
  })

  // Handle telemetry_ping event from the drone
  socket.on("telemetry_ping", (data) => {
    // data: { droneId, lat, lng, batteryLevel, velocity, etc. }
    console.log(`Telemetry from ${data.droneId}:`, data)
    
    // Broadcast it to the admin_dashboard room
    io.to("admin_dashboard").emit("telemetry_update", data)
  })

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id)
  })
})

const PORT = process.env.PORT || 5000

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})