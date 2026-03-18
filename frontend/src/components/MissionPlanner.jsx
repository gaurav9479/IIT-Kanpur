/**
 * MissionPlanner.jsx — Updated with real notebook data.
 * - Campus node dropdowns from CAMPUS_NODES (real OSMnx coordinates)
 * - OSM road network edges rendered as dark polylines
 * - No-fly zones rendered as red shaded polygons
 */

import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Polygon, Tooltip, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Send, MapPin, Trash2, CheckCircle2, AlertCircle, ShieldAlert } from 'lucide-react';
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

const CAMPUS_NAMES = Object.keys(CAMPUS_NODES);

const MissionPlanner = () => {
  const [source,      setSource]      = useState(null); // { name, lat, lng }
  const [destination, setDestination] = useState(null); // { name, lat, lng }
  const [snapToHub,   setSnapToHub]   = useState(false);
  const [weight,      setWeight]      = useState(1.0);
  const [isDeploying, setIsDeploying] = useState(false);
  const [feedback,    setFeedback]    = useState(null);

  // Helper to find nearest campus node for snapping
  const findNearestNode = (lat, lng) => {
    let nearestName = null;
    let minDist = Infinity;
    
    CAMPUS_NAMES.forEach(name => {
      const node = CAMPUS_NODES[name];
      const d = Math.sqrt(Math.pow(node.lat - lat, 2) + Math.pow(node.lng - lng, 2));
      if (d < minDist) {
        minDist = d;
        nearestName = name;
      }
    });
    return { name: nearestName, ...CAMPUS_NODES[nearestName] };
  };

  const MapClickHandler = () => {
    useMapEvents({
      click(e) {
        const { lat, lng } = e.latlng;
        const point = snapToHub 
          ? findNearestNode(lat, lng)
          : { name: `Point (${lat.toFixed(4)}, ${lng.toFixed(4)})`, lat, lng };
        
        if (!source) {
          setSource(point);
        } else if (!destination && (point.lat !== source.lat || point.lng !== source.lng)) {
          setDestination(point);
        }
      },
    });
    return null;
  };

  const handleDeploy = async () => {
    if (!source || !destination) return;
    setIsDeploying(true);
    setFeedback(null);
    try {
      const res = await axios.post(`${API_URL}/missions/dispatch`, {
        pickupLocation: { lat: source.lat, lng: source.lng },
        dropLocation:   { lat: destination.lat, lng: destination.lng },
        weight:          parseFloat(weight),
      });
      const { missionId, droneId } = res.data?.data || res.data;
      setFeedback({
        type: 'success',
        msg: `✅ Mission Dispatched! ID: ${missionId || 'OK'} | Drone: ${droneId || 'Assigned'}`,
      });
      setSource(null);
      setDestination(null);
      setWeight(1.0);
    } catch (error) {
      setFeedback({
        type: 'error',
        msg: `❌ Dispatch Failed: ${error.response?.data?.message || error.message}`,
      });
    } finally {
      setIsDeploying(false);
    }
  };

  const canDeploy = source && destination && !isDeploying;

  return (
    <div className="flex-1 flex flex-col h-full bg-white border-l border-navy-900/5 overflow-y-auto custom-scrollbar">

      {/* Header */}
      <div className="p-8 pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-sora font-black text-navy-900 tracking-tighter uppercase">
            Mission Logistics Planner
          </h2>
          <p className="text-navy-600 text-[10px] font-black uppercase tracking-widest mt-1">
            IITK Drone Airspace — Real OSMnx Road Network
          </p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-navy-50/50 border border-navy-900/5">
            <label className="text-[10px] font-black uppercase tracking-widest text-navy-600">Snap to Hub</label>
            <button
              onClick={() => setSnapToHub(!snapToHub)}
              className={`w-10 h-5 rounded-full transition-all relative ${snapToHub ? 'bg-navy-900' : 'bg-gray-300'}`}
            >
              <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${snapToHub ? 'left-6' : 'left-1'}`} />
            </button>
          </div>
          <button
            onClick={() => { setSource(null); setDestination(null); setFeedback(null); }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white-soft hover:bg-navy-900 hover:text-white text-navy-900 font-black uppercase text-[10px] tracking-widest transition-all border border-navy-900/10 shadow-sm"
          >
            <Trash2 size={16} /> Clear
          </button>
          <button
            disabled={!canDeploy}
            onClick={handleDeploy}
            className={`flex items-center gap-2 px-8 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl ${
              !canDeploy
                ? 'bg-white-muted text-navy-600 cursor-not-allowed opacity-50'
                : 'bg-navy-900 text-white hover:scale-105 active:scale-95'
            }`}
          >
            <Send size={16} />
            {isDeploying ? 'Deploying...' : 'Deploy Autonomous Vector'}
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div className={`mx-8 mb-2 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 ${
          feedback.type === 'success'
            ? 'bg-green-50 border border-green-300 text-green-800'
            : 'bg-red-50 border border-red-300 text-red-800'
        }`}>
          {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {feedback.msg}
        </div>
      )}

      {/* Controls Row */}
      <div className="px-8 pb-4 flex flex-wrap gap-4 items-end">
        {/* Source */}
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-black text-navy-600 uppercase tracking-widest">
            <MapPin size={10} className="inline mr-1" /> Departure Hub
          </label>
          <select
            value={source?.name || ""}
            onChange={e => { 
                const name = e.target.value;
                if (!name) setSource(null);
                else setSource({ name, ...CAMPUS_NODES[name] });
                setDestination(null); 
            }}
            className="px-4 py-2 rounded-xl border border-navy-900/10 bg-white text-navy-900 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-navy-900"
          >
            <option value="">Select Source...</option>
            {CAMPUS_NAMES.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        {/* Destination */}
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-black text-navy-600 uppercase tracking-widest">
            <MapPin size={10} className="inline mr-1" /> Arrival Target
          </label>
          <select
            value={destination?.name || ""}
            onChange={e => {
                const name = e.target.value;
                if (!name) setDestination(null);
                else setDestination({ name, ...CAMPUS_NODES[name] });
            }}
            disabled={!source}
            className="px-4 py-2 rounded-xl border border-navy-900/10 bg-white text-navy-900 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-navy-900 disabled:opacity-50"
          >
            <option value="">Select Destination...</option>
            {CAMPUS_NAMES.filter(n => n !== source?.name).map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        {/* Weight */}
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-black text-navy-600 uppercase tracking-widest">
            Payload (kg)
          </label>
          <input
            type="number" min="0.1" max="5" step="0.1"
            value={weight}
            onChange={e => setWeight(e.target.value)}
            className="px-4 py-2 rounded-xl border border-navy-900/10 bg-white text-navy-900 font-bold text-sm w-24 focus:outline-none focus:ring-2 focus:ring-navy-900"
          />
        </div>

        {/* NFZ Legend */}
        <div className="flex items-center gap-2 ml-auto px-3 py-2 rounded-xl border border-red-200 bg-red-50">
          <ShieldAlert size={14} className="text-red-500" />
          <span className="text-[9px] font-black text-red-600 uppercase tracking-widest">
            Red = No-Fly Zone
          </span>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 mx-8 mb-8 rounded-3xl overflow-hidden glass-card relative border border-navy-900/10 shadow-2xl">
        <MapContainer center={MAP_CENTER} zoom={MAP_ZOOM} className="h-full w-full z-0">
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />

          {/* ── Map Click Interaction ───────────────────────────── */}
          <MapClickHandler />

          {/* ── Congestion Heatmap ──────────────────────────────── */}
          <CongestionOverlay />

          {/* ── OSMnx Road Network Edges (real from notebook) ───── */}
          {CAMPUS_EDGES.map((edge, i) => (
            <Polyline
              key={`edge-${i}`}
              positions={edge}
              pathOptions={{ color: '#334155', weight: 1.5, opacity: 0.4, dashArray: '4,3' }}
            />
          ))}

          {/* ── No-Fly Zones (zone1 & zone2 from notebook) ────── */}
          {NO_FLY_ZONES.map((zone, i) => (
            <Polygon
              key={`nfz-${i}`}
              positions={zone.positions}
              pathOptions={{
                color: '#ef4444',
                fillColor: '#ef4444',
                fillOpacity: 0.25,
                weight: 2,
                dashArray: '6,3',
              }}
            >
              <Tooltip sticky>
                <div className="text-xs font-bold text-red-700 flex items-center gap-1">
                  <ShieldAlert size={12} /> {zone.name} — No Drone Entry
                </div>
              </Tooltip>
            </Polygon>
          ))}

          {/* ── Custom Markers ────────────────────────────── */}
          {source && (
              <Marker
                position={[source.lat, source.lng]}
                icon={new L.Icon({
                  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-black.png',
                  iconSize: [25, 41], iconAnchor: [12, 41],
                })}
              >
                <Tooltip permanent direction="top" offset={[0, -40]}>
                  <span className="text-[10px] font-black uppercase text-navy-900">{source.name}</span>
                </Tooltip>
              </Marker>
          )}
          {destination && (
              <Marker
                position={[destination.lat, destination.lng]}
                icon={new L.Icon({
                  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                  iconSize: [25, 41], iconAnchor: [12, 41],
                })}
              >
                <Tooltip permanent direction="top" offset={[0, -40]}>
                  <span className="text-[10px] font-black uppercase text-blue-900">{destination.name}</span>
                </Tooltip>
              </Marker>
          )}

          {/* ── Flight Path Preview ───────────────────────────── */}
          {source && destination && (
            <Polyline
              positions={[
                [source.lat, source.lng],
                [destination.lat,   destination.lng],
              ]}
              pathOptions={{ color: '#0d1b2a', weight: 3, dashArray: '8,8', opacity: 0.8 }}
            />
          )}
        </MapContainer>

        {/* Coordinate readout */}
        <div className="absolute bottom-4 left-4 z-10 space-y-2">
          {[{ label: 'Departure', item: source },
            { label: 'Arrival',   item: destination }].map(({ label, item }) => (
            <div key={label} className="glass-card px-4 py-2 flex items-center gap-3 bg-white border border-navy-900/20 shadow-xl">
              <div className={`w-2.5 h-2.5 rounded-full ${item ? 'bg-navy-900' : 'bg-gray-300'}`} />
              <div>
                <p className="text-[8px] font-black text-navy-600 uppercase tracking-widest">{label}</p>
                <p className="text-[10px] font-black text-navy-900">
                  {item?.name || 'Not selected'}
                  {item ? ` (${item.lat.toFixed(4)}, ${item.lng.toFixed(4)})` : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MissionPlanner;
