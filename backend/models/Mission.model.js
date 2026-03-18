import mongoose from "mongoose"

const MissionSchema = new mongoose.Schema({
  missionId: {
    type: String,
    required: true,
    unique: true
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    required: true
  },
  drone: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Drone",
    required: true
  },
  pickupNode: {
    type: String,
    required: true
  },
  dropoffNode: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "FAILED"],
    default: "SCHEDULED"
  },
  estimatedBatteryUsage: {
    type: Number,
    required: true
  },
  estimatedArrival: {
    type: String,
    default: null
  },
  batteryAfter: {
    type: Number,
    default: null
  },
  totalDistance: {
    type: Number,
    default: 0
  },
  trajectoryData: {
    type: Array, 
    default: []
  },
  lane: {
    type: String,
    default: null
  },
  slotIndex: {
    type: Number,
    default: 0
  },
  constraints: {
    type: Object,
    default: {}
  }
}, { timestamps: true })

const Mission = mongoose.model("Mission", MissionSchema)

export default Mission
