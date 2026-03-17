import React, { useState, useEffect } from 'react';
import { Rectangle, Tooltip } from 'react-leaflet';
import { io } from 'socket.io-client';


const CongestionOverlay = () => {
  const [gridData, setGridData] = useState([]);

  // IITK Campus Boundaries (Matched with MapService)
  const BOUNDS = {
    minLat: 26.5000,
    maxLat: 26.5200,
    minLng: 80.2200,
    maxLng: 80.2500
  };
  const GRID_SIZE = 100;

  useEffect(() => {
    const socket = io('http://localhost:5001');

    socket.on('grid_update', (data) => {
      // Expected: Array of { x: row, y: col, density: number }
      setGridData(data);
    });

    return () => socket.disconnect();
  }, []);

  const getCellBounds = (row, col) => {
    const latStep = (BOUNDS.maxLat - BOUNDS.minLat) / GRID_SIZE;
    const lngStep = (BOUNDS.maxLng - BOUNDS.minLng) / GRID_SIZE;

    const southWest = [
      BOUNDS.minLat + (row * latStep),
      BOUNDS.minLng + (col * lngStep)
    ];
    const northEast = [
      BOUNDS.minLat + ((row + 1) * latStep),
      BOUNDS.minLng + ((col + 1) * lngStep)
    ];

    return [southWest, northEast];
  };

  const getCongestionColor = (density) => {
    if (density <= 2) return '#22c55e'; // Green (Low)
    if (density <= 5) return '#f59e0b'; // Yellow (Medium)
    return '#ef4444'; // Red (High)
  };

  const getOpacity = (density) => {
    return Math.min(0.2 + (density * 0.1), 0.7);
  };

  return (
    <>
      {gridData.map((cell, index) => {
        const bounds = getCellBounds(cell.x, cell.y);
        const color = getCongestionColor(cell.density);
        const opacity = getOpacity(cell.density);

        return (
          <Rectangle
            key={`${cell.x}-${cell.y}-${index}`}
            bounds={bounds}
            pathOptions={{
              fillColor: color,
              fillOpacity: opacity,
              color: 'transparent',
              weight: 0
            }}
          >
            <Tooltip permanent={false} direction="top">
              <div className="text-[10px] font-bold uppercase tracking-tight">
                Drone Density: <span className="text-navy-900">{cell.density} Units</span>
              </div>
            </Tooltip>
          </Rectangle>
        );
      })}
    </>
  );
};

export default CongestionOverlay;
