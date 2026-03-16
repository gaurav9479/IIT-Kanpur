import mongoose from "mongoose"

const MissionHistorySchema = new mongoose.Schema({
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
  duration: {
    type: Number, // seconds
    required: true
  },
  totalBatteryUsed: {
    type: Number,
    required: true
  },
  finalStatus: {
    type: String,
    enum: ["delivered", "failed", "cancelled"],
    required: true
  },
  completedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true })

const MissionHistory = mongoose.model("MissionHistory", MissionHistorySchema)

export default MissionHistory
