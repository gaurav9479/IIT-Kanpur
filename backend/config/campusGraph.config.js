/**
 * campusGraph.config.js — Backend routing graph for IIT Kanpur.
 * ✅ SYNCED from: Drone_Map_IITK final.ipynb (64 nodes)
 *
 * Used by navigation.service.js for graph-based path planning.
 * Node IDs use human-readable keys matching the notebook's NODES dict.
 */

// ─────────────────────────────────────────────────────────────
// 64 CAMPUS NODES
// ─────────────────────────────────────────────────────────────
export const CAMPUS_NODES = [
    // ── ACADEMIC (11) ─────────────────────────────────────────
    { id: "LHC",    name: "Lecture Hall Complex",  lat: 26.5190, lng: 80.2330 },
    { id: "FAC",    name: "Faculty Building",       lat: 26.5185, lng: 80.2315 },
    { id: "CSE",    name: "Computer Science Dept",  lat: 26.5178, lng: 80.2340 },
    { id: "EE",     name: "Electrical Dept",        lat: 26.5172, lng: 80.2350 },
    { id: "ME",     name: "Mechanical Dept",        lat: 26.5168, lng: 80.2360 },
    { id: "CE",     name: "Civil Dept",             lat: 26.5175, lng: 80.2305 },
    { id: "CHM",    name: "Chemistry Dept",         lat: 26.5182, lng: 80.2295 },
    { id: "PHY",    name: "Physics Dept",           lat: 26.5188, lng: 80.2285 },
    { id: "LIB",    name: "Library",                lat: 26.5155, lng: 80.2322 },
    { id: "MSE",    name: "Materials Science",      lat: 26.5165, lng: 80.2370 },
    { id: "AER",    name: "Aerospace Dept",         lat: 26.5160, lng: 80.2345 },

    // ── ADMINISTRATIVE (7) ────────────────────────────────────
    { id: "GATE",   name: "Main Gate",              lat: 26.5145, lng: 80.2240 },
    { id: "ADM",    name: "Admin Block",            lat: 26.5168, lng: 80.2330 },
    { id: "DIR",    name: "Director Office",        lat: 26.5170, lng: 80.2325 },
    { id: "GH",     name: "Guest House",            lat: 26.5195, lng: 80.2270 },
    { id: "FRA",    name: "Faculty Residences A",   lat: 26.5205, lng: 80.2260 },
    { id: "FRB",    name: "Faculty Residences B",   lat: 26.5210, lng: 80.2275 },
    { id: "SEC",    name: "Security Office",        lat: 26.5148, lng: 80.2248 },

    // ── HOSTELS (14) ──────────────────────────────────────────
    { id: "H1",     name: "Hall 1",                 lat: 26.5130, lng: 80.2285 },
    { id: "H2",     name: "Hall 2",                 lat: 26.5125, lng: 80.2295 },
    { id: "H3",     name: "Hall 3",                 lat: 26.5120, lng: 80.2305 },
    { id: "H4",     name: "Hall 4",                 lat: 26.5115, lng: 80.2315 },
    { id: "H5",     name: "Hall 5",                 lat: 26.5110, lng: 80.2325 },
    { id: "H6",     name: "Hall 6",                 lat: 26.5108, lng: 80.2340 },
    { id: "H7",     name: "Hall 7",                 lat: 26.5112, lng: 80.2355 },
    { id: "H8",     name: "Hall 8",                 lat: 26.5118, lng: 80.2365 },
    { id: "H9",     name: "Hall 9",                 lat: 26.5130, lng: 80.2375 },
    { id: "H10",    name: "Hall 10",                lat: 26.5140, lng: 80.2380 },
    { id: "H11",    name: "Hall 11",                lat: 26.5150, lng: 80.2375 },
    { id: "H12",    name: "Hall 12",                lat: 26.5158, lng: 80.2370 },
    { id: "GH1",    name: "Girls Hostel 1",         lat: 26.5098, lng: 80.2350 },
    { id: "GH2",    name: "Girls Hostel 2",         lat: 26.5092, lng: 80.2338 },

    // ── AMENITIES (10) ────────────────────────────────────────
    { id: "OAT",    name: "OAT",                    lat: 26.5135, lng: 80.2325 },
    { id: "SHOP",   name: "Shopping Complex",       lat: 26.5115, lng: 80.2300 },
    { id: "GYM",    name: "Student Gymkhana",       lat: 26.5122, lng: 80.2318 },
    { id: "MED",    name: "Medical Center",         lat: 26.5125, lng: 80.2310 },
    { id: "CAN",    name: "Canteen North",          lat: 26.5180, lng: 80.2308 },
    { id: "CANS",   name: "Canteen South",          lat: 26.5118, lng: 80.2332 },
    { id: "BANK",   name: "Bank ATM",               lat: 26.5128, lng: 80.2302 },
    { id: "POST",   name: "Post Office",            lat: 26.5132, lng: 80.2295 },
    { id: "BOOK",   name: "Bookstore",              lat: 26.5128, lng: 80.2318 },
    { id: "CAFE",   name: "Cafeteria Central",      lat: 26.5142, lng: 80.2322 },

    // ── SPORTS (8) ────────────────────────────────────────────
    { id: "FTBL",   name: "Football Ground",        lat: 26.5108, lng: 80.2295 },
    { id: "CRIC",   name: "Cricket Ground",         lat: 26.5095, lng: 80.2320 },
    { id: "SWIM",   name: "Swimming Pool",          lat: 26.5102, lng: 80.2308 },
    { id: "TEN",    name: "Tennis Courts",          lat: 26.5105, lng: 80.2335 },
    { id: "BSKT",   name: "Basketball Court",       lat: 26.5112, lng: 80.2345 },
    { id: "ATH",    name: "Athletics Track",        lat: 26.5098, lng: 80.2305 },
    { id: "HOC",    name: "Hockey Ground",          lat: 26.5090, lng: 80.2295 },
    { id: "VOL",    name: "Volleyball Court",       lat: 26.5105, lng: 80.2350 },

    // ── DRONE CHARGING HUBS (5) ───────────────────────────────
    { id: "HUB-N",  name: "Hub North",              lat: 26.5200, lng: 80.2320 },
    { id: "HUB-S",  name: "Hub South",              lat: 26.5088, lng: 80.2330 },
    { id: "HUB-E",  name: "Hub East",               lat: 26.5148, lng: 80.2392 },
    { id: "HUB-W",  name: "Hub West",               lat: 26.5148, lng: 80.2248 },
    { id: "HUB-C",  name: "Hub Central",            lat: 26.5140, lng: 80.2318 },

    // ── INFRASTRUCTURE (1) ────────────────────────────────────
    { id: "PWR",    name: "Power Station",          lat: 26.5090, lng: 80.2375 },
];

// ─────────────────────────────────────────────────────────────
// CAMPUS EDGES — flight corridors between nodes.
// Based on notebook's hub-to-node connections + dept adjacency.
// Bidirectional. Navigation service snaps to nearest node first.
// ─────────────────────────────────────────────────────────────
export const CAMPUS_EDGES = [
    // Hub North ↔ Academic zone
    { from: "HUB-N", to: "LHC"  },
    { from: "HUB-N", to: "FAC"  },
    { from: "HUB-N", to: "GH"   },
    { from: "HUB-N", to: "DIR"  },

    // Hub Central ↔ Core campus (primary hub)
    { from: "HUB-C", to: "LIB"  },
    { from: "HUB-C", to: "OAT"  },
    { from: "HUB-C", to: "CAFE" },
    { from: "HUB-C", to: "BOOK" },
    { from: "HUB-C", to: "GYM"  },
    { from: "HUB-C", to: "MED"  },
    { from: "HUB-C", to: "H4"   },
    { from: "HUB-C", to: "H3"   },

    // Hub South ↔ Sports & south hostels
    { from: "HUB-S", to: "GH2"  },
    { from: "HUB-S", to: "CRIC" },
    { from: "HUB-S", to: "SWIM" },
    { from: "HUB-S", to: "HOC"  },
    { from: "HUB-S", to: "GH1"  },
    { from: "HUB-S", to: "ATH"  },

    // Hub East ↔ East hostel block
    { from: "HUB-E", to: "H11"  },
    { from: "HUB-E", to: "H10"  },
    { from: "HUB-E", to: "H9"   },
    { from: "HUB-E", to: "H8"   },
    { from: "HUB-E", to: "H12"  },
    { from: "HUB-E", to: "MSE"  },

    // Hub West ↔ Main Gate & security
    { from: "HUB-W", to: "GATE" },
    { from: "HUB-W", to: "SEC"  },
    { from: "HUB-W", to: "FRA"  },
    { from: "HUB-W", to: "FRB"  },

    // Academic spine
    { from: "LHC",  to: "FAC"   },
    { from: "FAC",  to: "CE"    },
    { from: "FAC",  to: "CAN"   },
    { from: "CE",   to: "CHM"   },
    { from: "CHM",  to: "PHY"   },
    { from: "LHC",  to: "CSE"   },
    { from: "CSE",  to: "EE"    },
    { from: "EE",   to: "ME"    },
    { from: "ME",   to: "MSE"   },
    { from: "AER",  to: "EE"    },
    { from: "AER",  to: "H7"    },
    { from: "LIB",  to: "OAT"   },
    { from: "LIB",  to: "ADM"   },

    // Admin cluster
    { from: "ADM",  to: "DIR"   },
    { from: "DIR",  to: "GH"    },
    { from: "GH",   to: "FRA"   },
    { from: "FRA",  to: "FRB"   },

    // Hostel chain (south-centre)
    { from: "H1",   to: "H2"    },
    { from: "H2",   to: "H3"    },
    { from: "H3",   to: "H4"    },
    { from: "H4",   to: "H5"    },
    { from: "H5",   to: "H6"    },
    { from: "H6",   to: "H7"    },
    { from: "H7",   to: "H8"    },
    { from: "H8",   to: "H9"    },
    { from: "H9",   to: "H10"   },
    { from: "H10",  to: "H11"   },
    { from: "H11",  to: "H12"   },

    // Amenities cluster
    { from: "SHOP", to: "H3"    },
    { from: "SHOP", to: "FTBL"  },
    { from: "GYM",  to: "OAT"   },
    { from: "MED",  to: "BANK"  },
    { from: "BANK", to: "POST"  },
    { from: "POST", to: "H1"    },

    // Sports cluster
    { from: "FTBL", to: "SWIM"  },
    { from: "SWIM", to: "ATH"   },
    { from: "ATH",  to: "HOC"   },
    { from: "TEN",  to: "BSKT"  },
    { from: "BSKT", to: "VOL"   },
    { from: "VOL",  to: "GH1"   },
    { from: "GH1",  to: "GH2"   },

    // Infrastructure
    { from: "PWR",  to: "HUB-E" },
    { from: "PWR",  to: "H8"    },
];

// ─────────────────────────────────────────────────────────────
// ADJACENCY MAP (auto-generated, bidirectional)
// Used by navigation.service.js for BFS/graph pathfinding.
// ─────────────────────────────────────────────────────────────
export const ADJACENCY = CAMPUS_EDGES.reduce((acc, edge) => {
    if (!acc[edge.from]) acc[edge.from] = [];
    if (!acc[edge.to])   acc[edge.to]   = [];
    acc[edge.from].push(edge.to);
    acc[edge.to].push(edge.from);
    return acc;
}, {});
