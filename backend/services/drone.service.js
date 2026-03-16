import Drone from "../models/Drone.model.js";

class DroneService {
  async createDrone(droneData) {
    return await Drone.create(droneData);
  }

  async getAllDrones() {
    return await Drone.find();
  }

  async getDroneById(id) {
    return await Drone.findById(id);
  }

  async updateDrone(id, updateData) {
    return await Drone.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });
  }
}

export default new DroneService();
