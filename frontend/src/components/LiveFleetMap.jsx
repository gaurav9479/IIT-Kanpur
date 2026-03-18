import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, Polygon } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Battery, Zap, Navigation, MapPin } from 'lucide-react';
import CongestionOverlay from './CongestionOverlay';
import { MAP_CENTER, MAP_ZOOM, CAMPUS_EDGES, CAMPUS_NODES, NO_FLY_ZONES } from '../config/mapConfig';

/**
 * LiveFleetMap Component
 * Visualizes all active drones from the telemetry stream on a single map.
 * Supports path history, unique drone coloring, and smooth updates.
 */
const LiveFleetMap = ({ drones = {}, gridData = [] }) => {
  const [paths, setPaths] = useState({});
  const dronesList = Object.values(drones);
  const center = MAP_CENTER;

  // Drone colors for unique visualization
  const DRONE_COLORS = [
    '#0ea5e9', '#8b5cf6', '#ec4899', '#f97316', '#10b981', '#f59e0b', '#6366f1'
  ];

  // Update paths history when drones move
  useEffect(() => {
    setPaths(prev => {
      const newPaths = { ...prev };
      dronesList.forEach(drone => {
        if (!newPaths[drone.droneId]) {
          newPaths[drone.droneId] = [];
        }
        
        const lastPos = newPaths[drone.droneId][newPaths[drone.droneId].length - 1];
        if (!lastPos || lastPos[0] !== drone.location.lat || lastPos[1] !== drone.location.lng) {
          newPaths[drone.droneId] = [...newPaths[drone.droneId], [drone.location.lat, drone.location.lng]].slice(-50); // Keep last 50 points
        }
      });
      return newPaths;
    });
  }, [drones]);

  const createDroneIcon = (droneId, index, status) => {
    const color = status === 'grounded' ? '#8B0000' : DRONE_COLORS[index % DRONE_COLORS.length];
    const isOffline = status === 'idle' || !status || status === 'grounded';

    return L.divIcon({
      className: 'custom-drone-icon',
      html: `
        <div class="relative group">
          <!-- Pulse Effect -->
          ${!isOffline ? `<div class="absolute -inset-2 bg-[${color}] opacity-20 rounded-full animate-ping"></div>` : ''}
          
          <!-- Outer Ring -->
          <div class="w-8 h-8 rounded-full border-2 border-white shadow-xl flex items-center justify-center transition-all duration-500" 
               style="background-color: ${color}; transform: rotate(${status === 'delivering' ? '45deg' : '0deg'})">
             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 14"/>
             </svg>
          </div>

          <!-- Label -->
          <div class="absolute -top-8 left-1/2 -translate-x-1/2 bg-navy-900 border border-white/20 text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-tighter">
            ${droneId} ${status === 'grounded' ? '(GROUNDED)' : ''}
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
  };

  return (
    <div className="glass-card h-[500px] w-full rounded-3xl overflow-hidden border border-navy-900/10 shadow-2xl relative group">
      {/* Overlay Header */}
      <div className="absolute top-6 left-6 z-[1000] flex items-center gap-3">
        <div className="p-2 bg-navy-900 rounded-xl shadow-lg border border-white/10">
          <Navigation className="text-white" size={18} />
        </div>
        <div>
          <h3 className="text-navy-900 font-sora font-black text-sm tracking-tight uppercase">Fleet Intelligence OS</h3>
          <p className="text-navy-600 text-[9px] font-black uppercase tracking-widest mt-0.5">Multi-Unit Real-time Synchronization</p>
        </div>
      </div>

      <MapContainer
        center={center}
        zoom={MAP_ZOOM}
        className="h-full w-full z-0 font-sora"
        scrollWheelZoom={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; CARTO'
        />
        <CongestionOverlay gridData={gridData} />

        {/* --- IITK Infrastructure Layer --- */}
        
        {/* Road Network (Campus Edges) */}
        {CAMPUS_EDGES.map((edge, idx) => (
          <Polyline 
            key={`edge-${idx}`}
            positions={edge}
            pathOptions={{
              color: '#94a3b8', // subtle slate-400
              weight: 1,
              dashArray: '10, 10',
              opacity: 0.4
            }}
          />
        ))}

        {/* No-Fly Zones */}
        {NO_FLY_ZONES.map((zone, idx) => (
          <Polygon
            key={`nfz-${idx}`}
            positions={zone.positions}
            pathOptions={{
              color: idx === 0 ? '#ef4444' : '#3b82f6', // Red for Academic, Blue for Research
              fillColor: idx === 0 ? '#ef4444' : '#3b82f6',
              fillOpacity: 0.1,
              weight: 2,
              dashArray: '5, 10'
            }}
          >
            <Tooltip sticky>
              <span className="text-[10px] font-black uppercase tracking-widest">{zone.name}</span>
            </Tooltip>
          </Polygon>
        ))}

        {/* Named Landmarks */}
        {Object.entries(CAMPUS_NODES).map(([name, coords]) => (
          <Marker 
            key={`node-${name}`}
            position={[coords.lat, coords.lng]}
            icon={L.divIcon({
              className: 'landmark-label',
              html: `<div class="text-[8px] font-bold text-navy-400 uppercase whitespace-nowrap bg-white/50 px-1 rounded">${name}</div>`,
              iconAnchor: [0, 0]
            })}
          />
        ))}

        {/* --- Active Fleet Layer --- */}
        {dronesList.map((drone, index) => (
          <React.Fragment key={drone.droneId}>
            {/* Trajectory Path */}
            {paths[drone.droneId] && (
              <Polyline
                positions={paths[drone.droneId]}
                pathOptions={{
                  color: DRONE_COLORS[index % DRONE_COLORS.length],
                  weight: 4,
                  opacity: 1,
                }}
              />
            )}

            {/* Drone Marker */}
            <Marker 
              position={[drone.location.lat, drone.location.lng]}
              icon={createDroneIcon(drone.droneId, index, drone.status)}
            >
              <Tooltip sticky>
                <div className="p-2 min-w-[120px] bg-white rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black text-navy-900 uppercase tracking-widest">{drone.droneId}</span>
                    <span className={`text-[9px] font-bold px-1.5 rounded uppercase tracking-tighter ${drone.status==='grounded' ? 'bg-red-900/10 text-red-600' : 'bg-navy-900/5 text-navy-600'}`}>
                       {drone.status === 'delivering' ? 'ONLINE' : drone.status === 'idle' ? 'STANDBY' : drone.status === 'grounded' ? 'GROUNDED' : drone.status || 'Active'}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[9px] font-bold text-navy-600 uppercase">
                        <Battery size={10} className={drone.batteryLevel < 20 ? 'text-red-500' : 'text-green-500'} />
                        Battery
                      </div>
                      <span className="text-[10px] font-black">{drone.batteryLevel}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[9px] font-bold text-navy-600 uppercase">
                        <Zap size={10} className="text-amber-500" />
                        Velocity
                      </div>
                      <span className="text-[10px] font-black">{(drone.speed || 0).toFixed(1)} km/h</span>
                    </div>
                  </div>
                </div>
              </Tooltip>
            </Marker>
          </React.Fragment>
        ))}
      </MapContainer>

      {/* Map Legend */}
      <div className="absolute bottom-6 right-6 z-[1000] glass-card p-4 bg-white/80 backdrop-blur-md border border-navy-900/5 shadow-xl flex flex-col gap-2">
        <div className="flex items-center gap-3">
           <div className="w-2 h-2 rounded-full bg-navy-900 animate-pulse"></div>
           <span className="text-[9px] font-black text-navy-900 uppercase tracking-widest">Active Fleet: {dronesList.length} Units</span>
        </div>
        <div className="flex items-center gap-2 mt-1">
           <div className="h-0.5 w-6 bg-navy-900/20 border-t border-dashed border-navy-900"></div>
           <span className="text-[8px] font-bold text-navy-600 uppercase tracking-tighter">Verified Trajectory</span>
        </div>
      </div>
    </div>
  );
};

export default LiveFleetMap;
