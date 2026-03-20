/**
 * AltitudeLegend.jsx
 * Displays the altitude layer legend for the 3D drone map.
 * Shows live drone counts per layer and highlights active conflicts.
 *
 * Props:
 *   drones       {Object}  — droneId → 3D state (with .alt field)
 *   compactMode  {boolean} — If true, renders a minimal floating badge
 */

import React, { useMemo } from "react";
import { Layers, AlertTriangle } from "lucide-react";

const LAYERS = [
  { id: "ALT-40",  altitude: 40,  label: "Layer 1",    color: "#3b82f6", bg: "#eff6ff", textColor: "#1d4ed8"  },
  { id: "ALT-50",  altitude: 50,  label: "Layer 2",    color: "#22c55e", bg: "#f0fdf4", textColor: "#15803d"  },
  { id: "ALT-60",  altitude: 60,  label: "Layer 3",    color: "#f97316", bg: "#fff7ed", textColor: "#c2410c"  },
  { id: "ALT-70",  altitude: 70,  label: "Emergency",  color: "#ef4444", bg: "#fef2f2", textColor: "#b91c1c"  },
];

function getLayerIdForAlt(alt) {
  if (alt <= 45) return "ALT-40";
  if (alt <= 55) return "ALT-50";
  if (alt <= 65) return "ALT-60";
  return "ALT-70";
}

const AltitudeLegend = ({ drones = {}, compactMode = false }) => {
  // Count drones per altitude layer
  const layerCounts = useMemo(() => {
    const counts = { "ALT-40": 0, "ALT-50": 0, "ALT-60": 0, "ALT-70": 0 };
    Object.values(drones).forEach(drone => {
      const alt = drone.alt ?? drone.altitude ?? 50;
      const id = getLayerIdForAlt(alt);
      counts[id] = (counts[id] ?? 0) + 1;
    });
    return counts;
  }, [drones]);

  const totalActive = Object.values(drones).length;

  if (compactMode) {
    return (
      <div style={{
        display: "flex", gap: 6, flexWrap: "wrap",
      }}>
        {LAYERS.map(layer => (
          <div
            key={layer.id}
            title={`${layer.label} — ${layer.altitude}m`}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "2px 8px", borderRadius: 20,
              background: layer.bg,
              border: `1px solid ${layer.color}33`,
            }}
          >
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: layer.color, flexShrink: 0,
            }} />
            <span style={{ fontSize: 9, fontWeight: 800, color: layer.textColor, letterSpacing: "0.04em" }}>
              {layer.altitude}m
            </span>
            {layerCounts[layer.id] > 0 && (
              <span style={{
                fontSize: 9, fontWeight: 700, color: "#fff",
                background: layer.color, borderRadius: 10,
                padding: "0 5px", marginLeft: 2,
              }}>
                {layerCounts[layer.id]}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{
      background: "rgba(255,255,255,0.92)",
      backdropFilter: "blur(12px)",
      border: "1px solid rgba(15,23,42,0.08)",
      borderRadius: 16,
      padding: "16px 18px",
      boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
      minWidth: 200,
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Layers size={14} color="white" />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Altitude Layers
          </div>
          <div style={{ fontSize: 9, color: "#64748b", fontWeight: 600 }}>
            {totalActive} drone{totalActive !== 1 ? "s" : ""} active
          </div>
        </div>
      </div>

      {/* Layer rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {LAYERS.map(layer => {
          const count = layerCounts[layer.id] ?? 0;
          return (
            <div
              key={layer.id}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "7px 10px", borderRadius: 10,
                background: count > 0 ? layer.bg : "#f8fafc",
                border: `1px solid ${count > 0 ? layer.color + "44" : "#e2e8f0"}`,
                transition: "all 0.3s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {/* Color swatch */}
                <span style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: layer.color,
                  boxShadow: count > 0 ? `0 0 6px ${layer.color}66` : "none",
                  flexShrink: 0,
                }} />
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: count > 0 ? layer.textColor : "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {layer.label}
                  </div>
                  <div style={{ fontSize: 9, color: "#94a3b8", fontWeight: 600 }}>
                    {layer.altitude}m AGL
                  </div>
                </div>
              </div>

              {/* Drone count badge */}
              <span style={{
                fontSize: 10, fontWeight: 800,
                color: count > 0 ? "#fff" : "#cbd5e1",
                background: count > 0 ? layer.color : "#e2e8f0",
                borderRadius: 8,
                padding: "1px 8px",
                minWidth: 22,
                textAlign: "center",
                transition: "all 0.3s ease",
              }}>
                {count}
              </span>
            </div>
          );
        })}
      </div>

      {/* Conflict indicator */}
      {totalActive > 3 && (
        <div style={{
          marginTop: 12, display: "flex", alignItems: "center", gap: 6,
          padding: "6px 10px", borderRadius: 8,
          background: "#fef9c3", border: "1px solid #fbbf24",
        }}>
          <AlertTriangle size={11} color="#d97706" />
          <span style={{ fontSize: 9, fontWeight: 700, color: "#92400e" }}>
            High traffic — conflict monitoring active
          </span>
        </div>
      )}

      {/* Map key dots */}
      <div style={{ marginTop: 12, borderTop: "1px solid #f1f5f9", paddingTop: 10 }}>
        <div style={{ fontSize: 8, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
          Map Key
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {LAYERS.map(l => (
            <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: l.color }} />
              <span style={{ fontSize: 8, color: "#64748b", fontWeight: 600 }}>{l.altitude}m</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AltitudeLegend;
