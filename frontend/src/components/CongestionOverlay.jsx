/**
 * CongestionOverlay.jsx — Fixed version.
 * Uses correct IITK bounds from mapConfig.js.
 * Converts grid [row,col] → lat/lng using LAT_STEP/LNG_STEP.
 */

import React from 'react';
import { Rectangle, Tooltip } from 'react-leaflet';
import { BOUNDS, GRID_SIZE, LAT_STEP, LNG_STEP, LANE_COUNT } from '../config/mapConfig';

const CongestionOverlay = ({ gridData = [] }) => {

  /**
   * Converts grid cell [row, col] → Leaflet [[southWestLat, sw Lng], [neLat, neLng]]
   * Formula per spec: lat = minLat + (row * LAT_STEP), lng = minLng + (col * LNG_STEP)
   */
  const getCellBounds = (row, col) => {
    const swLat = BOUNDS.minLat + (row * LAT_STEP);
    const swLng = BOUNDS.minLng + (col * LNG_STEP);
    const neLat = BOUNDS.minLat + ((row + 1) * LAT_STEP);
    const neLng = BOUNDS.minLng + ((col + 1) * LNG_STEP);
    return [[swLat, swLng], [neLat, neLng]];
  };

  /**
   * Color by drone count:
   * 0  = transparent (not rendered)
   * 1  = green,  opacity 0.3
   * 2  = orange, opacity 0.4
   * 3+ = red,    opacity 0.5
   */
  const getCellStyle = (density) => {
    if (density === 0) return null;
    if (density === 1) return { fillColor: '#22c55e', fillOpacity: 0.3, color: 'transparent', weight: 0 };
    if (density === 2) return { fillColor: '#f97316', fillOpacity: 0.4, color: 'transparent', weight: 0 };
    return { fillColor: '#ef4444', fillOpacity: 0.5, color: 'transparent', weight: 0 };
  };

  return (
    <>
      {gridData.map((cell, index) => {
        const style = getCellStyle(cell.density);
        if (!style) return null; // Don't render empty cells

        const bounds = getCellBounds(cell.x, cell.y);

        return (
          <Rectangle
            key={`${cell.x}-${cell.y}-${index}`}
            bounds={bounds}
            pathOptions={style}
          >
            <Tooltip permanent={false} direction="top">
              <div className="text-[10px] font-bold uppercase tracking-tight">
                Drone Density:{' '}
                <span className="text-navy-900">{cell.density} / {LANE_COUNT} Lanes</span>
              </div>
            </Tooltip>
          </Rectangle>
        );
      })}
    </>
  );
};

export default CongestionOverlay;
