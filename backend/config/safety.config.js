// ===== COLLISION & SAFETY (existing) =====
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
export const EMERGENCY_BATTERY_THRESHOLD = 15; // 5 → 15 fix (Team requirement)
export const TELEMETRY_TIMEOUT_MS = 30000;

// ===== MEMBER 2 — Navigation & ATC Config =====

export const ALTITUDE_LANES = [
    { id: "L1", altitude: 20, direction: "NORTH_SOUTH" },
    { id: "L2", altitude: 30, direction: "EAST_WEST" },
    { id: "L3", altitude: 40, direction: "NORTH_SOUTH" },
    { id: "L4", altitude: 50, direction: "EAST_WEST" },
    { id: "L5", altitude: 60, direction: "NORTH_SOUTH" },
    { id: "L6", altitude: 70, direction: "EAST_WEST" },
    { id: "L7", altitude: 80, direction: "NORTH_SOUTH" },
    { id: "L8", altitude: 90, direction: "EAST_WEST" },
    { id: "L9", altitude: 100, direction: "NORTH_SOUTH" },
    { id: "L10", altitude: 110, direction: "EAST_WEST" },
];

export const VERTICAL_BUFFER_M = 10;
export const TIME_SLOT_DURATION_S = 300; // 5 minutes
export const MAX_DRONES_PER_SLOT = 5;

export const HUB_CORRIDOR_RADIUS_M = 20;
export const HUB_CORRIDOR_HEIGHT_M = 100;

export const EMERGENCY_HOVER_DURATION_S = 10;
export const LOST_LINK_TIMEOUT_S = 15;
