/**
 * DrawControl.jsx — Leaflet-draw integration for airspace zone creation.
 *
 * Wraps L.Control.Draw and exposes polygon, circle, and rectangle drawing.
 * When a shape is completed, calls onZoneDrawn(geoJSON) with a normalized
 * GeoJSON geometry object ready to POST to the backend.
 *
 * Usage:
 *   <DrawControl
 *     drawShape="Polygon" | "Circle" | "Rectangle"
 *     active={true/false}
 *     onZoneDrawn={(geometry) => ...}
 *     onDrawCancel={() => ...}
 *   />
 */

import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';

const DRAW_OPTIONS = {
  Polygon: {
    polygon: {
      allowIntersection: false,
      showArea: false,
      shapeOptions: { color: '#ef4444', fillOpacity: 0.25, weight: 2 },
    },
    polyline: false, rectangle: false, circle: false,
    circlemarker: false, marker: false,
  },
  Circle: {
    circle: {
      shapeOptions: { color: '#ef4444', fillOpacity: 0.25, weight: 2 },
    },
    polygon: false, polyline: false, rectangle: false,
    circlemarker: false, marker: false,
  },
  Rectangle: {
    rectangle: {
      shapeOptions: { color: '#ef4444', fillOpacity: 0.25, weight: 2 },
    },
    polygon: false, polyline: false, circle: false,
    circlemarker: false, marker: false,
  },
};

export default function DrawControl({ drawShape = 'Polygon', active, onZoneDrawn, onDrawCancel }) {
  const map = useMap();
  const drawnLayersRef = useRef(new L.FeatureGroup());
  const controlRef = useRef(null);
  const handlerRef = useRef(null);

  useEffect(() => {
    const fg = drawnLayersRef.current;
    map.addLayer(fg);

    // Build control once
    const control = new L.Control.Draw({
      edit: { featureGroup: fg, remove: false },
      draw: DRAW_OPTIONS[drawShape] || DRAW_OPTIONS.Polygon,
    });
    controlRef.current = control;

    const handleCreated = (e) => {
      const layer = e.layer;
      fg.clearLayers();
      fg.addLayer(layer);

      let geometry = null;

      if (e.layerType === 'circle') {
        const center = layer.getLatLng();
        geometry = {
          type: 'Circle',
          coordinates: [[center.lng, center.lat]],
          radius: layer.getRadius(),
        };
      } else {
        // polygon or rectangle — extract outer ring
        const latLngs = layer.getLatLngs ? layer.getLatLngs()[0] : [];
        const coords = (Array.isArray(latLngs) ? latLngs : [latLngs])
          .map((ll) => [ll.lng, ll.lat]);
        // Close the ring
        if (coords.length && (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1])) {
          coords.push(coords[0]);
        }
        geometry = {
          type: e.layerType === 'rectangle' ? 'Rectangle' : 'Polygon',
          coordinates: [coords],
        };
      }

      if (onZoneDrawn) onZoneDrawn(geometry);
    };

    map.on(L.Draw.Event.CREATED, handleCreated);

    return () => {
      map.off(L.Draw.Event.CREATED, handleCreated);
      if (fg) map.removeLayer(fg);
      if (controlRef.current) {
        try { controlRef.current.remove(); } catch (_) {}
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-create control when drawShape changes
  useEffect(() => {
    if (!controlRef.current) return;
    try { controlRef.current.remove(); } catch (_) {}

    const control = new L.Control.Draw({
      edit: { featureGroup: drawnLayersRef.current, remove: false },
      draw: DRAW_OPTIONS[drawShape] || DRAW_OPTIONS.Polygon,
    });
    controlRef.current = control;
    if (active) {
      control.addTo(map);
      _startHandler(map, control, drawShape);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawShape]);

  // Activate / deactivate drawing
  useEffect(() => {
    if (!controlRef.current) return;
    if (active) {
      controlRef.current.addTo(map);
      _startHandler(map, controlRef.current, drawShape);
    } else {
      try { handlerRef.current?.disable(); } catch (_) {}
      try { controlRef.current.remove(); } catch (_) {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return null;
}

function _startHandler(map, control, drawShape) {
  // Directly trigger the draw handler without waiting for toolbar click
  const handlers = control._toolbars?.draw?._modes;
  if (!handlers) return;
  const key = drawShape === 'Rectangle' ? 'rectangle'
    : drawShape === 'Circle' ? 'circle' : 'polygon';
  const mode = handlers[key];
  if (mode?.handler) {
    try { mode.handler.enable(); } catch (_) {}
  }
}
