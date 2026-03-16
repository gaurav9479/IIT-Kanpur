import mongoose from "mongoose"

const DroneSchema = new mongoose.Schema({
  droneId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  model: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ["IDLE", "EN_ROUTE", "RETURNING", "MAINTENANCE"],
    default: "IDLE"
  },
  batteryLevel: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  maxWeightCapacity: {
    type: Number,
    required: true
  },
  currentLocationNode: {
    type: String,
    required: true
  }
}, { timestamps: true })

const Drone = mongoose.model("Drone", DroneSchema)

export default Drone