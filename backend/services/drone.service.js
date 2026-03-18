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
      returnDocument: 'after',
      runValidators: true,
    });
  }

  async deleteDrone(id) {
    return await Drone.findByIdAndDelete(id);
  }
}

export default new DroneService();
