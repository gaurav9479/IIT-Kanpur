import mongoose from "mongoose"

const TelemetrySchema = new mongoose.Schema({

  droneId: {
    type: String,
    required: true
  },

  location: {

    lat: Number,
    lng: Number

  },

  altitude: {
    type: Number
  },

  speed: {
    type: Number
  },

  batteryLevel: {
    type: Number
  },

  timestamp: {
    type: Date,
    default: Date.now
  }

})

const Telemetry = mongoose.model("Telemetry", TelemetrySchema)

export default Telemetry