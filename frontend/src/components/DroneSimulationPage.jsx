import React, { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Polygon, Circle, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Battery, BatteryLow, Zap, Navigation2, AlertTriangle, RefreshCw } from 'lucide-react';

// ────────────────────────────────────
// CONSTANTS (from notebook)
// ────────────────────────────────────
const CAMPUS_CENTER = [26.5145, 80.2325];
const CAMPUS_ZOOM = 16;

const POWER_STATION = { lat: 26.5090, lng: 26.5090 };
const POWER_STATION_POS = [26.5090, 80.2375];

const NFZ_CIRCLES = [
  { name: 'NFZ — Admin Block',  center: [26.5168, 80.2330], radius: 80 },
  { name: 'NFZ — Library',      center: [26.5155, 80.2322], radius: 70 },
  { name: 'NFZ — Director',     center: [26.5170, 80.2325], radius: 60 },
  { name: 'NFZ — Main Gate',    center: [26.5145, 80.2240], radius: 90 },
  { name: 'NFZ — Power Hub',    center: [26.5090, 80.2280], radius: 75 },
];

const EXCLUSION_ZONES = [
  {
    name: 'West Agriculture',
    coords: [[26.5170, 80.2220],[26.5190, 80.2220],[26.5190, 80.2240],[26.5170, 80.2240]],
  },
  {
    name: 'North-East Periphery',
    coords: [[26.5205, 80.2385],[26.5215, 80.2385],[26.5215, 80.2400],[26.5205, 80.2400]],
  },
];

// 64 campus nodes from notebook (lat, lng, label, category)
const CAMPUS_NODES = [
  // Academic
  { lat: 26.5190, lng: 80.2330, name: 'Lecture Hall Complex',  cat: 'academic' },
  { lat: 26.5185, lng: 80.2315, name: 'Faculty Building',       cat: 'academic' },
  { lat: 26.5178, lng: 80.2340, name: 'CS Department',          cat: 'academic' },
  { lat: 26.5172, lng: 80.2350, name: 'Electrical Dept',        cat: 'academic' },
  { lat: 26.5168, lng: 80.2360, name: 'Mechanical Dept',        cat: 'academic' },
  { lat: 26.5175, lng: 80.2305, name: 'Civil Dept',             cat: 'academic' },
  { lat: 26.5182, lng: 80.2295, name: 'Chemistry Dept',         cat: 'academic' },
  { lat: 26.5188, lng: 80.2285, name: 'Physics Dept',           cat: 'academic' },
  { lat: 26.5155, lng: 80.2322, name: 'Library',                cat: 'academic' },
  { lat: 26.5165, lng: 80.2370, name: 'Materials Science',      cat: 'academic' },
  { lat: 26.5160, lng: 80.2345, name: 'Aerospace Dept',         cat: 'academic' },
  // Admin
  { lat: 26.5145, lng: 80.2240, name: 'Main Gate',              cat: 'admin' },
  { lat: 26.5168, lng: 80.2330, name: 'Admin Block',            cat: 'admin' },
  { lat: 26.5170, lng: 80.2325, name: 'Director Office',        cat: 'admin' },
  { lat: 26.5195, lng: 80.2270, name: 'Guest House',            cat: 'admin' },
  { lat: 26.5205, lng: 80.2260, name: 'Faculty Residences A',   cat: 'admin' },
  { lat: 26.5210, lng: 80.2275, name: 'Faculty Residences B',   cat: 'admin' },
  { lat: 26.5148, lng: 80.2248, name: 'Security Office',        cat: 'admin' },
  // Hostels
  { lat: 26.5130, lng: 80.2285, name: 'Hall 1',                 cat: 'hostel' },
  { lat: 26.5125, lng: 80.2295, name: 'Hall 2',                 cat: 'hostel' },
  { lat: 26.5120, lng: 80.2305, name: 'Hall 3',                 cat: 'hostel' },
  { lat: 26.5115, lng: 80.2315, name: 'Hall 4',                 cat: 'hostel' },
  { lat: 26.5110, lng: 80.2325, name: 'Hall 5',                 cat: 'hostel' },
  { lat: 26.5108, lng: 80.2340, name: 'Hall 6',                 cat: 'hostel' },
  { lat: 26.5112, lng: 80.2355, name: 'Hall 7',                 cat: 'hostel' },
  { lat: 26.5118, lng: 80.2365, name: 'Hall 8',                 cat: 'hostel' },
  { lat: 26.5130, lng: 80.2375, name: 'Hall 9',                 cat: 'hostel' },
  { lat: 26.5140, lng: 80.2380, name: 'Hall 10',                cat: 'hostel' },
  { lat: 26.5150, lng: 80.2375, name: 'Hall 11',                cat: 'hostel' },
  { lat: 26.5158, lng: 80.2370, name: 'Hall 12',                cat: 'hostel' },
  { lat: 26.5098, lng: 80.2350, name: "Girls' Hostel 1",        cat: 'hostel' },
  { lat: 26.5092, lng: 80.2338, name: "Girls' Hostel 2",        cat: 'hostel' },
  // Amenities
  { lat: 26.5135, lng: 80.2325, name: 'OAT',                    cat: 'amenity' },
  { lat: 26.5115, lng: 80.2300, name: 'Shopping Complex',       cat: 'amenity' },
  { lat: 26.5122, lng: 80.2318, name: 'Student Gymkhana',       cat: 'amenity' },
  { lat: 26.5125, lng: 80.2310, name: 'Medical Center',         cat: 'amenity' },
  { lat: 26.5180, lng: 80.2308, name: 'Canteen North',          cat: 'amenity' },
  { lat: 26.5118, lng: 80.2332, name: 'Canteen South',          cat: 'amenity' },
  { lat: 26.5128, lng: 80.2302, name: 'Bank / ATM',             cat: 'amenity' },
  { lat: 26.5132, lng: 80.2295, name: 'Post Office',            cat: 'amenity' },
  { lat: 26.5128, lng: 80.2318, name: 'Bookstore',              cat: 'amenity' },
  { lat: 26.5142, lng: 80.2322, name: 'Central Cafeteria',      cat: 'amenity' },
  // Sports
  { lat: 26.5108, lng: 80.2295, name: 'Football Ground',        cat: 'sports' },
  { lat: 26.5095, lng: 80.2320, name: 'Cricket Ground',         cat: 'sports' },
  { lat: 26.5100, lng: 80.2280, name: 'Swimming Pool',          cat: 'sports' },
  { lat: 26.5105, lng: 80.2310, name: 'Basketball Court',       cat: 'sports' },
  { lat: 26.5110, lng: 80.2285, name: 'Tennis Court',           cat: 'sports' },
  { lat: 26.5102, lng: 80.2300, name: 'Hockey Ground',          cat: 'sports' },
  { lat: 26.5098, lng: 80.2315, name: 'Volleyball Court',       cat: 'sports' },
  { lat: 26.5112, lng: 80.2270, name: 'Athletic Track',         cat: 'sports' },
  // Drone Hubs
  { lat: 26.5145, lng: 80.2310, name: 'Hub Central',            cat: 'hub' },
  { lat: 26.5175, lng: 80.2265, name: 'Hub North',              cat: 'hub' },
  { lat: 26.5110, lng: 80.2340, name: 'Hub South-East',         cat: 'hub' },
  // Infrastructure
  { lat: 26.5140, lng: 80.2350, name: 'Research Station',       cat: 'infrastructure' },
  { lat: 26.5095, lng: 80.2270, name: 'Workshop Area',          cat: 'infrastructure' },
  // Power Station
  { lat: 26.5090, lng: 80.2375, name: 'Power Station',          cat: 'power' },
];

// Full patrol route
const PATROL_WAYPOINTS = [
  [26.5135, 80.2325], [26.5132, 80.2310], [26.5128, 80.2302], [26.5125, 80.2310],
  [26.5122, 80.2318], [26.5118, 80.2332], [26.5115, 80.2325], [26.5110, 80.2325],
  [26.5112, 80.2340], [26.5108, 80.2340], [26.5112, 80.2355], [26.5118, 80.2365],
  [26.5130, 80.2375], [26.5140, 80.2380], [26.5150, 80.2375], [26.5158, 80.2370],
  [26.5165, 80.2370], [26.5168, 80.2360], [26.5172, 80.2350], [26.5178, 80.2340],
  [26.5185, 80.2315], [26.5190, 80.2330], [26.5188, 80.2285], [26.5182, 80.2295],
  [26.5175, 80.2305], [26.5155, 80.2322], [26.5160, 80.2345], [26.5148, 80.2248],
  [26.5145, 80.2240], [26.5137, 80.2260], [26.5130, 80.2285], [26.5125, 80.2295],
  [26.5120, 80.2305], [26.5115, 80.2300], [26.5108, 80.2295], [26.5095, 80.2320],
  [26.5092, 80.2338], [26.5098, 80.2350], [26.5100, 80.2335], [26.5142, 80.2322],
  [26.5195, 80.2270], [26.5205, 80.2260], [26.5180, 80.2308], [26.5135, 80.2325],
];

// Node colors by category
const NODE_COLORS = {
  academic:       '#3b82f6',
  admin:          '#1e3a8a',
  hostel:         '#f97316',
  amenity:        '#10b981',
  sports:         '#8b5cf6',
  hub:            '#ef4444',
  power:          '#f59e0b',
  infrastructure: '#6b7280',
};

// Distance between two lat/lng in meters
function haversineM(a, b) {
  const R = 6371000;
  const dLat = (b[0] - a[0]) * Math.PI / 180;
  const dLng = (b[1] - a[1]) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(a[0] * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Check if a point is inside any NFZ circle
function insideNFZ(latLng) {
  for (const nfz of NFZ_CIRCLES) {
    const d = haversineM([latLng[0], latLng[1]], nfz.center);
    if (d < nfz.radius) return nfz;
  }
  return null;
}

// Generate perimeter bypass waypoints around an NFZ circle
function getNFZPerimeter(nfz, fromPt, toPt, numPts = 12) {
  const [clat, clng] = nfz.center;
  const radiusDeg = nfz.radius / 111000;
  const fromAngle = Math.atan2(fromPt[0] - clat, fromPt[1] - clng);
  const toAngle   = Math.atan2(toPt[0]   - clat, toPt[1]   - clng);
  const pts = [];
  let a = fromAngle;
  const step = (toAngle - fromAngle + 2 * Math.PI) % (2 * Math.PI);
  for (let i = 0; i <= numPts; i++) {
    const ang = a + (step / numPts) * i;
    pts.push([clat + Math.sin(ang) * radiusDeg * 1.2, clng + Math.cos(ang) * radiusDeg * 1.2]);
  }
  return pts;
}

// Linear interpolate between two waypoints at sub-step resolution
function interpolate(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

// ─── Sub-step expansion: insert fine-grained points between waypoints ─────────
function expandPath(waypoints) {
  const result = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    const nfz = insideNFZ(b);
    if (nfz) {
      const bypass = getNFZPerimeter(nfz, a, b);
      bypass.forEach(p => result.push(p));
    } else {
      const steps = 10;
      for (let s = 0; s <= steps; s++) {
        result.push(interpolate(a, b, s / steps));
      }
    }
  }
  return result;
}

// ─── Drone SVG Icon ───────────────────────────────────────────────────────────
function createDroneIcon(status, battery) {
  const isCharging  = status === 'CHARGING';
  const isAvoiding  = status === 'AVOIDING NFZ';
  const isReturning = status === 'RETURNING';
  const color = isCharging ? '#f59e0b' : isAvoiding ? '#ef4444' : isReturning ? '#f97316' : '#06b6d4';
  const pulse = isCharging ? '' :
    `<div style="position:absolute;inset:-6px;background:${color};border-radius:50%;opacity:0.2;animation:droneping 1s infinite;"></div>`;

  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:36px;height:36px;">
        ${pulse}
        <div style="
          width:36px;height:36px;border-radius:50%;
          background:${color};
          border:2px solid white;
          box-shadow:0 0 16px ${color}99;
          display:flex;align-items:center;justify-content:center;
          font-size:16px;
          transition:background 0.4s;
        ">
          ${isCharging ? '⚡' : isAvoiding ? '⚠️' : isReturning ? '🔋' : '🚁'}
        </div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

// ─── Power Station Icon ───────────────────────────────────────────────────────
const POWER_ICON = L.divIcon({
  className: '',
  html: `<div style="
    width:34px;height:34px;border-radius:6px;
    background:linear-gradient(135deg,#f59e0b,#d97706);
    border:2px solid white;
    box-shadow:0 0 14px #f59e0b88;
    display:flex;align-items:center;justify-content:center;
    font-size:18px;
  ">⚡</div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

// ─── Node Icon ────────────────────────────────────────────────────────────────
function nodeIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:10px;height:10px;border-radius:50%;
      background:${color};border:1.5px solid white;
      box-shadow:0 0 4px ${color}66;
    "></div>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  });
}

// ─── MapFly: pan to drone position ───────────────────────────────────────────
function MapFly({ position }) {
  const map = useMap();
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || JSON.stringify(ref.current) !== JSON.stringify(position)) {
      ref.current = position;
    }
  }, [position, map]);
  return null;
}

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────
const STATUS_META = {
  'PATROLLING':    { color: '#06b6d4', bg: '#0e7490', label: 'PATROLLING' },
  'AVOIDING NFZ':  { color: '#ef4444', bg: '#991b1b', label: 'AVOIDING RED ZONE' },
  'RETURNING':     { color: '#f97316', bg: '#c2410c', label: 'RTB — LOW BATTERY' },
  'CHARGING':      { color: '#f59e0b', bg: '#b45309', label: '⚡ CHARGING' },
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function DroneSimulationPage() {
  const fullPath     = useRef(expandPath(PATROL_WAYPOINTS));
  const chargeRoute  = useRef([]);
  const stepRef      = useRef(0);
  const intervalRef  = useRef(null);

  const [dronePos,    setDronePos]    = useState(PATROL_WAYPOINTS[0]);
  const [tracedPath,  setTracedPath]  = useState([PATROL_WAYPOINTS[0]]);
  const [status,      setStatus]      = useState('PATROLLING');
  const [battery,     setBattery]     = useState(100);
  const [chargeTime,  setChargeTime]  = useState(0);   // seconds remaining (sim)
  const [currentNode, setCurrentNode] = useState('OAT');
  const [speed,       setSpeed]       = useState(28);
  const [avoidingNFZ, setAvoidingNFZ] = useState(null);

  const statusRef   = useRef('PATROLLING');
  const batteryRef  = useRef(100);
  const chargeRef   = useRef(0);

  // nearest node name
  const nearestNode = useCallback((pos) => {
    let best = null, bestD = 999;
    for (const n of CAMPUS_NODES) {
      const d = haversineM([n.lat, n.lng], pos);
      if (d < bestD) { bestD = d; best = n.name; }
    }
    return best;
  }, []);

  // Build straight-line interpolated route to Power Station
  const buildChargeRoute = useCallback((fromPos) => {
    const steps = 60;
    const route = [];
    for (let i = 0; i <= steps; i++) {
      route.push(interpolate(fromPos, POWER_STATION_POS, i / steps));
    }
    return route;
  }, []);

  const tick = useCallback(() => {
    if (statusRef.current === 'CHARGING') {
      chargeRef.current -= 1;
      setChargeTime(chargeRef.current);
      if (chargeRef.current <= 0) {
        // Resume patrol
        batteryRef.current = 100;
        setBattery(100);
        stepRef.current = 0;
        statusRef.current = 'PATROLLING';
        setStatus('PATROLLING');
        setTracedPath([fullPath.current[0]]);
      }
      return;
    }

    if (statusRef.current === 'RETURNING') {
      const route = chargeRoute.current;
      if (stepRef.current >= route.length) {
        // Arrived at power station — start charging
        statusRef.current = 'CHARGING';
        chargeRef.current = 120; // 120 seconds = simulated 1 hour
        setStatus('CHARGING');
        setChargeTime(120);
        stepRef.current = 0;
        return;
      }
      const pos = route[stepRef.current];
      stepRef.current++;
      setDronePos(pos);
      setTracedPath(prev => [...prev.slice(-200), pos]);
      setCurrentNode(nearestNode(pos));
      return;
    }

    // PATROLLING or AVOIDING
    const path = fullPath.current;
    if (stepRef.current >= path.length) {
      stepRef.current = 0; // loop
    }

    const pos = path[stepRef.current];
    stepRef.current++;

    // Battery drain: 0.25% per tick (every 200ms * ~0.25 = ~100% per 80s)
    batteryRef.current = Math.max(0, batteryRef.current - 0.25);
    setBattery(parseFloat(batteryRef.current.toFixed(1)));

    // Low battery → return to charge
    if (batteryRef.current < 15 && statusRef.current !== 'RETURNING' && statusRef.current !== 'CHARGING') {
      statusRef.current = 'RETURNING';
      setStatus('RETURNING');
      chargeRoute.current = buildChargeRoute(pos);
      stepRef.current = 0;
      return;
    }

    // NFZ check
    const nfz = insideNFZ(pos);
    if (nfz) {
      statusRef.current = 'AVOIDING NFZ';
      setStatus('AVOIDING NFZ');
      setAvoidingNFZ(nfz.name);
    } else {
      if (statusRef.current === 'AVOIDING NFZ') {
        statusRef.current = 'PATROLLING';
        setStatus('PATROLLING');
        setAvoidingNFZ(null);
      }
    }

    setDronePos(pos);
    setTracedPath(prev => [...prev.slice(-300), pos]);
    setCurrentNode(nearestNode(pos));
    setSpeed(parseFloat((24 + Math.random() * 8).toFixed(1)));
  }, [buildChargeRoute, nearestNode]);

  useEffect(() => {
    intervalRef.current = setInterval(tick, 200);
    return () => clearInterval(intervalRef.current);
  }, [tick]);

  const statusMeta = STATUS_META[status] || STATUS_META['PATROLLING'];
  const batteryColor = battery < 15 ? '#ef4444' : battery < 40 ? '#f97316' : '#22c55e';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0f172a', overflow: 'hidden' }}>

      {/* ── CSS pulse animation ── */}
      <style>{`
        @keyframes droneping {
          0%,100% { transform:scale(1); opacity:0.2; }
          50%      { transform:scale(1.8); opacity:0; }
        }
        @keyframes chargepulse {
          0%,100% { opacity:1; }
          50%      { opacity:0.4; }
        }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        background: 'linear-gradient(90deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)',
        borderBottom: '1px solid #334155',
        padding: '12px 24px',
        display: 'flex', alignItems: 'center', gap: '16px', zIndex: 10,
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 24 }}>🚁</div>
        <div>
          <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 15, letterSpacing: 2, textTransform: 'uppercase' }}>
            IITK Drone Airspace — Live Simulation
          </div>
          <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, letterSpacing: 3 }}>
            64 NODES · OSM + A* HYBRID ROUTING · REAL CAMPUS BOUNDARIES
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {[
            { label: 'NODES', val: '64', color: '#3b82f6' },
            { label: 'PATHS', val: '844', color: '#10b981' },
            { label: 'NFZ', val: '5', color: '#ef4444' },
            { label: 'SUCCESS', val: '41.87%', color: '#f59e0b' },
          ].map(b => (
            <div key={b.label} style={{
              background: '#1e293b', border: `1px solid ${b.color}33`,
              borderRadius: 8, padding: '4px 10px', textAlign: 'center',
            }}>
              <div style={{ color: b.color, fontSize: 13, fontWeight: 800 }}>{b.val}</div>
              <div style={{ color: '#64748b', fontSize: 8, fontWeight: 700, letterSpacing: 2 }}>{b.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Map + HUD ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

        {/* Map */}
        <MapContainer
          center={CAMPUS_CENTER}
          zoom={CAMPUS_ZOOM}
          style={{ height: '100%', width: '100%', zIndex: 0 }}
          scrollWheelZoom
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution="&copy; CARTO"
          />

          {/* Exclusion zones */}
          {EXCLUSION_ZONES.map((ez, i) => (
            <Polygon
              key={`ez-${i}`}
              positions={ez.coords}
              pathOptions={{ color: '#ef4444', fillColor: '#ef444422', weight: 1.5, dashArray: '6,6' }}
            >
              <Tooltip sticky><span style={{ fontSize: 10, fontWeight: 700 }}>{ez.name}</span></Tooltip>
            </Polygon>
          ))}

          {/* NFZ Circles */}
          {NFZ_CIRCLES.map((nfz, i) => (
            <Circle
              key={`nfz-${i}`}
              center={nfz.center}
              radius={nfz.radius}
              pathOptions={{
                color: '#ef4444', fillColor: '#ef444433',
                weight: 2, dashArray: '8,6', fillOpacity: 0.35,
              }}
            >
              <Tooltip sticky>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#ef4444' }}>
                  🔴 {nfz.name}
                  <br /><span style={{ color: '#666' }}>R = {nfz.radius}m</span>
                </div>
              </Tooltip>
            </Circle>
          ))}

          {/* Campus Nodes */}
          {CAMPUS_NODES.map((n, i) => (
            <Marker
              key={`node-${i}`}
              position={[n.lat, n.lng]}
              icon={n.cat === 'power' ? POWER_ICON : nodeIcon(NODE_COLORS[n.cat] || '#94a3b8')}
            >
              <Tooltip>
                <span style={{ fontSize: 10, fontWeight: 700 }}>{n.name}</span>
              </Tooltip>
            </Marker>
          ))}

          {/* Patrol route (dim) */}
          <Polyline
            positions={PATROL_WAYPOINTS}
            pathOptions={{ color: '#334155', weight: 1.5, dashArray: '6,8', opacity: 0.6 }}
          />

          {/* Traced path (glow) */}
          {tracedPath.length > 1 && (
            <Polyline
              positions={tracedPath}
              pathOptions={{
                color: status === 'AVOIDING NFZ' ? '#ef4444' : status === 'RETURNING' ? '#f97316' : '#22d3ee',
                weight: 3,
                opacity: 0.85,
              }}
            />
          )}

          {/* Power Station marker (always visible) */}
          <Marker position={POWER_STATION_POS} icon={POWER_ICON}>
            <Tooltip permanent>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#f59e0b' }}>⚡ POWER STATION</span>
            </Tooltip>
          </Marker>

          {/* Drone */}
          <Marker
            position={dronePos}
            icon={createDroneIcon(status, battery)}
          >
            <Tooltip>
              <div style={{ fontSize: 10, fontWeight: 700 }}>
                🚁 {status}<br />
                🔋 {battery.toFixed(1)}%<br />
                📍 {currentNode}
              </div>
            </Tooltip>
          </Marker>
        </MapContainer>

        {/* ── HUD Panel ── */}
        <div style={{
          position: 'absolute', top: 16, right: 16, zIndex: 1000,
          background: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(16px)',
          border: '1px solid #334155', borderRadius: 16,
          padding: '16px', width: 220,
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
          fontFamily: 'monospace',
        }}>
          {/* Status badge */}
          <div style={{
            background: statusMeta.bg, borderRadius: 8, padding: '6px 10px',
            marginBottom: 14, textAlign: 'center',
            animation: status === 'CHARGING' ? 'chargepulse 1.2s infinite' : 'none',
          }}>
            <span style={{ color: statusMeta.color, fontSize: 10, fontWeight: 800, letterSpacing: 2 }}>
              {statusMeta.label}
            </span>
          </div>

          {/* Battery */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: '#94a3b8', fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>BATTERY</span>
              <span style={{ color: batteryColor, fontSize: 12, fontWeight: 800 }}>{battery.toFixed(1)}%</span>
            </div>
            <div style={{ background: '#1e293b', borderRadius: 4, height: 8, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 4,
                width: `${battery}%`,
                background: battery < 15
                  ? `linear-gradient(90deg, #ef4444, #f97316)`
                  : battery < 40
                  ? `linear-gradient(90deg, #f97316, #f59e0b)`
                  : `linear-gradient(90deg, #22c55e, #06b6d4)`,
                transition: 'width 0.2s, background 0.4s',
              }} />
            </div>
            {battery < 15 && status !== 'CHARGING' && (
              <div style={{ color: '#ef4444', fontSize: 8, fontWeight: 700, letterSpacing: 1, marginTop: 3, textAlign: 'center' }}>
                ⚠ LOW — RETURNING TO CHARGE
              </div>
            )}
          </div>

          {/* Charge countdown */}
          {status === 'CHARGING' && (
            <div style={{
              background: '#1e293b', borderRadius: 8, padding: '8px 10px', marginBottom: 12,
              border: '1px solid #f59e0b44',
            }}>
              <div style={{ color: '#f59e0b', fontSize: 8, fontWeight: 700, letterSpacing: 2 }}>TIME TO FULL CHARGE</div>
              <div style={{ color: '#fde68a', fontSize: 22, fontWeight: 900, textAlign: 'center', marginTop: 4 }}>
                {Math.floor(chargeTime / 60).toString().padStart(2,'0')}:{(chargeTime % 60).toString().padStart(2,'0')}
              </div>
              <div style={{ color: '#64748b', fontSize: 8, textAlign: 'center' }}>sim 2 min = 1 hour charge</div>
            </div>
          )}

          {/* Stats */}
          {[
            { label: 'SPEED',   val: `${speed} km/h` },
            { label: 'NEAR',    val: currentNode },
            { label: 'AVOID',   val: avoidingNFZ || '—' },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: '#475569', fontSize: 8, fontWeight: 700, letterSpacing: 1 }}>{r.label}</span>
              <span style={{ color: '#e2e8f0', fontSize: 9, fontWeight: 700, maxWidth: 130, textAlign: 'right', wordBreak: 'break-word' }}>
                {r.val}
              </span>
            </div>
          ))}

          <div style={{ borderTop: '1px solid #1e293b', marginTop: 10, paddingTop: 10 }}>
            <div style={{ color: '#334155', fontSize: 7, letterSpacing: 1, textAlign: 'center' }}>
              IITK DRONE AIRSPACE SIMULATOR v2.0
            </div>
          </div>
        </div>

        {/* ── Map Legend ── */}
        <div style={{
          position: 'absolute', bottom: 16, left: 16, zIndex: 1000,
          background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(12px)',
          border: '1px solid #334155', borderRadius: 12, padding: '12px 14px',
          minWidth: 160,
        }}>
          <div style={{ color: '#94a3b8', fontSize: 8, fontWeight: 800, letterSpacing: 2, marginBottom: 8 }}>MAP LEGEND</div>
          {[
            { color: '#22d3ee',  label: 'Drone traced path' },
            { color: '#334155',  label: 'Patrol route' },
            { color: '#ef4444',  label: 'No-fly zone (NFZ)' },
            { color: '#3b82f6',  label: 'Academic nodes' },
            { color: '#f97316',  label: 'Hostel nodes' },
            { color: '#10b981',  label: 'Amenity nodes' },
            { color: '#f59e0b',  label: '⚡ Power Station' },
            { color: '#8b5cf6',  label: 'Sports nodes' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.color, flexShrink: 0 }} />
              <span style={{ color: '#64748b', fontSize: 8, fontWeight: 600 }}>{l.label}</span>
            </div>
          ))}
        </div>

        {/* ── Route Stats footer ── */}
        <div style={{
          position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 1000,
          display: 'flex', gap: 8,
        }}>
          {[
            { label: 'OSM PATHS', val: '39', color: '#3b82f6' },
            { label: 'A* GRID',   val: '805', color: '#8b5cf6' },
            { label: 'BLOCKED',   val: '1172', color: '#ef4444' },
            { label: 'SAFE AREA', val: '58.69%', color: '#22c55e' },
          ].map(s => (
            <div key={s.label} style={{
              background: 'rgba(15,23,42,0.9)', border: `1px solid ${s.color}44`,
              borderRadius: 8, padding: '5px 10px', textAlign: 'center', backdropFilter: 'blur(8px)',
            }}>
              <div style={{ color: s.color, fontSize: 12, fontWeight: 900 }}>{s.val}</div>
              <div style={{ color: '#475569', fontSize: 7, fontWeight: 700, letterSpacing: 1 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
