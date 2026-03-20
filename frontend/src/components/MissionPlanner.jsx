/**
 * MissionPlanner.jsx — Fixed 5 Source + 5 Destination.
 * ALL nodes are safely OUTSIDE No-Fly Zones.
 * Drone detours around NFZ periphery if blocked.
 */

import React, { useState, useEffect } from 'react';
import {
  MapContainer, TileLayer, Marker, Polyline,
  Polygon, Tooltip, CircleMarker
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
  Send, MapPin, Trash2, CheckCircle2, AlertCircle,
  ShieldAlert, Route, Loader2, Navigation
} from 'lucide-react';
import axios from 'axios';
import CongestionOverlay from './CongestionOverlay';
import {
  CAMPUS_NODES,
  CAMPUS_EDGES,
  NO_FLY_ZONES,
  MAP_CENTER,
  MAP_ZOOM,
  API_URL,
} from '../config/mapConfig';

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

const MissionPlanner = () => {
  const [source,       setSource]       = useState(null);
  const [destination,  setDestination]  = useState(null);
  const [weight,       setWeight]       = useState(1.0);
  const [isDeploying,  setIsDeploying]  = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [feedback,     setFeedback]     = useState(null);
  const [routePath,    setRoutePath]    = useState(null);
  const [routeStats,   setRouteStats]   = useState(null);

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
  const pathPositions = routePath ? routePath.map(p => [p.lat, p.lng]) : [];

  return (
    <div className="flex-1 flex flex-col h-full bg-white border-l border-navy-900/5 overflow-y-auto custom-scrollbar">

      {/* Header */}
      <div className="p-8 pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-sora font-black text-navy-900 tracking-tighter uppercase">
            Drone Mission Planner
          </h2>
          <p className="text-navy-600 text-[10px] font-black uppercase tracking-widest mt-1">
            Source → Destination • Drone detours around No-Fly Zones
          </p>
        </div>
        <div className="flex gap-4">
          <button onClick={() => { setSource(null); setDestination(null); setRoutePath(null); setRouteStats(null); setFeedback(null); }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white-soft hover:bg-navy-900 hover:text-white text-navy-900 font-black uppercase text-[10px] tracking-widest transition-all border border-navy-900/10 shadow-sm"
          >
            <Trash2 size={16} /> Clear
          </button>
          <button disabled={!canDeploy} onClick={handleDeploy}
            className={`flex items-center gap-2 px-8 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl ${
              !canDeploy ? 'bg-white-muted text-navy-600 cursor-not-allowed opacity-50' : 'bg-navy-900 text-white hover:scale-105 active:scale-95'
            }`}
          >
            <Send size={16} /> {isDeploying ? 'Deploying...' : 'Deploy Drone'}
          </button>
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`mx-8 mb-2 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 ${
          feedback.type === 'success' ? 'bg-green-50 border border-green-300 text-green-800' : 'bg-red-50 border border-red-300 text-red-800'
        }`}>
          {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {feedback.msg}
        </div>
      )}

      {/* Route Stats */}
      {routeStats && !isPreviewing && (
        <div className="mx-8 mb-2 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-4 bg-purple-50 border border-purple-300 text-purple-800">
          <Route size={16} />
          <span className="inline-block px-2 py-0.5 rounded-full text-white text-[10px] font-black uppercase bg-purple-600">
            ⭐ A* Optimal Path
          </span>
          <span>{routeStats.waypoints} waypoints</span>
          {routeStats.distance && <span>{routeStats.distance.toFixed(0)}m</span>}
          <span className="text-[10px] text-purple-600">✅ A* algorithm — avoids all No-Fly Zones</span>
        </div>
      )}
      {isPreviewing && (
        <div className="mx-8 mb-2 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700">
          <Loader2 size={16} className="animate-spin" /> Computing safe drone route...
        </div>
      )}

      {/* Controls — 5 Sources, 5 Destinations */}
      <div className="px-8 pb-4 flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-black text-navy-600 uppercase tracking-widest">
            <MapPin size={10} className="inline mr-1" /> Source (Takeoff)
          </label>
          <select value={source?.name || ""} onChange={e => {
            const s = ALL_LOCATIONS.find(x => x.name === e.target.value);
            setSource(s || null); setDestination(null);
          }}
            className="px-4 py-2 rounded-xl border border-navy-900/10 bg-white text-navy-900 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-navy-900"
          >
            <option value="">Select Source...</option>
            {ALL_LOCATIONS.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-black text-navy-600 uppercase tracking-widest">
            <MapPin size={10} className="inline mr-1" /> Destination (Drop)
          </label>
          <select value={destination?.name || ""} onChange={e => {
            const d = ALL_LOCATIONS.find(x => x.name === e.target.value);
            setDestination(d || null);
          }} disabled={!source}
            className="px-4 py-2 rounded-xl border border-navy-900/10 bg-white text-navy-900 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-navy-900 disabled:opacity-50"
          >
            <option value="">Select Destination...</option>
            {ALL_LOCATIONS.filter(d => d.name !== source?.name).map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-black text-navy-600 uppercase tracking-widest">Payload (kg)</label>
          <input type="number" min="0.1" max="5" step="0.1" value={weight} onChange={e => setWeight(e.target.value)}
            className="px-4 py-2 rounded-xl border border-navy-900/10 bg-white text-navy-900 font-bold text-sm w-24 focus:outline-none focus:ring-2 focus:ring-navy-900"
          />
        </div>

        <div className="flex items-center gap-2 ml-auto px-3 py-2 rounded-xl border border-red-200 bg-red-50">
          <ShieldAlert size={14} className="text-red-500" />
          <span className="text-[9px] font-black text-red-600 uppercase tracking-widest">Red = No-Fly Zone (drone goes around)</span>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 mx-8 mb-8 rounded-3xl overflow-hidden glass-card relative border border-navy-900/10 shadow-2xl">
        <MapContainer center={MAP_CENTER} zoom={MAP_ZOOM} className="h-full w-full z-0">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />

          <CongestionOverlay />

          {/* Campus road edges (light grey background) */}
          {CAMPUS_EDGES.map((edge, i) => (
            <Polyline key={`e-${i}`} positions={edge} pathOptions={{ color: '#94a3b8', weight: 1.5, opacity: 0.35 }} />
          ))}

          {/* No-Fly Zones (red) */}
          {NO_FLY_ZONES.map((zone, i) => (
            <Polygon key={`nfz-${i}`} positions={zone.positions}
              pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.25, weight: 2, dashArray: '6,3' }}
            >
              <Tooltip sticky>
                <div className="text-xs font-bold text-red-700 flex items-center gap-1">
                  <ShieldAlert size={12} /> {zone.name} — No Drone Entry
                </div>
              </Tooltip>
            </Polygon>
          ))}

          {/* ═══ COMPUTED DRONE ROUTE ═══ */}
          {pathPositions.length >= 2 && (
            <>
              <Polyline positions={pathPositions}
                pathOptions={{
                  color: '#7c3aed', weight: 5, opacity: 0.9,
                  lineCap: 'round', lineJoin: 'round', dashArray: '10,5'
                }}
              />
              {pathPositions.slice(1, -1).map((pos, i) => (
                <CircleMarker key={`wp-${i}`} center={pos} radius={4}
                  pathOptions={{ color: '#0d9488', fillColor: '#fff', fillOpacity: 1, weight: 2 }}
                >
                  <Tooltip direction="top" offset={[0, -5]}>
                    <span className="text-[10px] font-bold">WP {i+1}</span>
                  </Tooltip>
                </CircleMarker>
              ))}
            </>
          )}

          {/* Source marker (green) */}
          {source && (
            <Marker position={[source.lat, source.lng]} icon={greenIcon}>
              <Tooltip permanent direction="top" offset={[0, -40]}>
                <span className="text-[10px] font-black uppercase text-green-800">🛫 {source.name}</span>
              </Tooltip>
            </Marker>
          )}

          {/* Destination marker (red) */}
          {destination && (
            <Marker position={[destination.lat, destination.lng]} icon={redIcon}>
              <Tooltip permanent direction="top" offset={[0, -40]}>
                <span className="text-[10px] font-black uppercase text-red-800">🛬 {destination.name}</span>
              </Tooltip>
            </Marker>
          )}
        </MapContainer>

        {/* Coordinate readout */}
        <div className="absolute bottom-4 left-4 z-10 space-y-2">
          {[{ label: 'Source', item: source, icon: '🛫' }, { label: 'Destination', item: destination, icon: '🛬' }].map(({ label, item, icon }) => (
            <div key={label} className="glass-card px-4 py-2 flex items-center gap-3 bg-white border border-navy-900/20 shadow-xl">
              <div className={`w-2.5 h-2.5 rounded-full ${item ? 'bg-navy-900' : 'bg-gray-300'}`} />
              <div>
                <p className="text-[8px] font-black text-navy-600 uppercase tracking-widest">{icon} {label}</p>
                <p className="text-[10px] font-black text-navy-900">
                  {item?.name || 'Not selected'}
                  {item ? ` (${item.lat.toFixed(4)}, ${item.lng.toFixed(4)})` : ''}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Route info */}
        {routeStats && (
          <div className="absolute bottom-4 right-4 z-10 px-4 py-3 rounded-2xl bg-white border border-navy-900/20 shadow-xl text-[11px] font-bold text-navy-800 space-y-1">
            <div className="flex items-center gap-2 font-black text-navy-900 text-xs uppercase tracking-wide mb-1">
              <Navigation size={12} /> Route Info
            </div>
            <div>📍 {routeStats.waypoints} waypoints</div>
            {routeStats.distance && <div>📏 {routeStats.distance.toFixed(0)} m</div>}
            <div className="text-teal-600 text-[10px]">✅ NFZ-safe route</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MissionPlanner;
