import mongoose from "mongoose"

const TelemetrySchema = new mongoose.Schema({
  droneId: {
    type: String, 
    required: true
  },
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  altitude: {
    type: Number,
    required: true
  },
  speed: {
    type: Number,
    required: true
  },
  batteryLevel: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true })

const Telemetry = mongoose.model("Telemetry", TelemetrySchema)

export default Telemetry