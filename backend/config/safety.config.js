
export const NO_FLY_ZONES = [
    {
        name: "Restricted Lab Alpha",
        center: { lat: 26.5123, lng: 80.2321 },
        radius: 50, 
    },
    {
        name: "Residential Area Zone 1",
        center: { lat: 26.5150, lng: 80.2350 },
        radius: 100, 
    }
];

export const SAFE_LANDING_ZONES = [
    { id: "LZ-01", name: "Helipad North", lat: 26.5130, lng: 80.2330 },
    { id: "LZ-02", name: "Open Field West", lat: 26.5110, lng: 80.2300 },
    { id: "LZ-03", name: "Main Stadium", lat: 26.5180, lng: 80.2380 }
];

export const COLLISION_THRESHOLD = 10; 
export const EMERGENCY_BATTERY_THRESHOLD = 5; 
export const TELEMETRY_TIMEOUT_MS = 30000; 

export const ALTITUDE_LANES = [30, 50, 70, 90]; // meters
export const LANE_DIRECTION = { 30: "CW", 50: "CCW", 70: "CW", 90: "CCW" };
export const LANE_CAPACITY = 3; // max drones per lane per time slot
export const VERTICAL_BUFFER = 10; // meters — vertical conflict buffer
export const TIME_SLOT_DURATION = 30; // seconds per slot
export const CONGESTION_THRESHOLD = 0.7; // AI score se upar → lane avoid karo
export const BATTERY_LOW = 15; // holding pattern trigger