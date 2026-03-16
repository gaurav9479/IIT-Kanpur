import MissionHistory from "../models/MissionHistory.model.js";
import Drone from "../models/Drone.model.js";

class AnalyticsService {
  async getFleetHealth() {
    const drones = await Drone.find();
    
    const totalDrones = drones.length;
    const idleDrones = drones.filter(d => d.status === "idle").length;
    const deliveringDrones = drones.filter(d => d.status === "delivering").length;
    const chargingDrones = drones.filter(d => d.status === "charging").length;
    
    const avgBattery = drones.reduce((acc, d) => acc + d.batteryLevel, 0) / (totalDrones || 1);
    
    return {
      totalDrones,
      idleDrones,
      deliveringDrones,
      chargingDrones,
      avgBattery: avgBattery.toFixed(2),
      healthScore: this.calculateSystemHealth(avgBattery, chargingDrones)
    };
  }

  calculateSystemHealth(avgBattery, chargingDrones) {
    if (avgBattery > 70 && chargingDrones < 2) return "Healthy";
    if (avgBattery > 40) return "Stable";
    return "Degraded";
  }

  async getMissionStats() {
    const history = await MissionHistory.find().sort({ completedAt: -1 }).limit(10);
    const totalCompleted = await MissionHistory.countDocuments({ finalStatus: "delivered" });
    
    return {
      totalCompleted,
      recentMissions: history
    };
  }
}

export default new AnalyticsService();
