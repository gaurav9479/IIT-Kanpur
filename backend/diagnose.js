import mongoose from "mongoose";
import dotenv from "dotenv";
import Drone from "./models/Drone.model.js";
import Order from "./models/Order.model.js";
import Mission from "./models/Mission.model.js";

dotenv.config();

const diagnose = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB for diagnosis...");

    const idleDrones = await Drone.find({ status: "idle" });
    console.log(`Found ${idleDrones.length} idle drones.`);
    if (idleDrones.length > 0) {
      idleDrones.forEach(d => console.log(` - ${d.droneId}: Status=${d.status}, Battery=${d.batteryLevel}%, Capacity=${d.payloadCapacity}kg`));
    } else {
        const allDrones = await Drone.find();
        console.log(`Total drones in DB: ${allDrones.length}`);
        allDrones.forEach(d => console.log(` - ${d.droneId}: Status=${d.status}, Battery=${d.batteryLevel}%, Capacity=${d.payloadCapacity}kg`));
    }

    const latestOrder = await Order.findOne().sort({ createdAt: -1 });
    console.log(`Latest Order: ${latestOrder ? latestOrder._id : "None"}`);

    process.exit(0);
  } catch (error) {
    console.error("Diagnosis failed:", error);
    process.exit(1);
  }
};

diagnose();
