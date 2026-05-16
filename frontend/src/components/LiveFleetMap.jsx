import React from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, Polygon, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation } from 'lucide-react';
import CongestionOverlay from './CongestionOverlay';
import Drone3DLayer from './Drone3DLayer';
import AltitudeLegend from './AltitudeLegend';
import {
  MAP_CENTER, MAP_ZOOM,
  CAMPUS_NODES,
  FLY_ZONE_COLORS,
} from '../config/mapConfig';

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
  return ring?.map(([lng, lat]) => [lat, lng]);
}

/**
 * LiveFleetMap — campus map with real-time drone positions + dynamic airspace zones
 */
const LiveFleetMap = ({ drones = {}, gridData = [], warningDrones = new Set(), zones = [] }) => {
  const dronesList = Object.values(drones);

  // Key nodes to label
  const KEY_NODES = Object.entries(CAMPUS_NODES).filter(([name]) =>
    name.startsWith('Hub') ||
    ['OAT', 'Main Gate', 'Library', 'Medical Center', 'Shopping Complex', 'Power Station', 'Student Gymkhana'].includes(name)
  );

  return (
    <div className="glass-card h-[500px] w-full rounded-3xl overflow-hidden border border-navy-900/10 shadow-2xl relative group">

      {/* Map Header */}
      <div className="absolute top-4 left-4 z-[1000] flex items-center gap-2.5">
        <div className="p-2 bg-navy-900 rounded-xl shadow-lg border border-white/10">
          <Navigation className="text-white" size={16} />
        </div>
        <div>
          <h3 className="text-navy-900 font-sora font-black text-xs tracking-tight uppercase">
            SkyTrace — Mission Control
          </h3>
          <p className="text-navy-600 text-[8px] font-black uppercase tracking-widest mt-0.5">
            {dronesList.length} Active Units
          </p>
        </div>
      </div>

      <MapContainer
        center={MAP_CENTER}
        zoom={MAP_ZOOM}
        className="h-full w-full z-0"
        scrollWheelZoom={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution="&copy; CARTO"
        />

        <CongestionOverlay gridData={gridData} />

        {/* Dynamic airspace zones from DB */}
        {zones?.map((zone) => {
          if (!zone.visible || !zone.geometry) return null;
          const c = ZONE_COLORS[zone.type] || ZONE_COLORS.NO_FLY;
          const pos = zoneGeomToPositions(zone.geometry);
          if (!pos) return null;
          const pathOpts = {
            color: c.stroke, fillColor: c.fill, fillOpacity: 0.18,
            weight: 2,
            dashArray: zone.type === 'NO_FLY' ? '6 4' : zone.type === 'RESTRICTED' ? '4 4' : null,
          };
          if (zone.geometry.type === 'Circle') {
            return (
              <Circle key={zone.id} center={pos.center} radius={pos.radius} pathOptions={pathOpts}>
                <Tooltip sticky>
                  <span style={{ fontSize: 10, fontWeight: 900, color: c.stroke }}>
                    {zone.type === 'NO_FLY' ? '🚫' : zone.type === 'RESTRICTED' ? '⚠️' : '✅'} {zone.name}
                  </span>
                </Tooltip>
              </Circle>
            );
          }
          return (
            <Polygon key={zone.id} positions={pos} pathOptions={pathOpts}>
              <Tooltip sticky>
                <span style={{ fontSize: 10, fontWeight: 900, color: c.stroke }}>
                  {zone.type === 'NO_FLY' ? '🚫' : zone.type === 'RESTRICTED' ? '⚠️' : '✅'} {zone.name}
                </span>
              </Tooltip>
            </Polygon>
          );
        })}

        {/* ── LAYER 4: Landmarks ── */}
        {KEY_NODES?.map(([name, coords]) => {
          const isHub = name.startsWith('Hub');
          const isPS = name === 'Power Station';
          
          return (
            <Marker
              key={`node-${name}`}
              position={[coords.lat, coords.lng]}
              icon={L.divIcon({
                className: '',
                html: `<div style="font-size:8px;font-weight:800;color:${isHub ? '#ea580c' : isPS ? '#ca8a04' : '#334155'};background:rgba(255,255,255,0.88);padding:1px 6px;border-radius:4px;white-space:nowrap;border:1px solid ${isHub ? '#fed7aa' : isPS ? '#fef08a' : '#e2e8f0'};box-shadow:0 1px 3px rgba(0,0,0,0.1)">${isHub ? '⚡ ' : isPS ? '🔋 ' : ''}${name}</div>`,
                iconAnchor: [0, 0],
              })}
            />
          );
        })}

        {/* ── LAYER 5: Drones ── */}
        <Drone3DLayer externalDrones={drones} warningDrones={warningDrones} />

      </MapContainer>

      {/* Altitude Legend (bottom-right) */}
      <div className="absolute bottom-4 right-4 z-[1000]">
        <AltitudeLegend drones={drones} compactMode={true} />
      </div>

      {/* Final Legend (matching screenshot style) */}
      <div className="absolute bottom-4 left-4 z-[1000]" style={{
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(10px)',
        border: '1px solid #cbd5e1',
        borderRadius: 8,
        padding: '10px 12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
        minWidth: 160
      }}>
        <div style={{ fontSize: 9, fontWeight: 900, color: '#1e293b', textTransform: 'uppercase', marginBottom: 8, borderBottom: '1px solid #e2e8f0', paddingBottom: 4 }}>
          Mission Legend
        </div>
        {[
          { color: '#2563eb', label: 'OSM Road Path', sub: 'Primary' },
          { color: '#7c3aed', label: 'Grid Fallback', sub: 'Detour' },
          { color: '#ef4444', label: 'Restricted Zone', sub: 'NFZ' },
          { color: '#16a34a', label: 'Open Space', sub: 'Safe' },
          { color: '#eab308', label: 'Power Station', sub: 'Hub' },
        ]?.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: item.color, flexShrink: 0, border: '1px solid rgba(0,0,0,0.1)' }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: '#334155' }}>{item.label}</span>
            <span style={{ fontSize: 7, color: '#94a3b8', marginLeft: 'auto', fontWeight: 600 }}>{item.sub}</span>
          </div>
        ))}
      </div>

    </div>
  );
};

export default LiveFleetMap;
