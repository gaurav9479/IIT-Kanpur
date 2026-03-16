import mongoose from "mongoose"

const OrderSchema = new mongoose.Schema({

  pickupLocation: {

    lat: Number,
    lng: Number

  },

  dropLocation: {

    lat: Number,
    lng: Number

  },

  pickupNode: {
    type: String,
    required: true
  },

  dropoffNode: {
    type: String,
    required: true
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