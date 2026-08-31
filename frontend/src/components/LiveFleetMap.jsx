import React, { useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Tooltip,
  Polygon,
  Circle,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Navigation } from "lucide-react";

import CongestionOverlay from "./CongestionOverlay";
import Drone3DLayer from "./Drone3DLayer";

import {
  MAP_CENTER,
  MAP_ZOOM,
  CAMPUS_NODES,
} from "../config/mapConfig";

const ZONE_COLORS = {
  NO_FLY: { stroke: "#ef4444", fill: "#ef4444" },
  RESTRICTED: { stroke: "#eab308", fill: "#eab308" },
  PRIORITY: { stroke: "#3b82f6", fill: "#3b82f6" },
};

function zoneGeomToPositions(geometry) {
  if (!geometry) return null;

  if (geometry.type === "Circle") {
    const [lng, lat] = geometry.coordinates[0];
    return {
      center: [lat, lng],
      radius: geometry.radius || 100,
    };
  }

  const ring = geometry.coordinates[0] || [];
  return ring.map(([lng, lat]) => [lat, lng]);
}

const LiveFleetMap = ({
  drones = {},
  gridData = [],
  warningDrones = new Set(),
  zones = [],
}) => {
  const [showLegend] = useState(true);

  const dronesList = Object.values(drones);

  const KEY_NODES = Object.entries(CAMPUS_NODES).filter(
    ([name]) =>
      name.startsWith("Hub") ||
      [
        "OAT",
        "Main Gate",
        "Library",
        "Medical Center",
        "Shopping Complex",
        "Power Station",
        "Student Gymkhana",
      ].includes(name)
  );

  return (
    <div className="flex relative h-[500px] w-full rounded-3xl overflow-hidden border border-navy-900/10 shadow-2xl glass-card group">
      {/* ── Main Map Area ── */}
      <div className="relative h-full w-full">
        {/* Header */}
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

          {/* Dynamic Zones */}
          {zones.map((zone) => {
            if (!zone.visible || !zone.geometry) return null;

            const color =
              ZONE_COLORS[zone.type] || ZONE_COLORS.NO_FLY;

            const positions = zoneGeomToPositions(zone.geometry);

            if (!positions) return null;

            const pathOptions = {
              color: color.stroke,
              fillColor: color.fill,
              fillOpacity: 0.18,
              weight: 2,
              dashArray:
                zone.type === "NO_FLY"
                  ? "6 4"
                  : zone.type === "RESTRICTED"
                  ? "4 4"
                  : undefined,
            };

            if (zone.geometry.type === "Circle") {
              return (
                <Circle
                  key={zone.id}
                  center={positions.center}
                  radius={positions.radius}
                  pathOptions={pathOptions}
                >
                  <Tooltip sticky>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 900,
                        color: color.stroke,
                      }}
                    >
                      {zone.type === "NO_FLY"
                        ? "🚫"
                        : zone.type === "RESTRICTED"
                        ? "⚠️"
                        : "✅"}{" "}
                      {zone.name}
                    </span>
                  </Tooltip>
                </Circle>
              );
            }

            return (
              <Polygon
                key={zone.id}
                positions={positions}
                pathOptions={pathOptions}
              >
                <Tooltip sticky>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 900,
                      color: color.stroke,
                    }}
                  >
                    {zone.type === "NO_FLY"
                      ? "🚫"
                      : zone.type === "RESTRICTED"
                      ? "⚠️"
                      : "✅"}{" "}
                    {zone.name}
                  </span>
                </Tooltip>
              </Polygon>
            );
          })}

          {/* Landmarks */}
          {KEY_NODES.map(([name, coords]) => {
            const isHub = name.startsWith("Hub");
            const isPower = name === "Power Station";

            return (
              <Marker
                key={name}
                position={[coords.lat, coords.lng]}
                icon={L.divIcon({
                  className: "",
                  html: `
                    <div
                      style="
                        font-size:8px;
                        font-weight:800;
                        color:${
                          isHub
                            ? "#ea580c"
                            : isPower
                            ? "#ca8a04"
                            : "#334155"
                        };
                        background:rgba(255,255,255,0.9);
                        padding:2px 6px;
                        border-radius:4px;
                        white-space:nowrap;
                        border:1px solid ${
                          isHub
                            ? "#fed7aa"
                            : isPower
                            ? "#fef08a"
                            : "#e2e8f0"
                        };
                        box-shadow:0 1px 3px rgba(0,0,0,0.1);
                      "
                    >
                      ${
                        isHub
                          ? "⚡"
                          : isPower
                          ? "🔋"
                          : ""
                      }
                      ${name}
                    </div>
                  `,
                  iconAnchor: [0, 0],
                })}
              />
            );
          })}

          <Drone3DLayer
            externalDrones={drones}
            warningDrones={warningDrones}
          />
        </MapContainer>
      </div>
    </div>
  );
};

export default LiveFleetMap;