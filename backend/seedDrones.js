import mongoose from "mongoose";
import dotenv from "dotenv";
import Drone from "./models/Drone.model.js";

dotenv.config();

const seedDrones = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB for seeding...");

    console.log("Clearing existing drones...");
    await Drone.deleteMany({});

    console.log("Seeding 5 new drones for the fleet...");
    await Drone.create([
      {
        droneId: "DRN-001",
        type: "PrimeAir V1",
        batteryLevel: 100,
        payloadCapacity: 6,
        status: "idle",
        location: { lat: 26.5123, lng: 80.2329 }
      },
      {
        droneId: "DRN-002",
        type: "PrimeAir V2",
        batteryLevel: 100,
        payloadCapacity: 6,
        status: "idle",
        location: { lat: 26.5123, lng: 80.2329 }
      },
      {
        droneId: "DRN-003",
        type: "HeavyLift G1",
        batteryLevel: 100,
        payloadCapacity: 10,
        status: "idle",
        location: { lat: 26.5123, lng: 80.2329 }
      },
      {
        droneId: "DRN-004",
        type: "HeavyLift G2",
        batteryLevel: 100,
        payloadCapacity: 15,
        status: "idle",
        location: { lat: 26.5123, lng: 80.2329 }
      },
      {
        droneId: "DRN-005",
        type: "Titan X",
        batteryLevel: 100,
        payloadCapacity: 20,
        status: "idle",
        location: { lat: 26.5123, lng: 80.2329 }
      }
    ]);

    console.log("Seeding complete!");
    process.exit(0);
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }
};

seedDrones();
