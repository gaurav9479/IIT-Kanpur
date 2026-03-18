import mongoose from "mongoose";
import dotenv from "dotenv";
import Drone from "./models/Drone.model.js";

dotenv.config();

const seedDrones = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB for seeding...");

    const existingDrones = await Drone.find();
    if (existingDrones.length > 0) {
      console.log(`Found ${existingDrones.length} existing drones. Making them idle...`);
      await Drone.updateMany({}, { status: "idle", batteryLevel: 100 });
    } else {
      console.log("No drones found. Seeding 3 initial drones...");
      await Drone.create([
        {
          droneId: "DRN-001",
          type: "Quadcopter",
          batteryLevel: 100,
          payloadCapacity: 5,
          status: "idle",
          location: { lat: 26.5123, lng: 80.2329 }
        },
        {
          droneId: "DRN-002",
          type: "Quadcopter",
          batteryLevel: 100,
          payloadCapacity: 10,
          status: "idle",
          location: { lat: 26.5123, lng: 80.2329 }
        },
        {
          droneId: "DRN-003",
          type: "HeavyLift",
          batteryLevel: 100,
          payloadCapacity: 20,
          status: "idle",
          location: { lat: 26.5123, lng: 80.2329 }
        }
      ]);
    }

    console.log("Seeding complete!");
    process.exit(0);
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }
};

seedDrones();
