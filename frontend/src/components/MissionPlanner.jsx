/**
 * MissionPlanner.jsx — Fixed 5 Source + 5 Destination.
 * ALL nodes are safely OUTSIDE No-Fly Zones.
 * Drone detours around NFZ periphery if blocked.
 */

import React, { useState, useEffect } from 'react';
import {
  MapContainer, TileLayer, Marker, Polyline,
  Polygon, Circle, Tooltip, CircleMarker, useMapEvents
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
  Send, MapPin, Trash2, CheckCircle2, AlertCircle,
  ShieldAlert, Route, Loader2, Navigation
} from 'lucide-react';
import axios from 'axios';
import SharedAirspaceMap from './SharedAirspaceMap';
import {
  CAMPUS_NODES,
  CAMPUS_EDGES,
  NO_FLY_ZONES,
  MAP_CENTER,
  MAP_ZOOM,
  API_URL,
} from '../config/mapConfig';
import { useZones } from '../hooks/useZones';
import { useAIPredictions } from '../hooks/useAIPredictions';

const ZONE_COLORS = {
  NO_FLY:     { stroke: '#ef4444', fill: '#ef4444' },
  RESTRICTED: { stroke: '#eab308', fill: '#eab308' },
  PRIORITY:   { stroke: '#3b82f6', fill: '#3b82f6' },
};

function zoneGeomToPositions(geometry) {
  if (!geometry) return null;
  if (geometry.type === 'Circle') {
    const [lng, lat] = geometry.coordinates[0];
    return { center: [lat, lng], radius: geometry.radius || 100 };
  }
  const ring = geometry.coordinates[0] || [];
  return (ring || [])?.map(([lng, lat]) => [lat, lng]);
}

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  iconSize: [25, 41], iconAnchor: [12, 41],
});
const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  iconSize: [25, 41], iconAnchor: [12, 41],
});

// ═══════════════════════════════════════════════════════════
// 15 LOCATIONS — any can be Source OR Destination
// ★ = NORTH/EAST of NFZ cluster → most combos force A* bypass
// NFZ cluster is at lat 26.515-26.520, lng 80.230-80.236
// ═══════════════════════════════════════════════════════════
const ALL_LOCATIONS = [
  // ── NORTH OF NFZs (routes going south WILL cross red zones) ──
  { name: "North Launchpad",     lat: 26.5212, lng: 80.2328 },  // ★ directly above LHC NFZ
  { name: "Guest House",         lat: 26.5195, lng: 80.2270 },  // ★ NW of NFZs
  { name: "Faculty Res. B",      lat: 26.5210, lng: 80.2275 },  // ★ far NW
  { name: "NE Research Post",    lat: 26.5205, lng: 80.2380 },  // ★ NE corner, above Research Labs NFZ
  { name: "Airfield Alpha",     lat: 26.5218, lng: 80.2345 },  // ★ far north, above everything

  // ── SOUTH / SAFE ZONE (below all NFZs) ──
  { name: "Hub Central",         lat: 26.5140, lng: 80.2318 },
  { name: "Hub South",           lat: 26.5088, lng: 80.2330 },
  { name: "Hub East",            lat: 26.5148, lng: 80.2392 },
  { name: "Hall 5",              lat: 26.5110, lng: 80.2325 },
  { name: "Cricket Ground",      lat: 26.5095, lng: 80.2320 },
  { name: "Medical Center",      lat: 26.5125, lng: 80.2310 },
  { name: "Hall 9",              lat: 26.5130, lng: 80.2375 },
  { name: "Football Ground",     lat: 26.5108, lng: 80.2295 },
  { name: "OAT",                 lat: 26.5135, lng: 80.2325 },
  { name: "Shopping Complex",    lat: 26.5115, lng: 80.2300 },
];

// ─────────────────────────────────────────────
// MAP CLICK HANDLER — picks lat/lng on click
// ─────────────────────────────────────────────
const MapClickHandler = ({ onClick }) => {
  useMapEvents({
    click(e) {
      onClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    }
  });
  return null;
};

const MissionPlanner = () => {
  const [source,       setSource]       = useState(null);
  const [destination,  setDestination]  = useState(null);
  const [weight,       setWeight]       = useState(1.0);
  const [isDeploying,  setIsDeploying]  = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [feedback,     setFeedback]     = useState(null);
  const [routePath,    setRoutePath]    = useState(null);
  const [routeStats,   setRouteStats]   = useState(null);
  const [clickMode,    setClickMode]    = useState(false); // map click mode
  const { zones } = useZones();
  const [windX,        setWindX]        = useState(5.0);
  const [windY,        setWindY]        = useState(0.0);
  const [batteryPrediction, setBatteryPrediction] = useState(null);
  const { predictBattery } = useAIPredictions();

  const handleMapClick = (latlng) => {
    if (!clickMode) return;
    if (!source) {
      setSource({ name: `📍 ${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`, ...latlng });
    } else if (!destination) {
      setDestination({ name: `📍 ${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`, ...latlng });
      setClickMode(false); // done picking
    }
  };

  // Auto-preview route when both selected
  useEffect(() => {
    setRoutePath(null);
    setRouteStats(null);
    setFeedback(null);
    if (!source || !destination) return;

    let cancelled = false;
    setIsPreviewing(true);

    axios.post(`${API_URL}/missions/preview-route`, {
      pickupLocation: { lat: source.lat, lng: source.lng },
      dropLocation:   { lat: destination.lat, lng: destination.lng },
    })
    .then(res => {
      if (cancelled) return;
      const d = res.data?.data || {};
      setRoutePath(d.path || []);
      setRouteStats({ distance: d.distance, waypoints: d.waypoints, method: d.source });
    })
    .catch(err => {
      if (cancelled) return;
      setRoutePath([
        { lat: source.lat, lng: source.lng },
        { lat: destination.lat, lng: destination.lng },
      ]);
    })
    .finally(() => { if (!cancelled) setIsPreviewing(false); });

    return () => { cancelled = true; };
  }, [source, destination]);

  useEffect(() => {
    if (!routeStats || !routeStats.distance) {
      setBatteryPrediction(null);
      return;
    }
    let cancelled = false;
    const windMagnitude = Math.sqrt(windX * windX + windY * windY);
    predictBattery({
      distance: routeStats.distance / 1000,
      windSpeed: windMagnitude,
      payload: parseFloat(weight)
    }).then(res => {
      if (!cancelled) setBatteryPrediction(res);
    }).catch(err => {
      console.error("Battery prediction error:", err);
      if (!cancelled) setBatteryPrediction(null);
    });
    return () => { cancelled = true; };
  }, [routeStats, weight, windX, windY, predictBattery]);

  const handleDeploy = async () => {
    if (!source || !destination) return;
    setIsDeploying(true);
    setFeedback(null);
    try {
      const res = await axios.post(`${API_URL}/missions/dispatch`, {
        pickupLocation: { lat: source.lat, lng: source.lng },
        dropLocation:   { lat: destination.lat, lng: destination.lng },
        weight: parseFloat(weight),
      });
      const { missionId, droneId } = res.data?.data || res.data;
      setFeedback({ type: 'success', msg: `✅ Dispatched! Mission: ${missionId || 'OK'} | Drone: ${droneId || 'Assigned'}` });
      setSource(null); setDestination(null); setRoutePath(null); setRouteStats(null);
    } catch (error) {
      setFeedback({ type: 'error', msg: `❌ Failed: ${error.response?.data?.message || error.message}` });
    } finally {
      setIsDeploying(false);
    }
  };

  const canDeploy = source && destination && !isDeploying && !isPreviewing;
  const pathPositions = routePath ? routePath?.map(p => [p.lat, p.lng]) : [];

  return (
    <div className="flex-1 flex flex-col h-full bg-white border-l border-navy-900/5 overflow-hidden p-4 md:p-6 gap-3">

      {/* Header */}
      <div className="flex items-center justify-between pb-1 flex-shrink-0">
        <div>
          <h2 className="text-2xl md:text-3xl font-sora font-black text-navy-900 tracking-tighter uppercase">
            Drone Mission Planner
          </h2>
          <p className="text-navy-600 text-[10px] font-black uppercase tracking-widest mt-0.5">
            Source → Destination • Drone detours around No-Fly Zones
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { setClickMode(true); setSource(null); setDestination(null); setRoutePath(null); setRouteStats(null); setFeedback(null); }}
            className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-colors border ${
              clickMode ? 'bg-green-500 text-white border-green-600 animate-pulse' : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
            }`} title="Click on map to pick source & destination">
            <MapPin size={14} className="inline mr-1" /> Pick on Map
          </button>
          <button onClick={() => { setClickMode(false); setSource(null); setDestination(null); setRoutePath(null); setRouteStats(null); setFeedback(null); }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white-soft hover:bg-navy-900 hover:text-white text-navy-900 font-black uppercase text-[10px] tracking-widest transition-all border border-navy-900/10 shadow-sm"
          >
            <Trash2 size={14} /> Clear
          </button>
          <button disabled={!canDeploy} onClick={handleDeploy}
            className={`flex items-center gap-2 px-6 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl ${
              !canDeploy ? 'bg-white-muted text-navy-600 cursor-not-allowed opacity-50' : 'bg-navy-900 text-white hover:scale-105 active:scale-95'
            }`}
          >
            <Send size={14} /> {isDeploying ? 'Deploying...' : 'Deploy Drone'}
          </button>
        </div>
      </div>

      {/* Feedback / Instructions / Route Stats Banner (compact, flex-shrink-0) */}
      <div className="flex-shrink-0 space-y-1.5">
        {feedback && (
          <div className={`px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
            feedback.type === 'success' ? 'bg-green-50 border border-green-300 text-green-800' : 'bg-red-50 border border-red-300 text-red-800'
          }`}>
            {feedback.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            {feedback.msg}
          </div>
        )}

        {clickMode && (
          <div className="px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 bg-green-50 border-2 border-green-400 text-green-800 animate-pulse">
            <MapPin size={16} className="text-green-600" />
            {!source
              ? "👆 Click anywhere on the map to set SOURCE (takeoff point)"
              : "👆 Now click on the map to set DESTINATION (drop point)"}
          </div>
        )}

        {routeStats && !isPreviewing && (
          <div className="px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-3 bg-purple-50 border border-purple-300 text-purple-800">
            <Route size={14} />
            <span className="inline-block px-2 py-0.5 rounded-full text-white text-[9px] font-black uppercase bg-purple-600">
              ⭐ A* Optimal Path
            </span>
            <span>{routeStats.waypoints} waypoints</span>
            {routeStats.distance && <span>{routeStats.distance.toFixed(0)}m</span>}
            <span className="text-[10px] text-purple-600 ml-auto">✅ A* algorithm — avoids all No-Fly Zones</span>
          </div>
        )}

        {isPreviewing && (
          <div className="px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700">
            <Loader2 size={14} className="animate-spin" /> Computing safe drone route...
          </div>
        )}
      </div>

      {/* Main Content: Map + Right Panel (Fills remaining height without scroll) */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4">
        {/* Center Map Area */}
        <div className="flex-1 h-full min-h-0 rounded-3xl overflow-hidden glass-card relative border border-navy-900/10 shadow-2xl">
          <SharedAirspaceMap className="h-full w-full z-0" showCongestion>
            {/* Map click handler for picking source/dest */}
            <MapClickHandler onClick={handleMapClick} />

            {/* ═══ COMPUTED DRONE ROUTE (Teal Beaded Corridor with Turn Markers) ═══ */}
            {pathPositions.length >= 2 && (
              <>
                {/* Underlying guide track */}
                <Polyline
                  positions={pathPositions}
                  pathOptions={{
                    color: '#0d9488',
                    weight: 2.5,
                    opacity: 0.85,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />

                {/* Teal hollow waypoint beads */}
                {pathPositions.map((pos, i) => (
                  <CircleMarker
                    key={`wp-${i}`}
                    center={pos}
                    radius={3.5}
                    pathOptions={{
                      color: '#0d9488',
                      fillColor: '#ffffff',
                      fillOpacity: 1,
                      weight: 2,
                    }}
                  />
                ))}

                {/* Corner / Turn markers at significant direction changes */}
                {routePath && routePath.length >= 5 && (() => {
                  const turns = [];
                  for (let i = 2; i < routePath.length - 2; i++) {
                    const p1 = routePath[i - 2];
                    const p2 = routePath[i];
                    const p3 = routePath[i + 2];
                    const b1 = Math.atan2(p2.lng - p1.lng, p2.lat - p1.lat);
                    const b2 = Math.atan2(p3.lng - p2.lng, p3.lat - p2.lat);
                    let diff = Math.abs((b2 - b1) * (180 / Math.PI));
                    if (diff > 180) diff = 360 - diff;
                    if (diff > 35) {
                      if (turns.length === 0 || i - turns[turns.length - 1].idx > 8) {
                        turns.push({ lat: p2.lat, lng: p2.lng, idx: i });
                      }
                    }
                  }
                  return turns.map((t, idx) => (
                    <Marker
                      key={`turn-${idx}`}
                      position={[t.lat, t.lng]}
                      icon={L.divIcon({
                        className: '',
                        html: `<div style="
                          width: 14px;
                          height: 14px;
                          background: #ef4444;
                          border: 2px solid #ffffff;
                          border-radius: 3px;
                          box-shadow: 0 2px 6px rgba(0,0,0,0.35);
                        "></div>`,
                        iconAnchor: [7, 7]
                      })}
                    />
                  ));
                })()}
              </>
            )}

            {/* Markers */}
            {source && (
              <>
                <Marker position={[source.lat, source.lng]} icon={greenIcon}>
                  <Tooltip permanent direction="top" offset={[0, -35]}>
                    <span className="font-bold text-xs text-green-700">🛫 {source.name}</span>
                  </Tooltip>
                </Marker>
                {/* Floating Coordinates Badge */}
                <Marker
                  position={[source.lat, source.lng]}
                  icon={L.divIcon({
                    className: '',
                    html: `<div style="
                      background: rgba(255, 255, 255, 0.96);
                      backdrop-filter: blur(8px);
                      border: 1px solid rgba(15, 23, 42, 0.12);
                      border-radius: 8px;
                      padding: 2px 8px;
                      box-shadow: 0 3px 10px rgba(0,0,0,0.12);
                      display: flex;
                      align-items: center;
                      gap: 4px;
                      white-space: nowrap;
                      font-size: 11px;
                      font-weight: 800;
                      color: #065f46;
                    ">
                      <span style="font-size: 10px;">🛫</span>
                      <span>${source.lat.toFixed(4)}, ${source.lng.toFixed(4)}</span>
                    </div>`,
                    iconAnchor: [55, 44]
                  })}
                />
              </>
            )}
            {destination && (
              <>
                <Marker position={[destination.lat, destination.lng]} icon={redIcon}>
                  <Tooltip permanent direction="top" offset={[0, -35]}>
                    <span className="font-bold text-xs text-red-700">🛬 {destination.name}</span>
                  </Tooltip>
                </Marker>
                {/* Floating Coordinates Badge */}
                <Marker
                  position={[destination.lat, destination.lng]}
                  icon={L.divIcon({
                    className: '',
                    html: `<div style="
                      background: rgba(255, 255, 255, 0.96);
                      backdrop-filter: blur(8px);
                      border: 1px solid rgba(15, 23, 42, 0.12);
                      border-radius: 8px;
                      padding: 2px 8px;
                      box-shadow: 0 3px 10px rgba(0,0,0,0.12);
                      display: flex;
                      align-items: center;
                      gap: 4px;
                      white-space: nowrap;
                      font-size: 11px;
                      font-weight: 800;
                      color: #991b1b;
                    ">
                      <span style="font-size: 10px;">📍</span>
                      <span>${destination.lat.toFixed(4)}, ${destination.lng.toFixed(4)}</span>
                    </div>`,
                    iconAnchor: [-10, 44]
                  })}
                />
              </>
            )}
          </SharedAirspaceMap>

          {/* Source/Dest HUD overlay bottom-left */}
          <div className="absolute bottom-4 left-4 z-[1000] flex flex-col gap-2 pointer-events-none">
            {source && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/95 backdrop-blur shadow-md border border-navy-900/10 text-xs font-bold text-navy-900">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span>Source: {source.name}</span>
              </div>
            )}
            {destination && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/95 backdrop-blur shadow-md border border-navy-900/10 text-xs font-bold text-navy-900">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                <span>Dest: {destination.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar: All Controls, Inputs, and Route Details */}
        <div className="w-full lg:w-[340px] flex flex-col gap-4">
          <div className="p-5 rounded-3xl glass-card border border-navy-900/10 shadow-xl bg-white/80 backdrop-blur space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-navy-900 border-b border-navy-900/10 pb-2">
              Mission Parameters
            </h3>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-navy-600 uppercase tracking-widest flex items-center gap-1">
                <MapPin size={12} className="text-green-600" /> Source (Takeoff)
              </label>
              <select value={source?.name || ""} onChange={e => {
                const s = ALL_LOCATIONS.find(x => x.name === e.target.value);
                setSource(s || null); setDestination(null);
              }}
                className="w-full px-3 py-2.5 rounded-xl border border-navy-900/10 bg-white text-navy-900 font-bold text-xs focus:outline-none focus:ring-2 focus:ring-navy-900 shadow-sm"
              >
                <option value="">Select Source...</option>
                {ALL_LOCATIONS?.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-navy-600 uppercase tracking-widest flex items-center gap-1">
                <MapPin size={12} className="text-red-600" /> Destination (Drop)
              </label>
              <select value={destination?.name || ""} onChange={e => {
                const d = ALL_LOCATIONS.find(x => x.name === e.target.value);
                setDestination(d || null);
              }} disabled={!source}
                className="w-full px-3 py-2.5 rounded-xl border border-navy-900/10 bg-white text-navy-900 font-bold text-xs focus:outline-none focus:ring-2 focus:ring-navy-900 disabled:opacity-50 shadow-sm"
              >
                <option value="">Select Destination...</option>
                {ALL_LOCATIONS?.filter(d => d.name !== source?.name)?.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-black text-navy-600 uppercase tracking-widest truncate">Payload(kg)</label>
                <input type="number" min="0.1" max="5" step="0.1" value={weight} onChange={e => setWeight(e.target.value)}
                  className="w-full px-2 py-2 rounded-xl border border-navy-900/10 bg-white text-navy-900 font-bold text-xs text-center focus:outline-none focus:ring-2 focus:ring-navy-900"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-black text-navy-600 uppercase tracking-widest truncate">Wind X</label>
                <input type="number" min="-35" max="35" step="1" value={windX} onChange={e => setWindX(e.target.value)}
                  className="w-full px-2 py-2 rounded-xl border border-navy-900/10 bg-white text-navy-900 font-bold text-xs text-center focus:outline-none focus:ring-2 focus:ring-navy-900"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-black text-navy-600 uppercase tracking-widest truncate">Wind Y</label>
                <input type="number" min="-35" max="35" step="1" value={windY} onChange={e => setWindY(e.target.value)}
                  className="w-full px-2 py-2 rounded-xl border border-navy-900/10 bg-white text-navy-900 font-bold text-xs text-center focus:outline-none focus:ring-2 focus:ring-navy-900"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded-xl border border-red-200 bg-red-50/80">
              <ShieldAlert size={14} className="text-red-500 flex-shrink-0" />
              <span className="text-[9px] font-black text-red-600 uppercase tracking-wider">
                Red Zones: Protected NFZ (Auto-detour active)
              </span>
            </div>
          </div>

          {/* Route Info & Predictions Card */}
          {routeStats && (
            <div className="p-5 rounded-3xl glass-card border border-navy-900/10 shadow-xl bg-white/80 backdrop-blur space-y-3">
              <div className="flex items-center justify-between border-b border-navy-900/10 pb-2">
                <span className="text-xs font-black uppercase tracking-widest text-navy-900 flex items-center gap-1.5">
                  <Route size={14} className="text-purple-600" /> Route Info
                </span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                  A* Verified
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-navy-900/5">
                  <span className="text-navy-600 font-semibold">Total Waypoints:</span>
                  <span className="font-bold text-navy-900">{routeStats.waypoints}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-navy-900/5">
                  <span className="text-navy-600 font-semibold">Total Distance:</span>
                  <span className="font-bold text-navy-900">{routeStats.distance?.toFixed(0)}m</span>
                </div>
                {batteryPrediction && (
                  <div className="flex justify-between items-center py-1">
                    <span className="text-navy-600 font-semibold">Est. Battery Drain:</span>
                    <span className="font-bold text-emerald-600">~{batteryPrediction.drain}%</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MissionPlanner;
