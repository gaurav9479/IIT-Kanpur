import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, Polygon } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation } from 'lucide-react';
import CongestionOverlay from './CongestionOverlay';
import Drone3DLayer from './Drone3DLayer';
import AltitudeLegend from './AltitudeLegend';
import {
  MAP_CENTER, MAP_ZOOM,
  CAMPUS_EDGES, CAMPUS_NODES,
  NO_FLY_ZONES, OPEN_SPACES,
  FLY_ZONE_COLORS,
} from '../config/mapConfig';

/**
 * LiveFleetMap — 3-zone airspace visualisation
 *
 * 🟦 Blue polylines  → Road Corridors (primary fly zone)
 * 🟩 Green polygons  → Open Spaces   (secondary / grid fallback)
 * 🟥 Red polygons    → NFZ / Restricted (no entry)
 * 🟧 Orange polygons → Exclusion zones
 */
const LiveFleetMap = ({ drones = {}, gridData = [] }) => {
  const dronesList = Object.values(drones);

  // Key nodes to label: 5 hubs + 5 landmarks only
  const KEY_NODES = Object.entries(CAMPUS_NODES).filter(([name]) =>
    name.startsWith('Hub') ||
    ['OAT', 'Main Gate', 'Library', 'Medical Center', 'Shopping Complex'].includes(name)
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
            SkyTrace — Controlled Airspace
          </h3>
          <p className="text-navy-600 text-[8px] font-black uppercase tracking-widest mt-0.5">
            {dronesList.length} unit{dronesList.length !== 1 ? 's' : ''} active
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





        {/* ── 🟥 LAYER 3: No-Fly Zones (red = NFZ circles, orange = exclusion) ── */}
        {NO_FLY_ZONES.map((zone, idx) => {
          const isExclusion = zone.name.startsWith('Exclusion');
          const c = isExclusion ? FLY_ZONE_COLORS.exclusion : FLY_ZONE_COLORS.restricted;
          return (
            <Polygon
              key={`nfz-${idx}`}
              positions={zone.positions}
              pathOptions={{
                color:       c.stroke,
                fillColor:   c.fill,
                fillOpacity: isExclusion ? 0.07 : 0.13,
                weight:      isExclusion ? 1.5 : 2,
                dashArray:   isExclusion ? '3, 8' : '5, 5',
              }}
            >
              <Tooltip sticky>
                <span style={{ fontSize: 9, fontWeight: 800, color: c.stroke }}>
                  {isExclusion ? '🚧' : '🚫'} {zone.name}
                </span>
                {zone.radius_m && (
                  <div style={{ fontSize: 8, color: '#64748b' }}>Radius: {zone.radius_m}m</div>
                )}
              </Tooltip>
            </Polygon>
          );
        })}

        {/* ── LAYER 4: Hub + key landmark labels (10 nodes only) ── */}
        {KEY_NODES.map(([name, coords]) => {
          const isHub = name.startsWith('Hub');
          return (
            <Marker
              key={`node-${name}`}
              position={[coords.lat, coords.lng]}
              icon={L.divIcon({
                className: '',
                html: `<div style="font-size:8px;font-weight:800;color:${isHub ? '#ea580c' : '#334155'};background:rgba(255,255,255,0.88);padding:1px 6px;border-radius:4px;white-space:nowrap;border:1px solid ${isHub ? '#fed7aa' : '#e2e8f0'};box-shadow:0 1px 3px rgba(0,0,0,0.1)">${isHub ? '⚡ ' : ''}${name}</div>`,
                iconAnchor: [0, 0],
              })}
            />
          );
        })}

        {/* ── LAYER 5: Active 3D drone fleet (altitude-coded markers + trails) ── */}
        <Drone3DLayer externalDrones={drones} />

      </MapContainer>

      {/* Compact Altitude Strip (bottom-right) */}
      <div className="absolute bottom-4 right-4 z-[1000]">
        <AltitudeLegend drones={drones} compactMode={true} />
      </div>

      {/* Airspace Zone Legend (bottom-left) */}
      <div className="absolute bottom-4 left-4 z-[1000]" style={{
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(15,23,42,0.07)',
        borderRadius: 10,
        padding: '7px 10px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
      }}>
        <div style={{ fontSize: 7, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
          Airspace Classification
        </div>
        {[
          { color: FLY_ZONE_COLORS.restricted.fill,  label: 'NFZ',            sub: 'Blocked'   },
          { color: FLY_ZONE_COLORS.exclusion.fill,   label: 'Exclusion',      sub: 'Blocked'   },
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: item.color, flexShrink: 0 }} />
            <span style={{ fontSize: 8, fontWeight: 700, color: '#334155' }}>{item.label}</span>
            <span style={{ fontSize: 7, color: '#94a3b8', marginLeft: 'auto' }}>{item.sub}</span>
          </div>
        ))}
      </div>

    </div>
  );
};

export default LiveFleetMap;
