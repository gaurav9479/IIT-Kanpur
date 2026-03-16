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
  trajectoryData: {
    type: Array, // Array of 4D A* paths
    default: []
  }
}, { timestamps: true })

const Mission = mongoose.model("Mission", MissionSchema)

export default Mission
