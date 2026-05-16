import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Drone from './models/Drone.model.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/drone-navigation";

const HUBS = [
    { name: "Hub North", lat: 26.5200, lng: 80.2320 },
    { name: "Hub South", lat: 26.5088, lng: 80.2330 },
    { name: "Hub East",  lat: 26.5148, lng: 80.2392 },
    { name: "Hub West",  lat: 26.5148, lng: 80.2248 },
    { name: "Hub Central", lat: 26.5140, lng: 80.2318 }
];

const ALTITUDES = [80, 130, 180, 230, 280];

async function seed() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to MongoDB");

        // Clear existing drones for a fresh start
        await Drone.deleteMany({});
        console.log("Cleared existing drones");

        const drones = [];
        for (let i = 1; i <= 50; i++) {
            const droneId = `DRN-${String(i).padStart(3, '0')}`;
            const hub = HUBS[(i - 1) % HUBS.length];
            const alt = ALTITUDES[(i - 1) % ALTITUDES.length];

            drones.push({
                droneId,
                batteryLevel: 100,
                status: "idle",
                payloadCapacity: 2.0,
                vehicleType: "drone",
                operatingAltitude: alt,
                location: { lat: hub.lat, lng: hub.lng },
                homeHub: hub
            });
        }

        await Drone.insertMany(drones);
        console.log(`Successfully seeded ${drones.length} drones across 5 hubs and 5 altitude layers.`);

        await mongoose.disconnect();
    } catch (error) {
        console.error("Seeding failed:", error);
        process.exit(1);
    }
}

seed();
