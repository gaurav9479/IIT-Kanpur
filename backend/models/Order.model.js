import mongoose from "mongoose"

const OrderSchema = new mongoose.Schema({
  pickupLocation: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  dropLocation: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  weight: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ["pending", "assigned", "picked", "in-flight", "delivered"],
    default: "pending"
  },
  assignedDrone: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Drone"
  }
}, { timestamps: true })

const Order = mongoose.model("Order", OrderSchema)

export default Order