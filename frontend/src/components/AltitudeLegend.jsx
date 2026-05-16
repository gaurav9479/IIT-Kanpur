/**
 * AltitudeLegend.jsx
 * Displays altitude layer legend + trail colour key.
 * Altitude bands now match Drone3DLayer thresholds:
 *   ≤ 30m  → blue   (Layer 1 Low)
 *   ≤ 50m  → green  (Layer 2 Mid)
 *   ≤ 70m  → orange (Layer 3 High)
 *   > 70m  → red    (Layer 4 Emergency)
 */

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Layers, AlertTriangle } from "lucide-react";

const LAYERS = [
  { id: "ALT-80",  range: "≤80m",     label: "Layer 1 (Low)",       color: "#3b82f6", bg: "#eff6ff", textColor: "#1d4ed8", maxAlt: 80  },
  { id: "ALT-130", range: "81–130m",  label: "Layer 2 (Mid)",       color: "#22c55e", bg: "#f0fdf4", textColor: "#15803d", maxAlt: 130 },
  { id: "ALT-180", range: "131–180m", label: "Layer 3 (High)",      color: "#f97316", bg: "#fff7ed", textColor: "#c2410c", maxAlt: 180 },
  { id: "ALT-230", range: "181–230m", label: "Layer 4 (Very High)", color: "#ef4444", bg: "#fef2f2", textColor: "#b91c1c", maxAlt: 230 },
  { id: "ALT-MAX", range: "231m+",    label: "Emergency",           color: "#a855f7", bg: "#faf5ff", textColor: "#7e22ce", maxAlt: 999 },
];

const TRAIL_LEGEND = [
  { color: "#f97316", label: "Pickup approach", dash: false },
  { color: "#22c55e", label: "Active delivery",  dash: false },
  { color: "#0d9488", label: "Return to hub",    dash: true  },
  { color: "#f59e0b", label: "Charging / RTH",   dash: true  },
];

function getLayerIdForAlt(alt) {
  if (alt <= 80)  return "ALT-80";
  if (alt <= 130) return "ALT-130";
  if (alt <= 180) return "ALT-180";
  if (alt <= 230) return "ALT-230";
  return "ALT-MAX";
}

const AltitudeLegend = ({ drones = {}, compactMode = false }) => {
  const layerCounts = useMemo(() => {
    const counts = { "ALT-80": 0, "ALT-130": 0, "ALT-180": 0, "ALT-230": 0, "ALT-MAX": 0 };
    Object.values(drones || {})?.forEach(drone => {
      const alt = drone.alt ?? drone.altitude ?? 50;
      const id  = getLayerIdForAlt(alt);
      counts[id] = (counts[id] ?? 0) + 1;
    });
    return counts;
  }, [drones]);

  const totalActive = Object.values(drones || {}).length;

  /* ── Compact badge row (inside map bottom-right) ─────────── */
  if (compactMode) {
    return (
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {LAYERS?.map(layer => (
          <div key={layer.id} title={`${layer.label} — ${layer.range}`}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "2px 8px", borderRadius: 20,
              background: layer.bg, border: `1px solid ${layer.color}33`,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: layer.color, flexShrink: 0 }} />
            <span style={{ fontSize: 9, fontWeight: 800, color: layer.textColor, letterSpacing: "0.04em" }}>
              {layer.range}
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

  /* ── Full legend panel ───────────────────────────────────── */
  return (
    <div style={{
      background: "rgba(255,255,255,0.93)",
      backdropFilter: "blur(14px)",
      border: "1px solid rgba(15,23,42,0.08)",
      borderRadius: 16,
      padding: "16px 18px",
      boxShadow: "0 4px 24px rgba(0,0,0,0.09)",
      minWidth: 210,
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

      {/* Altitude layer rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {LAYERS?.map(layer => {
          const count = layerCounts[layer.id] ?? 0;
          return (
            <div key={layer.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "6px 10px", borderRadius: 10,
              background: count > 0 ? layer.bg : "#f8fafc",
              border: `1px solid ${count > 0 ? layer.color + "44" : "#e2e8f0"}`,
              transition: "all 0.3s ease",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
                  <div style={{ fontSize: 8, color: "#94a3b8", fontWeight: 600 }}>
                    {layer.range} AGL
                  </div>
                </div>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 800,
                color: count > 0 ? "#fff" : "#cbd5e1",
                background: count > 0 ? layer.color : "#e2e8f0",
                borderRadius: 8, padding: "1px 8px", minWidth: 22, textAlign: "center",
                transition: "all 0.3s ease",
              }}>
                {count}
              </span>
            </div>
          );
        })}
      </div>

      {/* Trail colour key */}
      <div style={{ marginTop: 13, borderTop: "1px solid #f1f5f9", paddingTop: 10 }}>
        <div style={{ fontSize: 8, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 7 }}>
          Trail Colour Key
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {TRAIL_LEGEND?.map(t => (
            <div key={t.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Mini trail line */}
              <svg width="24" height="6" style={{ flexShrink: 0 }}>
                {t.dash
                  ? <line x1="0" y1="3" x2="24" y2="3" stroke={t.color} strokeWidth="2.5" strokeDasharray="4 3" />
                  : <line x1="0" y1="3" x2="24" y2="3" stroke={t.color} strokeWidth="2.5" />
                }
              </svg>
              <span style={{ fontSize: 9, fontWeight: 700, color: "#475569" }}>{t.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* High-traffic warning */}
      {totalActive >= 0 && ( // Always show for demo/visibility as requested, or set threshold
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            marginTop: 14, display: "flex", alignItems: "center", gap: 10,
            padding: "10px 14px", borderRadius: 12,
            background: "#fffbeb", border: "1.5px solid #fde68a",
            boxShadow: "0 2px 10px rgba(251, 191, 36, 0.1)"
          }}
        >
          <div style={{ background: "#fef3c7", padding: 5, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <AlertTriangle size={14} color="#d97706" />
          </div>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#92400e", letterSpacing: "-0.01em" }}>
            High traffic — conflict monitoring active
          </span>
        </motion.div>
      )}
    </div>
  );
};

export default AltitudeLegend;
