import Drone from "../models/Drone.model.js";
import Order from "../models/Order.model.js";
import telemetryService from "./telemetry.service.js";
import MissionHistory from "../models/MissionHistory.model.js";

class SimulationService {

  async startDeliverySimulation(orderId, droneId) {
    console.log(`Starting simulation for Order: ${orderId}, Drone: ${droneId}`);
    
    const order = await Order.findById(orderId);
    const drone = await Drone.findById(droneId);

    if (!order || !drone) return;


    const steps = [
      { status: "picked", location: order.pickupLocation, msg: "Drone picked up the package" },
      { status: "in-flight", location: this.interpolate(order.pickupLocation, order.dropLocation, 0.5), msg: "Drone is in-flight" },
      { status: "delivered", location: order.dropLocation, msg: "Drone delivered the package" }
    ];

    let stepIndex = 0;
    const interval = setInterval(async () => {
      if (stepIndex >= steps.length) {
        clearInterval(interval);
        

        await MissionHistory.create({
          missionId: `HIST-${Date.now()}`,
          order: order._id,
          drone: drone._id,
          duration: steps.length * 5, 
          totalBatteryUsed: (steps.length) * 5, 
          finalStatus: "delivered"
        });

        await Drone.findByIdAndUpdate(droneId, { status: "idle" });
        console.log(`Simulation completed for Order: ${orderId}`);
        return;
      }

      const currentStep = steps[stepIndex];
      

      await Order.findByIdAndUpdate(orderId, { status: currentStep.status });


      await telemetryService.recordTelemetry({
        droneId: drone.droneId,
        location: currentStep.location,
        altitude: 50,
        speed: 15,
        batteryLevel: Math.max(0, drone.batteryLevel - (stepIndex + 1) * 5),
        timestamp: new Date()
      });

      console.log(`Simulation Step [${currentStep.status}]: ${currentStep.msg}`);
      stepIndex++;
    }, 5000); 
  }


  interpolate(start, end, factor) {
    return {
      lat: start.lat + (end.lat - start.lat) * factor,
      lng: start.lng + (end.lng - start.lng) * factor
    };
  }
}

export default new SimulationService();
