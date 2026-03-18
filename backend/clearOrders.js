import mongoose from "mongoose";
import dotenv from "dotenv";
import Order from "./models/Order.model.js";
import Mission from "./models/Mission.model.js";
import MissionHistory from "./models/MissionHistory.model.js";

dotenv.config();

const clearOrders = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB for clearing orders...");

    const r1 = await Order.deleteMany({});
    console.log(`Deleted ${r1.deletedCount} orders.`);
    
    const r2 = await Mission.deleteMany({});
    console.log(`Deleted ${r2.deletedCount} missions.`);
    
    const r3 = await MissionHistory.deleteMany({});
    console.log(`Deleted ${r3.deletedCount} mission histories.`);

    // Reset drones
    const Drone = (await import("./models/Drone.model.js")).default;
    await Drone.updateMany({}, { status: "idle", batteryLevel: 100 });
    console.log("All drones reset to idle and 100% battery.");

    console.log("Clear operation completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Failed to clear orders:", error);
    process.exit(1);
  }
};

clearOrders();
