/**
 * Drone3DLayer.jsx
 * Leaflet layer that renders all active drones with 3D-aware visuals.
 *
 * Features:
 *  - Altitude-coded marker color (40m=blue, 50m=green, 60m=orange, 70m+=red)
 *  - Animated pulse ring for active drones
 *  - Path trail (last 50 positions)
 *  - Tooltip with "D1 (50m)" label
 *  - Listens to "drone_position_3d" socket event
 *  - Highlights drones in collision warning state
 */

import React, { useEffect, useState, useRef, useCallback } from "react";
import { Marker, Polyline, CircleMarker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import { io } from "socket.io-client";
import { SOCKET_URL } from "../config/mapConfig";

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const ALT_COLORS = {
  blue:   "#3b82f6",   // 80m layer
  green:  "#22c55e",   // 130m layer
  orange: "#f97316",   // 180m layer
  red:    "#ef4444",   // 230m layer
  purple: "#a855f7",   // 280m layer
  gray:   "#94a3b8",   // 0m (idle)
};

// Trail colours by mission phase
const TRAIL_PICKUP   = "#f97316"; // 🟠 orange  — flying to pickup
const TRAIL_DELIVERY = "#22c55e"; // 🟢 green   — carrying cargo
const TRAIL_RETURN   = "#0d9488"; // 🔵 teal    — returning to hub

function getAltColor(alt) {
  if (alt <= 0)   return ALT_COLORS.gray;
  if (alt <= 80)  return ALT_COLORS.blue;
  if (alt <= 130) return ALT_COLORS.green;
  if (alt <= 180) return ALT_COLORS.orange;
  if (alt <= 230) return ALT_COLORS.red;
  return          ALT_COLORS.purple;
}

function getTrailColor(phase, status) {
  const p = (phase || "").toLowerCase();
  if (status === "charging") return "#eab308";
  if (p.includes("pickup"))  return TRAIL_PICKUP;
  if (p.includes("hub") || p.includes("rth") || p.includes("landed")) return TRAIL_RETURN;
  return TRAIL_DELIVERY;
}


function getStatusColor(status, alt) {
  if (status === "charging")  return "#eab308"; // yellow
  if (status === "rerouting") return "#8b5cf6"; // purple
  if (status === "delivered") return "#94a3b8"; // gray
  if (status === "returning") return "#0d9488"; // teal — going home
  return getAltColor(alt);
}

const MAX_TRAIL = 50; // keep last N positions on trail

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────

const Drone3DLayer = ({ externalDrones = {}, warningDrones = new Set() }) => {
  const [drones3D, setDrones3D] = useState({}); // droneId → latest 3D state
  const [trails,   setTrails]   = useState({}); // droneId → { points:[[lat,lng]], phase, status }
  const [predictions, setPredictions] = useState([]); // Array of predictive warnings
  const socketRef = useRef(null);
  const map = useMap();

  // Merge externalDrones on mount / prop change
  useEffect(() => {
    if (Object.keys(externalDrones).length > 0) {
      setDrones3D(prev => ({ ...prev, ...externalDrones }));
    }
  }, [externalDrones]);

  // Socket listener for real-time 3D positions
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ["polling", "websocket"],
      reconnection: true,
    });
    socketRef.current = socket;

    socket.on("drone_position_3d", (data) => {
      const { droneId, lat, lng, alt, phase, status } = data;
      if (!droneId || lat == null || lng == null) return;

      setDrones3D(prev => ({ ...prev, [droneId]: data }));

      // Append to trail — store phase with each segment so we can
      // split the polyline into orange (pickup) and green (delivery) sections
      setTrails(prev => {
        const existing = prev[droneId] ?? { points: [], phase: phase ?? "delivery", status, heading: data.heading };
        const newPoints = [...existing.points, [lat, lng]].slice(-MAX_TRAIL);
        return { ...prev, [droneId]: { points: newPoints, phase: phase ?? existing.phase, status, heading: data.heading } };
      });
    });

    socket.on("drone_low_battery", (data) => {
      setDrones3D(prev => ({
        ...prev,
        [data.droneId]: { ...(prev[data.droneId] ?? {}), ...data, status: "rerouting" },
      }));
    });

    socket.on("drone_charging", (data) => {
      setDrones3D(prev => ({
        ...prev,
        [data.droneId]: { ...(prev[data.droneId] ?? {}), ...data, status: "charging" },
      }));
    });

    socket.on("drone_charging_done", (data) => {
      setDrones3D(prev => ({
        ...prev,
        [data.droneId]: { ...(prev[data.droneId] ?? {}), batteryLevel: 100, status: "delivering" },
      }));
    });

    socket.on("predictive_warning", (warning) => {
      setPredictions((prev) => {
        const pairKey = [warning.drone1, warning.drone2].sort().join('-');
        const existing = prev.find(w => [w.drone1, w.drone2].sort().join('-') === pairKey);
        if (existing) {
          return prev.map(w => w === existing ? warning : w);
        }
        return [...prev, warning];
      });
    });

    // Clean up expired predictions (older than 15s)
    const cleanupInterval = setInterval(() => {
      setPredictions(prev => prev.filter(w => Date.now() - w.timestamp < 15000));
    }, 2000);

    return () => {
      socket.off("drone_position_3d");
      socket.off("drone_low_battery");
      socket.off("drone_charging");
      socket.off("drone_charging_done");
      socket.off("predictive_warning");
      socket.disconnect();
      clearInterval(cleanupInterval);
    };
  }, []);

  const droneList = Object.values(drones3D);

  return (
    <>
      {/* 1. Render Conflict Zone Markers */}
      {predictions.map((warning, idx) => {
        let color = '#eab308';
        if (warning.type === 'MODERATE') color = '#f97316';
        if (warning.type === 'CRITICAL') color = '#ef4444';
        
        return (
          <React.Fragment key={`pred_${idx}`}>
            <CircleMarker
              center={[warning.conflictPoint.lat, warning.conflictPoint.lng]}
              radius={15}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.2, weight: 2 }}
            >
              <Tooltip direction="top" offset={[0, -10]} permanent>
                <div style={{ fontSize: '10px', fontWeight: 'bold' }}>T - {warning.timeToConflict}s</div>
              </Tooltip>
            </CircleMarker>
            
            {/* Draw predicted trajectory lines for the involved drones */}
            {drones3D[warning.drone1] && (
              <Polyline
                positions={[
                  [drones3D[warning.drone1].lat, drones3D[warning.drone1].lng],
                  [warning.conflictPoint.lat, warning.conflictPoint.lng]
                ]}
                pathOptions={{ color, weight: 2, dashArray: "4 6", opacity: 0.8 }}
              />
            )}
            {drones3D[warning.drone2] && (
              <Polyline
                positions={[
                  [drones3D[warning.drone2].lat, drones3D[warning.drone2].lng],
                  [warning.conflictPoint.lat, warning.conflictPoint.lng]
                ]}
                pathOptions={{ color, weight: 2, dashArray: "4 6", opacity: 0.8 }}
              />
            )}
          </React.Fragment>
        );
      })}

      {(droneList || [])?.map((drone) => {
        const { droneId, lat, lng, alt = 50, speed = 0, status, phase, etaLabel } = drone;
        if (!lat || !lng) return null;

        const isWarning  = warningDrones.has(droneId);
        const altColor   = getAltColor(alt);
        const trailInfo  = trails[droneId];
        const trailColor = getTrailColor(trailInfo?.phase ?? phase, status);
        const trail      = trailInfo?.points ?? [];

        return (
          <React.Fragment key={droneId}>
            {/* Trail polyline — colour shows mission phase */}
            {trail.length > 1 && (
              <Polyline
                positions={trail}
                pathOptions={{
                  color:     trailColor,
                  weight:    3,
                  opacity:   0.75,
                  dashArray: status === "returning" ? "6 4" : undefined,
                }}
              />
            )}

            {/* Drone marker — coloured by permissible altitude layer */}
            <Marker
              position={[lat, lng]}
              icon={createDroneIcon3D(droneId, alt, status, isWarning)}
              zIndexOffset={isWarning ? 1000 : 0}
            >
              <Tooltip direction="top" offset={[0, -18]} permanent={false} sticky>
                <div style={{ padding: "6px 10px", minWidth: 150, fontFamily: "system-ui, sans-serif" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontWeight: 800, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                      {droneId}
                    </span>
                    <span style={{
                      fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                      padding: "1px 6px", borderRadius: 4,
                      background: isWarning ? "#fef2f2" : "#f0fdf4",
                      color:      isWarning ? "#ef4444" : "#16a34a",
                    }}>
                      {isWarning ? "⚠ CONFLICT" : (status || "Active").toUpperCase()}
                    </span>
                  </div>
                  <table style={{ fontSize: 10, width: "100%", borderCollapse: "collapse" }}>
                    <tbody>
                      <tr>
                        <td style={{ color: "#64748b", paddingRight: 8 }}>Altitude</td>
                        <td style={{ fontWeight: 700, color: altColor, textAlign: "right" }}>{Math.round(alt)}m</td>
                      </tr>
                      <tr>
                        <td style={{ color: "#64748b" }}>Speed</td>
                        <td style={{ fontWeight: 700, textAlign: "right" }}>{speed} m/s</td>
                      </tr>
                      <tr>
                        <td style={{ color: "#64748b" }}>Phase</td>
                        <td style={{ fontWeight: 700, textAlign: "right", color: trailColor }}>
                          {phase || status || "Mission"}
                        </td>
                      </tr>

                      {etaLabel && (
                        <tr>
                          <td style={{ color: "#64748b" }}>ETA</td>
                          <td style={{ fontWeight: 700, textAlign: "right" }}>{etaLabel}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Tooltip>
            </Marker>
          </React.Fragment>
        );
      })}
    </>
  );
};

export default Drone3DLayer;

// ─────────────────────────────────────────────────────────────
// ICON FACTORY
// ─────────────────────────────────────────────────────────────
function createDroneIcon3D(droneId, alt, status, isWarning) {
  const color   = isWarning ? "#ef4444" : getStatusColor(status, alt);
  const isIdle       = status === "idle" || status === "delivered";
  const isCharging   = status === "charging";
  const isRerouting  = status === "rerouting";
  const isReturning  = status === "returning";

  const ring = isWarning
    ? `<div style="position:absolute;inset:-6px;border-radius:50%;background:${color};opacity:0.35;animation:ping3d 0.8s ease-out infinite;"></div>`
    : !isIdle
    ? `<div style="position:absolute;inset:-4px;border-radius:50%;background:${color};opacity:0.2;animation:ping3d 1.4s ease-out infinite;"></div>`
    : "";

  // Choose icon glyph
  const iconSvg = isCharging
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="white" stroke="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`
    : isRerouting
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><path d="M3 12h18M3 12l4-4M3 12l4 4M21 6l-4-4M21 6l-4 4"/></svg>`
    : isReturning
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="white" stroke="none"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19"/></svg>`;

  const labelText = isCharging
    ? `⚡ ${droneId}`
    : isRerouting
    ? `↗ ${droneId}`
    : isReturning
    ? `🏠 ${droneId}`
    : `${droneId} (${Math.round(alt)}m)`;

  const html = `
    <style>
      @keyframes ping3d {
        0%   { transform: scale(1);   opacity: 0.4; }
        100% { transform: scale(2.2); opacity: 0;   }
      }
    </style>
    <div style="position:relative;width:32px;height:32px;cursor:pointer;">
      ${ring}
      <div style="
        position:absolute;inset:0;border-radius:50%;
        background:${color};border:2px solid white;
        box-shadow:0 2px 8px rgba(0,0,0,0.35);
        display:flex;align-items:center;justify-content:center;
        transition:background 0.4s;
      ">
        ${iconSvg}
      </div>
      <div style="
        position:absolute;top:-20px;left:50%;transform:translateX(-50%);
        background:rgba(15,23,42,0.85);color:white;
        font-size:9px;font-weight:800;letter-spacing:0.05em;
        padding:1px 5px;border-radius:4px;white-space:nowrap;
        border:1px solid rgba(255,255,255,0.15);
      ">${labelText}</div>
    </div>
  `;

  return L.divIcon({ className: "", html, iconSize: [32, 32], iconAnchor: [16, 16] });
}


