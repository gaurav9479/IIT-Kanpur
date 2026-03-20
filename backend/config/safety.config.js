// ===== COLLISION & SAFETY =====
// ✅ SYNCED from Drone_Map_IITK final.ipynb — 9 NFZ zones
// 5 circular NFZs (12-pt polygon approx) + 4 exclusion polygons
export const NO_FLY_ZONES = [
    // ── NFZ CIRCLES ──────────────────────────────────────────
    {
        name: "NFZ-Admin Block",
        positions: [
            { lat: 26.5168,   lng: 80.234208 }, { lat: 26.517341, lng: 80.234046 },
            { lat: 26.517736, lng: 80.233604 }, { lat: 26.517881, lng: 80.233    },
            { lat: 26.517736, lng: 80.232396 }, { lat: 26.517341, lng: 80.231954 },
            { lat: 26.5168,   lng: 80.231792 }, { lat: 26.516259, lng: 80.231954 },
            { lat: 26.515864, lng: 80.232396 }, { lat: 26.515719, lng: 80.233    },
            { lat: 26.515864, lng: 80.233604 }, { lat: 26.516259, lng: 80.234046 },
        ],
    },
    {
        name: "NFZ-Library Complex",
        positions: [
            { lat: 26.5155,   lng: 80.233207 }, { lat: 26.51595,  lng: 80.233072 },
            { lat: 26.51628,  lng: 80.232703 }, { lat: 26.516401, lng: 80.2322   },
            { lat: 26.51628,  lng: 80.231697 }, { lat: 26.51595,  lng: 80.231328 },
            { lat: 26.5155,   lng: 80.231193 }, { lat: 26.51505,  lng: 80.231328 },
            { lat: 26.51472,  lng: 80.231697 }, { lat: 26.514599, lng: 80.2322   },
            { lat: 26.51472,  lng: 80.232703 }, { lat: 26.51505,  lng: 80.233072 },
        ],
    },
    {
        name: "NFZ-Lecture Hall Complex",
        positions: [
            { lat: 26.519,    lng: 80.23451  }, { lat: 26.519676, lng: 80.234308 },
            { lat: 26.52017,  lng: 80.233755 }, { lat: 26.520351, lng: 80.233    },
            { lat: 26.52017,  lng: 80.232245 }, { lat: 26.519676, lng: 80.231692 },
            { lat: 26.519,    lng: 80.23149  }, { lat: 26.518324, lng: 80.231692 },
            { lat: 26.51783,  lng: 80.232245 }, { lat: 26.517649, lng: 80.233    },
            { lat: 26.51783,  lng: 80.233755 }, { lat: 26.518324, lng: 80.234308 },
        ],
    },
    {
        name: "NFZ-Faculty Building",
        positions: [
            { lat: 26.5182,   lng: 80.232305 }, { lat: 26.51856,  lng: 80.232198 },
            { lat: 26.518824, lng: 80.231903 }, { lat: 26.518921, lng: 80.2315   },
            { lat: 26.518824, lng: 80.231097 }, { lat: 26.51856,  lng: 80.230802 },
            { lat: 26.5182,   lng: 80.230695 }, { lat: 26.51784,  lng: 80.230802 },
            { lat: 26.517576, lng: 80.231097 }, { lat: 26.517479, lng: 80.2315   },
            { lat: 26.517576, lng: 80.231903 }, { lat: 26.51784,  lng: 80.232198 },
        ],
    },
    {
        name: "NFZ-Research Labs",
        positions: [
            { lat: 26.5175,   lng: 80.236406 }, { lat: 26.517905, lng: 80.236285 },
            { lat: 26.518202, lng: 80.235953 }, { lat: 26.518311, lng: 80.2355   },
            { lat: 26.518202, lng: 80.235047 }, { lat: 26.517905, lng: 80.234715 },
            { lat: 26.5175,   lng: 80.234594 }, { lat: 26.517095, lng: 80.234715 },
            { lat: 26.516798, lng: 80.235047 }, { lat: 26.516689, lng: 80.2355   },
            { lat: 26.516798, lng: 80.235953 }, { lat: 26.517095, lng: 80.236285 },
        ],
    },
    // ── EXCLUSION POLYGONS ────────────────────────────────────
    {
        name: "Exclusion-North Boundary",
        positions: [
            { lat: 26.5215, lng: 80.2340 }, { lat: 26.5225, lng: 80.2340 },
            { lat: 26.5225, lng: 80.2380 }, { lat: 26.5215, lng: 80.2380 },
        ],
    },
    {
        name: "Exclusion-South Residential",
        positions: [
            { lat: 26.5080, lng: 80.2370 }, { lat: 26.5095, lng: 80.2370 },
            { lat: 26.5095, lng: 80.2400 }, { lat: 26.5080, lng: 80.2400 },
        ],
    },
    {
        name: "Exclusion-West Agriculture",
        positions: [
            { lat: 26.5170, lng: 80.2220 }, { lat: 26.5190, lng: 80.2220 },
            { lat: 26.5190, lng: 80.2240 }, { lat: 26.5170, lng: 80.2240 },
        ],
    },
    {
        name: "Exclusion-NE Periphery",
        positions: [
            { lat: 26.5205, lng: 80.2385 }, { lat: 26.5215, lng: 80.2385 },
            { lat: 26.5215, lng: 80.2400 }, { lat: 26.5205, lng: 80.2400 },
        ],
    },
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
