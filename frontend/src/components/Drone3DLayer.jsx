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
import { Marker, Polyline, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import { io } from "socket.io-client";

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5001";

const ALT_COLORS = {
  blue:   "#3b82f6",   // 40m layer
  green:  "#22c55e",   // 50m layer
  orange: "#f97316",   // 60m layer
  red:    "#ef4444",   // 70m+ emergency layer
  gray:   "#94a3b8",   // unknown
};

function getAltColor(alt) {
  if (alt <= 45)  return ALT_COLORS.blue;
  if (alt <= 55)  return ALT_COLORS.green;
  if (alt <= 65)  return ALT_COLORS.orange;
  return              ALT_COLORS.red;
}

function getStatusColor(status, alt) {
  if (status === "charging")  return "#eab308"; // yellow
  if (status === "rerouting") return "#8b5cf6"; // purple
  if (status === "delivered") return "#94a3b8"; // gray
  return getAltColor(alt);
}

const MAX_TRAIL = 50; // keep last N positions on trail

// ─────────────────────────────────────────────────────────────
// ICON FACTORY
// ─────────────────────────────────────────────────────────────
function createDroneIcon3D(droneId, alt, status, isWarning) {
  const color   = isWarning ? "#ef4444" : getStatusColor(status, alt);
  const isIdle  = status === "idle" || status === "delivered";
  const isCharging   = status === "charging";
  const isRerouting  = status === "rerouting";

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
    : `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19"/></svg>`;

  const labelText = isCharging
    ? `⚡ ${droneId}`
    : isRerouting
    ? `↗ ${droneId}`
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

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────

/**
 * Drone3DLayer — drop-in inside <MapContainer>
 *
 * Props:
 *   externalDrones {Object}   — optional initial drone map from parent (droneId → data)
 *   warningDrones  {Set}      — optional set of droneIds currently in collision warning
 */
const Drone3DLayer = ({ externalDrones = {}, warningDrones = new Set() }) => {
  const [drones3D, setDrones3D] = useState({}); // droneId → latest 3D state
  const [trails,   setTrails]   = useState({}); // droneId → [[lat,lng], ...]
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
      const { droneId, lat, lng, alt } = data;
      if (!droneId || lat == null || lng == null) return;

      setDrones3D(prev => ({ ...prev, [droneId]: data }));

      // Append to trail
      setTrails(prev => {
        const existing = prev[droneId] ?? [];
        const newTrail = [...existing, [lat, lng]].slice(-MAX_TRAIL);
        return { ...prev, [droneId]: newTrail };
      });
    });

    // ── Battery socket events ───────────────────────────────
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

    return () => {
      socket.off("drone_position_3d");
      socket.off("drone_low_battery");
      socket.off("drone_charging");
      socket.off("drone_charging_done");
      socket.disconnect();
    };
  }, []);

  const droneList = Object.values(drones3D);

  return (
    <>
      {droneList.map((drone) => {
        const { droneId, lat, lng, alt = 50, speed = 0, status, etaLabel } = drone;
        if (!lat || !lng) return null;

        const isWarning = warningDrones.has(droneId);
        const color     = isWarning ? "#ef4444" : getAltColor(alt);
        const trail     = trails[droneId] ?? [];

        return (
          <React.Fragment key={droneId}>
            {/* Trail polyline */}
            {trail.length > 1 && (
              <Polyline
                positions={trail}
                pathOptions={{
                  color,
                  weight:    3,
                  opacity:   0.7,
                  dashArray: "6 4",
                }}
              />
            )}

            {/* Drone marker */}
            <Marker
              position={[lat, lng]}
              icon={createDroneIcon3D(droneId, alt, status, isWarning)}
              zIndexOffset={isWarning ? 1000 : 0}
            >
              <Tooltip
                direction="top"
                offset={[0, -18]}
                permanent={false}
                sticky
              >
                <div style={{
                  padding: "6px 10px",
                  minWidth: 140,
                  fontFamily: "system-ui, sans-serif",
                }}>
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    alignItems: "center", marginBottom: 6,
                  }}>
                    <span style={{ fontWeight: 800, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                      {droneId}
                    </span>
                    <span style={{
                      fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                      padding: "1px 6px", borderRadius: 4,
                      background: isWarning ? "#fef2f2" : "#f0fdf4",
                      color:      isWarning ? "#ef4444" : "#16a34a",
                    }}>
                      {isWarning ? "⚠ CONFLICT" : (status ?? "active").toUpperCase()}
                    </span>
                  </div>
                  <table style={{ fontSize: 10, width: "100%", borderCollapse: "collapse" }}>
                    <tbody>
                      <tr>
                        <td style={{ color: "#64748b", paddingRight: 8 }}>Altitude</td>
                        <td style={{ fontWeight: 700, color, textAlign: "right" }}>{Math.round(alt)}m</td>
                      </tr>
                      <tr>
                        <td style={{ color: "#64748b" }}>Speed</td>
                        <td style={{ fontWeight: 700, textAlign: "right" }}>{speed} m/s</td>
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
