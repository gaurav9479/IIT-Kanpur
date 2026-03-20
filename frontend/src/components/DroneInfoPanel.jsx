/**
 * DroneInfoPanel.jsx
 * Real-time 3D Drone Info Panel with:
 *   A. Per-drone: Altitude, Speed, ETA, Battery
 *   B. Decision Panel: conflict resolution actions
 *   C. Event Log: live real-time updates
 *
 * Listens to socket events:
 *   - "drone_position_3d"
 *   - "collision_warning_3d"
 *   - "altitude_change"
 *   - "nfz_violation"
 *   - "event_log"
 */

import React, { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import {
  Gauge, Zap, Clock, Navigation, AlertTriangle,
  Wind, Activity, Radio, TrendingUp,
} from "lucide-react";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5001";
const MAX_EVENTS = 30;
const MAX_DECISIONS = 15;

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function getAltColor(alt) {
  if (alt <= 45) return { bg: "#eff6ff", text: "#1d4ed8", dot: "#3b82f6" };
  if (alt <= 55) return { bg: "#f0fdf4", text: "#15803d", dot: "#22c55e" };
  if (alt <= 65) return { bg: "#fff7ed", text: "#c2410c", dot: "#f97316" };
  return              { bg: "#fef2f2", text: "#b91c1c", dot: "#ef4444" };
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000)  return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

// ─────────────────────────────────────────────────────────────
// BATTERY BAR
// ─────────────────────────────────────────────────────────────
const BatteryBar = ({ level }) => {
  const color = level > 50 ? "#22c55e" : level > 20 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{
        flex: 1, height: 5, background: "#e2e8f0",
        borderRadius: 10, overflow: "hidden",
      }}>
        <div style={{
          height: "100%", width: `${level}%`,
          background: color, borderRadius: 10,
          transition: "width 0.5s ease",
        }} />
      </div>
      <span style={{ fontSize: 10, fontWeight: 800, color, minWidth: 32, textAlign: "right" }}>
        {Math.round(level)}%
      </span>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// DECISION ITEM
// ─────────────────────────────────────────────────────────────
const DecisionItem = ({ item }) => {
  const typeStyles = {
    altitude_change:     { bg: "#eff6ff", border: "#93c5fd", tag: "#1d4ed8", icon: "🔼", label: "ALTITUDE CHANGE" },
    hover:               { bg: "#fff7ed", border: "#fdba74", tag: "#c2410c", icon: "⏸", label: "HOVER" },
    collision_warning_3d:{ bg: "#fef2f2", border: "#fca5a5", tag: "#b91c1c", icon: "⚠️", label: "CONFLICT" },
    nfz_violation:       { bg: "#fdf4ff", border: "#d8b4fe", tag: "#7c3aed", icon: "🚫", label: "NFZ BLOCK" },
    low_battery:         { bg: "#fefce8", border: "#fde047", tag: "#a16207", icon: "⚡", label: "BATTERY CRITICAL" },
  };
  const s = typeStyles[item.type] ?? { bg: "#f8fafc", border: "#e2e8f0", tag: "#475569", icon: "ℹ️", label: "EVENT" };

  return (
    <div style={{
      background: s.bg, border: `1px solid ${s.border}`,
      borderRadius: 10, padding: "8px 12px", marginBottom: 6,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 8, fontWeight: 800, color: s.tag, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {s.icon} {s.label}
        </span>
        <span style={{ fontSize: 8, color: "#94a3b8" }}>{timeAgo(item.timestamp)}</span>
      </div>
      <p style={{ margin: 0, fontSize: 10, color: "#334155", fontWeight: 600 }}>
        {item.message}
      </p>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// DRONE CARD
// ─────────────────────────────────────────────────────────────
const DroneCard = ({ drone, isSelected, onClick }) => {
  const alt     = drone.alt ?? drone.altitude ?? 50;
  const speed   = drone.speed ?? 0;
  const battery = drone.batteryLevel ?? drone.battery ?? 80;
  const colors  = getAltColor(alt);
  const isActive = !["idle", "charging", "grounded"].includes(drone.status);

  return (
    <div
      onClick={onClick}
      style={{
        padding: "12px 14px",
        borderRadius: 12,
        border: isSelected ? `2px solid ${colors.dot}` : "1px solid #e2e8f0",
        background: isSelected ? colors.bg : "#fff",
        cursor: "pointer",
        transition: "all 0.2s ease",
        marginBottom: 8,
        boxShadow: isSelected ? `0 0 0 3px ${colors.dot}22` : "none",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: isActive ? colors.dot : "#94a3b8",
            boxShadow: isActive ? `0 0 6px ${colors.dot}` : "none",
            flexShrink: 0,
            animation: isActive ? "none" : undefined,
          }} />
          <span style={{ fontWeight: 800, fontSize: 12, color: "#0f172a", fontFamily: "system-ui, sans-serif" }}>
            {drone.droneId}
          </span>
        </div>
        <span style={{
          fontSize: 8, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
          background: colors.bg, color: colors.text,
          border: `1px solid ${colors.dot}44`,
          textTransform: "uppercase",
        }}>
          {Math.round(alt)}m
        </span>
      </div>

      {/* Metrics grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
        {[
          { icon: <Navigation size={10} />, label: "Altitude", value: `${Math.round(alt)}m` },
          { icon: <Zap size={10} />,        label: "Speed",    value: `${speed} m/s` },
          { icon: <Clock size={10} />,       label: "ETA",      value: drone.etaLabel ?? "—" },
          { icon: <TrendingUp size={10} />,  label: "Progress", value: drone.progressPct != null ? `${drone.progressPct}%` : "—" },
        ].map((m, i) => (
          <div key={i} style={{
            display: "flex", flexDirection: "column", gap: 2,
            background: "#f8fafc", borderRadius: 7, padding: "5px 8px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#94a3b8" }}>
              {m.icon}
              <span style={{ fontSize: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{m.label}</span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>{m.value}</span>
          </div>
        ))}
      </div>

      {/* Battery */}
      <BatteryBar level={battery} />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
const DroneInfoPanel = ({ externalDrones = {} }) => {
  const [drones3D,   setDrones3D]   = useState({}); // droneId → latest state
  const [decisions,  setDecisions]  = useState([]); // Decision log
  const [events,     setEvents]     = useState([]); // Raw event log
  const [selected,   setSelected]   = useState(null);
  const [activeTab,  setActiveTab]  = useState("drones"); // "drones" | "decisions" | "events"
  const socketRef = useRef(null);
  const eventEndRef = useRef(null);

  // Bootstrap from parent-provided drones
  useEffect(() => {
    if (Object.keys(externalDrones).length > 0) {
      setDrones3D(prev => ({ ...prev, ...externalDrones }));
    }
  }, [externalDrones]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ["polling", "websocket"],
      reconnection: true,
    });
    socketRef.current = socket;

    // ── A. Real-time 3D position updates ──────────────────
    socket.on("drone_position_3d", (data) => {
      setDrones3D(prev => ({ ...prev, [data.droneId]: { ...prev[data.droneId], ...data } }));
    });

    // ── B. Telemetry updates (from existing system) ────────
    socket.on("telemetry_update", (data) => {
      setDrones3D(prev => ({
        ...prev,
        [data.droneId]: { ...prev[data.droneId], ...data },
      }));
    });

    // ── C. Collision Warning 3D ────────────────────────────
    socket.on("collision_warning_3d", (data) => {
      const msg = data.resolution
        ? `${data.droneA} ↔ ${data.droneB}: ${
            data.resolution.action === "altitude_change"
              ? `Altitude increased to ${data.resolution.newAltitude}m to avoid collision`
              : data.resolution.action === "hover"
              ? `${data.resolution.droneId} hovering to yield`
              : data.resolution.action
          }`
        : `⚠ ${data.severity}: ${data.droneA} ↔ ${data.droneB} | H:${data.distanceHorizontal}m V:${data.distanceVertical}m`;

      addDecision({ type: "collision_warning_3d", message: msg, timestamp: new Date().toISOString() });
      addEvent({ type: "collision_warning_3d", message: msg, timestamp: new Date().toISOString() });
    });

    // ── D. Altitude change event ───────────────────────────
    socket.on("altitude_change", (data) => {
      const msg = `${data.droneId} altitude ${data.previousAltitude ?? "?"}m → ${data.newAltitude}m (${data.reason ?? "reassignment"})`;
      addDecision({ type: "altitude_change", message: msg, timestamp: new Date().toISOString() });
      addEvent({ type: "altitude_change", message: msg, timestamp: new Date().toISOString() });
    });

    // ── E. NFZ Violation ────────────────────────────────────
    socket.on("nfz_violation", (data) => {
      const msg = `${data.droneId} entered NFZ "${data.nfzName}" at alt ${data.altitude}m — BLOCKED`;
      addDecision({ type: "nfz_violation", message: msg, timestamp: new Date().toISOString() });
      addEvent({ type: "nfz_violation", message: msg, timestamp: new Date().toISOString() });
    });

    // ── F. Battery events ─────────────────────────────────────
    socket.on("drone_low_battery", (data) => {
      const msg = `⚡ ${data.droneId} battery critical (${data.batteryLevel?.toFixed(1)}%) — diverting to Power Station`;
      addDecision({ type: "low_battery", message: msg, timestamp: new Date().toISOString() });
      addEvent({    type: "low_battery", message: msg, timestamp: new Date().toISOString() });
      setDrones3D(prev => ({ ...prev, [data.droneId]: { ...(prev[data.droneId] ?? {}), ...data, status: "rerouting" } }));
    });

    socket.on("drone_charging", (data) => {
      setDrones3D(prev => ({ ...prev, [data.droneId]: { ...(prev[data.droneId] ?? {}), ...data, status: "charging" } }));
    });

    socket.on("drone_charging_done", (data) => {
      const msg = `✅ ${data.droneId} fully charged (100%) — resuming mission`;
      addDecision({ type: "altitude_change", message: msg, timestamp: new Date().toISOString() });
      addEvent({    type: "info",            message: msg, timestamp: new Date().toISOString() });
      setDrones3D(prev => ({ ...prev, [data.droneId]: { ...(prev[data.droneId] ?? {}), batteryLevel: 100, status: "delivering" } }));
    });

    // ── G. Generic event_log ──────────────────────────────────
    socket.on("event_log", (data) => {
      addEvent({
        type: data.type ?? "info",
        message: data.message,
        timestamp: new Date().toISOString(),
      });
    });

    return () => {
      ["drone_position_3d", "telemetry_update", "collision_warning_3d",
       "altitude_change", "nfz_violation", "event_log",
       "drone_low_battery", "drone_charging", "drone_charging_done"].forEach(e => socket.off(e));
      socket.disconnect();
    };
  }, []);

  function addDecision(item) {
    setDecisions(prev => [item, ...prev].slice(0, MAX_DECISIONS));
  }
  function addEvent(item) {
    setEvents(prev => [item, ...prev].slice(0, MAX_EVENTS));
  }

  const droneList = Object.values(drones3D);
  const selectedDrone = selected ? drones3D[selected] : null;

  // ── RENDER ───────────────────────────────────────────────
  const tabs = [
    { id: "drones",    label: "Fleet",     count: droneList.length },
    { id: "decisions", label: "Decisions", count: decisions.length },
    { id: "events",    label: "Log",       count: events.length    },
  ];

  return (
    <div style={{
      width: 280, height: "100%", display: "flex", flexDirection: "column",
      background: "#ffffff", borderLeft: "1px solid #f1f5f9",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      {/* Panel Header */}
      <div style={{
        padding: "16px 16px 0", borderBottom: "1px solid #f1f5f9",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, background: "#0f172a",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Activity size={14} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              3D Flight Control
            </div>
            <div style={{ fontSize: 8, color: "#94a3b8", fontWeight: 600 }}>
              {droneList.filter(d => d.status === "delivering").length} airborne
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0 }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1, padding: "8px 4px", border: "none", cursor: "pointer",
                background: "transparent",
                borderBottom: activeTab === tab.id ? "2px solid #0f172a" : "2px solid transparent",
                fontWeight: 700, fontSize: 9, textTransform: "uppercase",
                color: activeTab === tab.id ? "#0f172a" : "#94a3b8",
                letterSpacing: "0.04em", transition: "all 0.2s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
              }}
            >
              {tab.label}
              {tab.count > 0 && (
                <span style={{
                  fontSize: 8, background: activeTab === tab.id ? "#0f172a" : "#e2e8f0",
                  color: activeTab === tab.id ? "white" : "#94a3b8",
                  borderRadius: 10, padding: "0 5px", fontWeight: 800,
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>

        {/* ── FLEET TAB ── */}
        {activeTab === "drones" && (
          <>
            {droneList.length === 0 && (
              <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 11, paddingTop: 32 }}>
                <Radio size={24} color="#cbd5e1" style={{ margin: "0 auto 8px", display: "block" }} />
                Waiting for drone telemetry...
              </div>
            )}
            {droneList.map(drone => (
              <DroneCard
                key={drone.droneId}
                drone={drone}
                isSelected={selected === drone.droneId}
                onClick={() => setSelected(prev => prev === drone.droneId ? null : drone.droneId)}
              />
            ))}
          </>
        )}

        {/* ── DECISIONS TAB ── */}
        {activeTab === "decisions" && (
          <>
            {decisions.length === 0 && (
              <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 11, paddingTop: 32 }}>
                <Wind size={24} color="#cbd5e1" style={{ margin: "0 auto 8px", display: "block" }} />
                No autonomous decisions yet.
              </div>
            )}
            {decisions.map((item, i) => (
              <DecisionItem key={i} item={item} />
            ))}
          </>
        )}

        {/* ── EVENT LOG TAB ── */}
        {activeTab === "events" && (
          <>
            {events.length === 0 && (
              <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 11, paddingTop: 32 }}>
                <Activity size={24} color="#cbd5e1" style={{ margin: "0 auto 8px", display: "block" }} />
                No events yet.
              </div>
            )}
            {events.map((item, i) => {
              const typeColor = {
                info:                "#3b82f6",
                warning:             "#f59e0b",
                error:               "#ef4444",
                low_battery:         "#eab308",
                altitude_change:     "#8b5cf6",
                collision_warning_3d:"#ef4444",
                nfz_violation:       "#7c3aed",
              }[item.type] ?? "#94a3b8";

              return (
                <div key={i} style={{
                  padding: "7px 10px", borderRadius: 8, marginBottom: 5,
                  background: "#f8fafc", borderLeft: `3px solid ${typeColor}`,
                }}>
                  <div style={{ fontSize: 10, color: "#334155", fontWeight: 600, marginBottom: 2 }}>
                    {item.message}
                  </div>
                  <div style={{ fontSize: 8, color: "#94a3b8" }}>{timeAgo(item.timestamp)}</div>
                </div>
              );
            })}
            <div ref={eventEndRef} />
          </>
        )}
      </div>
    </div>
  );
};

export default DroneInfoPanel;
