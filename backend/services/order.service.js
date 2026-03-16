import Order from "../models/Order.model.js";
import Drone from "../models/Drone.model.js";
import ApiError from "../utils/ApiError.js";
import simulationService from "./simulation.service.js";
import aiService from "./ai.service.js";

class OrderService {
  async createOrder(orderData) {
    const order = await Order.create(orderData);
    

    await this.assignDroneToOrder(order);
    
    return await Order.findById(order._id).populate("assignedDrone");
  }


  async assignDroneToOrder(order) {
    const activeDronesCount = await Drone.countDocuments({ status: "delivering" });
    const congestionLevel = await aiService.predictCongestion(
        activeDronesCount,
        500, 
        15,  
        new Date().getHours()
    );

    if (congestionLevel === "high") {
        console.log("High congestion detected! Delaying mission assignment.");
        return { order, message: "Mission delayed due to high airspace congestion" };
    }

    const drone = await Drone.findOne({
      status: "idle",
      batteryLevel: { $gt: 30 },
      payloadCapacity: { $gte: order.weight },
    });

    if (drone) {
      order.assignedDrone = drone._id;
      order.status = "assigned";
      await order.save();

      drone.status = "delivering";
      await drone.save();

      simulationService.startDeliverySimulation(order._id, drone._id);
    }
  }

  async getAllOrders() {
    return await Order.find().populate("assignedDrone");
  }

  async getOrderById(id) {
    return await Order.findById(id).populate("assignedDrone");
  }

  async updateOrder(id, updateData) {
    return await Order.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).populate("assignedDrone");
  }
}

export default new OrderService();
