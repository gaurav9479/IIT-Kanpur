import mongoose from "mongoose"

const DroneSchema = new mongoose.Schema({
  droneId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  batteryLevel: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    default: 100
  },
  status: {
    type: String,
    enum: ["idle", "delivering", "charging", "grounded"],
    default: "idle"
  },
  payloadCapacity: {
    type: Number,
    required: true
  },
  vehicleType: {
    type: String,
    enum: ["drone", "plane"],
    default: "drone"
  },
  operatingAltitude: {
    type: Number,
    min: 20,
    max: 120,
    default: 50
  },
  location: {
    lat: { type: Number, default: 0 },
    lng: { type: Number, default: 0 }
  }
}, { timestamps: true })

const Drone = mongoose.model("Drone", DroneSchema)

export default Drone