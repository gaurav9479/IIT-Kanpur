/**
 * SharedAirspaceMap.jsx
 * A unified Leaflet map component used by both MissionPlanner and AirspaceControlPage.
 *
 * Renders:
 *  - OSM tile layer (consistent style across all pages)
 *  - Campus road edges (grey background network)
 *  - Hardcoded NFZ fallback zones (light outline, from safety.config)
 *  - Dynamic DB zones (from useZones) — full opacity, with tooltips
 *  - Live drones via Drone3DLayer (optional, off by default)
 *  - CongestionOverlay (optional)
 *  - Optional DrawControl (for Airspace Control page only)
 *  - Children passed as props (markers, polylines, etc.)
 */

import React from 'react';
import { MapContainer, TileLayer, Polygon, Circle, Tooltip, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MAP_CENTER,
  MAP_ZOOM,
  NO_FLY_ZONES,
  CAMPUS_EDGES,
  DRONE_HUBS,
  CAMPUS_NODES
} from '../config/mapConfig';
import { useZones } from '../hooks/useZones';
import { useSocket } from '../hooks/useSocket';
import Drone3DLayer from './Drone3DLayer';
import CongestionOverlay from './CongestionOverlay';
import AltitudeLegend from './AltitudeLegend';
import L from 'leaflet';
import { Marker } from 'react-leaflet';

const ZONE_COLORS = {
  NO_FLY:     { stroke: '#ef4444', fill: '#ef4444' },
  RESTRICTED: { stroke: '#eab308', fill: '#eab308' },
};

// ── CUSTOM ICONS ─────────────────────────────────────────────
const hubIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/3063/3063822.png', // Warehouse/Hub
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

const batteryIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/3103/3103446.png', // Battery/Bolt
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});


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
 * Props:
 *   className        {string}  — Tailwind / CSS class applied to MapContainer
 *   showDrones       {boolean} — Whether to render live drone layer (default false)
 *   showCongestion   {boolean} — Whether to show congestion overlay (default false)
 *   drawControl      {node}    — Optional <DrawControl> element injected by parent
 *   popupRenderer    {fn}      — Optional (zone) => <Popup> node for each dynamic zone
 *   children         {node}    — Extra map layers (markers, routes, etc.)
 */
export default function SharedAirspaceMap({
  className = 'h-full w-full',
  showDrones = false,
  showCongestion = false,
  drawControl = null,
  popupRenderer = null,
  children,
}) {
  const { zones } = useZones();
  const { drones } = useSocket();

  return (
    <div className={`relative ${className}`}>
      <MapContainer center={MAP_CENTER} zoom={MAP_ZOOM} className="h-full w-full" style={{ zIndex: 0 }}>
      {/* ── Base tile — OpenStreetMap (same on every page) ────── */}
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />

      {/* ── Optional draw control (Airspace Control only) ──────── */}
      {drawControl}

      {/* ── Optional congestion heatmap ───────────────────────── */}
      {showCongestion && <CongestionOverlay />}

      {/* ── Optional live drone layer ──────────────────────────── */}
      {showDrones && <Drone3DLayer />}

      {/* ── Campus road network (light grey) ──────────────────── */}
      {CAMPUS_EDGES?.map((edge, i) => (
        <Polyline
          key={`edge-${i}`}
          positions={edge}
          pathOptions={{ color: '#94a3b8', weight: 1.5, opacity: 0.3 }}
        />
      ))}

      {/* ── Hardcoded NFZ fallback (faint outline only) ────────── */}
      {NO_FLY_ZONES?.map((zone, i) => (
        <Polygon
          key={`nfz-static-${i}`}
          positions={zone.positions}
          pathOptions={{
            color: '#ef4444', fillColor: '#ef4444',
            fillOpacity: 0.07, weight: 1,
            dashArray: '6 4',
          }}
        >
          <Tooltip sticky>
            <span style={{ fontSize: 10, fontWeight: 900, color: '#ef4444' }}>
              🚫 {zone.name}
            </span>
          </Tooltip>
        </Polygon>
      ))}

      {/* ── Dynamic DB zones (full visibility) ────────────────── */}
      {zones?.map((zone) => {
        if (!zone.visible || !zone.geometry) return null;
        const c   = ZONE_COLORS[zone.type] || ZONE_COLORS.NO_FLY;
        const pos = zoneGeomToPositions(zone.geometry);
        if (!pos) return null;

        const pathOpts = {
          color:       c.stroke,
          fillColor:   c.fill,
          fillOpacity: 0.2,
          weight:      2,
          dashArray:
            zone.type === 'NO_FLY'     ? '6 4' :
            zone.type === 'RESTRICTED' ? '4 4' : null,
        };

        const label = (
          <Tooltip sticky>
            <span style={{ fontSize: 10, fontWeight: 900, color: c.stroke }}>
            {zone.type === 'NO_FLY' ? '🚫' : '⚠️'} {zone.name}
              <br />
              <span style={{ fontWeight: 600, color: '#64748b' }}>
                {zone.altitude_min}m – {zone.altitude_max}m AGL
              </span>
            </span>
          </Tooltip>
        );

        const popup = popupRenderer ? popupRenderer(zone) : null;

        if (zone.geometry.type === 'Circle') {
          return (
            <Circle key={zone.id} center={pos.center} radius={pos.radius} pathOptions={pathOpts}>
              {label}
              {popup}
            </Circle>
          );
        }

        return (
          <Polygon key={zone.id} positions={pos} pathOptions={pathOpts}>
            {label}
            {popup}
          </Polygon>
        );
      })}

      {/* ── DRONE HUBS (Always Visible) ────────────────────────── */}
      {Object.entries(DRONE_HUBS).map(([name, data]) => (
        <Marker key={name} position={[data.lat, data.lng]} icon={hubIcon}>
          <Tooltip direction="top" offset={[0, -10]}>
            <span className="text-[10px] font-black uppercase text-navy-900 tracking-wider">
              🏢 {name}
            </span>
          </Tooltip>
        </Marker>
      ))}

      {/* ── BATTERY STATION (Always Visible) ───────────────────── */}
      {CAMPUS_NODES["Power Station"] && (
        <Marker 
          position={[CAMPUS_NODES["Power Station"].lat, CAMPUS_NODES["Power Station"].lng]} 
          icon={batteryIcon}
        >
          <Tooltip direction="top" offset={[0, -10]}>
            <span className="text-[10px] font-black uppercase text-amber-600 tracking-wider">
              ⚡ BATTERY STATION
            </span>
          </Tooltip>
        </Marker>
      )}

      {/* ── Caller-supplied layers (markers, route polylines…) ── */}
      {children}
      </MapContainer>

      {/* Globally applied Altitude Legend */}
      <div className="absolute bottom-4 right-4 z-[1000] pointer-events-auto">
        <AltitudeLegend drones={drones} compactMode={true} />
      </div>
    </div>
  );
}
