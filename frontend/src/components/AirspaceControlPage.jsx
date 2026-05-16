/**
 * AirspaceControlPage.jsx — Real-time Drone Airspace Management Interface
 *
 * Full-screen air traffic control UI with:
 *   • Left panel: draw tool selector, zone config form, zone list
 *   • Right panel: live Leaflet map with draw tools + dynamic zone layers
 *
 * Zone colour coding:
 *   NO_FLY     → #ef4444 / red
 *   RESTRICTED → #eab308 / yellow
 *   PRIORITY   → #3b82f6 / blue
 */

import React, { useState, useCallback, useRef } from 'react';
import { Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert, Pencil, Trash2, Eye, EyeOff, Plus, ChevronDown,
  ChevronUp, Radio, Layers, Clock, ArrowUpDown, Pentagon, CircleIcon,
  Square, X, CheckCircle, AlertTriangle, ZapOff,
} from 'lucide-react';
import { useZones } from '../hooks/useZones';
import DrawControl from './DrawControl';
import SharedAirspaceMap from './SharedAirspaceMap';
import { MAP_CENTER, MAP_ZOOM } from '../config/mapConfig';

// ── Colour helpers ────────────────────────────────────────────────────────────
const ZONE_COLORS = {
  NO_FLY:     { stroke: '#ef4444', fill: '#ef4444', label: 'No-Fly',     icon: ZapOff },
  RESTRICTED: { stroke: '#eab308', fill: '#eab308', label: 'Restricted', icon: AlertTriangle },
};

const SHAPE_OPTS = [
  { key: 'Polygon',   label: 'Polygon',   icon: Pentagon },
  { key: 'Circle',    label: 'Circle',    icon: CircleIcon },
  { key: 'Rectangle', label: 'Rectangle', icon: Square },
];

const TYPE_OPTS = ['NO_FLY', 'RESTRICTED'];

// Default form state
const defaultForm = () => ({
  name: '',
  type: 'NO_FLY',
  altitude_min: 0,
  altitude_max: 120,
  start_time: '',
  end_time: '',
});

// ── Geometry → Leaflet positions ─────────────────────────────────────────────
function geometryToPositions(geometry) {
  if (!geometry) return null;
  if (geometry.type === 'Circle') {
    const [lng, lat] = geometry.coordinates[0];
    return { center: [lat, lng], radius: geometry.radius || 100 };
  }
  // Polygon / Rectangle — outer ring [[lng,lat],...]
  const ring = geometry.coordinates[0] || [];
  return ring.map(([lng, lat]) => [lat, lng]);
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AirspaceControlPage() {
  const { zones, loading, createZone, updateZone, deleteZone, toggleVisibility } = useZones();

  const [drawShape, setDrawShape] = useState('Polygon');
  const [drawActive, setDrawActive] = useState(false);
  const [pendingGeometry, setPendingGeometry] = useState(null);
  const [form, setForm] = useState(defaultForm());
  const [editingId, setEditingId] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);

  const showNotif = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // ── Drawing ────────────────────────────────────────────────────────────────
  const handleZoneDrawn = useCallback((geometry) => {
    setPendingGeometry(geometry);
    setDrawActive(false);
    showNotif('Shape drawn! Fill in the details and save.', 'info');
  }, []);

  const startDraw = () => {
    setPendingGeometry(null);
    setEditingId(null);
    setForm(defaultForm());
    setDrawActive(true);
    showNotif('Draw your zone on the map…', 'info');
  };

  const cancelDraw = () => {
    setDrawActive(false);
    setPendingGeometry(null);
    setForm(defaultForm());
    setEditingId(null);
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name.trim()) { showNotif('Zone name is required.', 'error'); return; }
    if (!pendingGeometry && !editingId) { showNotif('Draw a zone shape on the map first.', 'error'); return; }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        altitude_min: Number(form.altitude_min),
        altitude_max: Number(form.altitude_max),
        start_time: form.start_time || null,
        end_time: form.end_time || null,
      };
      if (pendingGeometry) payload.geometry = pendingGeometry;

      if (editingId) {
        await updateZone(editingId, payload);
        showNotif('Zone updated successfully.');
      } else {
        await createZone(payload);
        showNotif('Zone created successfully.');
      }

      cancelDraw();
    } catch (err) {
      showNotif(err?.response?.data?.message || 'Failed to save zone.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Edit ──────────────────────────────────────────────────────────────────
  const handleEdit = (zone) => {
    setEditingId(zone.id);
    setForm({
      name: zone.name,
      type: zone.type,
      altitude_min: zone.altitude_min,
      altitude_max: zone.altitude_max,
      start_time: zone.start_time ? zone.start_time.slice(0, 16) : '',
      end_time: zone.end_time ? zone.end_time.slice(0, 16) : '',
    });
    setPendingGeometry(null);
    showNotif('Editing — draw a new shape or just update metadata.', 'info');
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this zone from the airspace?')) return;
    try {
      await deleteZone(id);
      showNotif('Zone deleted.');
      if (editingId === id) cancelDraw();
    } catch {
      showNotif('Delete failed.', 'error');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden" style={{ background: '#0a0f1e' }}>

      {/* ── LEFT PANEL ──────────────────────────────────────────────────── */}
      <div className="flex flex-col w-[340px] min-w-[340px] h-full overflow-y-auto border-r"
        style={{ borderColor: '#1e2a45', background: '#0d1425', zIndex: 10 }}>

        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b" style={{ borderColor: '#1e2a45' }}>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-2 rounded-xl" style={{ background: '#1a2540' }}>
              <Layers size={18} style={{ color: '#60a5fa' }} />
            </div>
            <div>
              <h1 className="text-sm font-black uppercase tracking-wider" style={{ color: '#f1f5f9' }}>
                Airspace Control
              </h1>
              <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#475569' }}>
                Dynamic Zone Management
              </p>
            </div>
          </div>
        </div>

        {/* Notification */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mx-4 mt-3 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest"
              style={{
                background: notification.type === 'error' ? '#450a0a'
                  : notification.type === 'info' ? '#172554' : '#052e16',
                color: notification.type === 'error' ? '#f87171'
                  : notification.type === 'info' ? '#93c5fd' : '#4ade80',
                border: `1px solid ${notification.type === 'error' ? '#7f1d1d'
                  : notification.type === 'info' ? '#1e40af' : '#14532d'}`,
              }}>
              {notification.msg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Create / Edit Form */}
        <div className="px-4 py-4 border-b" style={{ borderColor: '#1e2a45' }}>
          <div className="text-[9px] font-black uppercase tracking-widest mb-3" style={{ color: '#64748b' }}>
            {editingId ? '✏️ Edit Zone' : '➕ New Zone'}
          </div>

          {/* Zone Name */}
          <input
            type="text"
            placeholder="Zone name…"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl text-xs font-bold mb-3 outline-none"
            style={{ background: '#1a2540', color: '#e2e8f0', border: '1px solid #253554', placeholder: '#475569' }}
          />

          {/* Zone Type */}
          <div className="flex gap-1.5 mb-3">
            {TYPE_OPTS.map(t => {
              const c = ZONE_COLORS[t];
              const Icon = c.icon;
              const active = form.type === t;
              return (
                <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
                  className="flex-1 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1 transition-all"
                  style={{
                    background: active ? `${c.stroke}22` : '#1a2540',
                    border: `1px solid ${active ? c.stroke : '#253554'}`,
                    color: active ? c.stroke : '#64748b',
                  }}>
                  <Icon size={10} />{c.label}
                </button>
              );
            })}
          </div>

          {/* Draw Shape */}
          <div className="mb-3">
            <div className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: '#64748b' }}>Draw Tool</div>
            <div className="flex gap-1.5">
              {SHAPE_OPTS.map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => setDrawShape(key)}
                  className="flex-1 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1 transition-all"
                  style={{
                    background: drawShape === key ? '#1e3a5f' : '#1a2540',
                    border: `1px solid ${drawShape === key ? '#3b82f6' : '#253554'}`,
                    color: drawShape === key ? '#60a5fa' : '#64748b',
                  }}>
                  <Icon size={10} />{label}
                </button>
              ))}
            </div>
          </div>

          {/* Altitude Range */}
          <div className="flex gap-2 mb-3">
            <div className="flex-1">
              <label className="text-[9px] font-black uppercase tracking-widest block mb-1" style={{ color: '#64748b' }}>
                <ArrowUpDown size={8} className="inline mr-1" />Min Alt (m)
              </label>
              <input type="number" value={form.altitude_min}
                onChange={e => setForm(f => ({ ...f, altitude_min: e.target.value }))}
                className="w-full px-2 py-1.5 rounded-lg text-xs font-bold outline-none"
                style={{ background: '#1a2540', color: '#e2e8f0', border: '1px solid #253554' }} />
            </div>
            <div className="flex-1">
              <label className="text-[9px] font-black uppercase tracking-widest block mb-1" style={{ color: '#64748b' }}>
                Max Alt (m)
              </label>
              <input type="number" value={form.altitude_max}
                onChange={e => setForm(f => ({ ...f, altitude_max: e.target.value }))}
                className="w-full px-2 py-1.5 rounded-lg text-xs font-bold outline-none"
                style={{ background: '#1a2540', color: '#e2e8f0', border: '1px solid #253554' }} />
            </div>
          </div>

          {/* Time Window */}
          <div className="flex gap-2 mb-4">
            <div className="flex-1">
              <label className="text-[9px] font-black uppercase tracking-widest block mb-1" style={{ color: '#64748b' }}>
                <Clock size={8} className="inline mr-1" />Start
              </label>
              <input type="datetime-local" value={form.start_time}
                onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                className="w-full px-2 py-1.5 rounded-lg text-[9px] font-bold outline-none"
                style={{ background: '#1a2540', color: '#94a3b8', border: '1px solid #253554' }} />
            </div>
            <div className="flex-1">
              <label className="text-[9px] font-black uppercase tracking-widest block mb-1" style={{ color: '#64748b' }}>
                End
              </label>
              <input type="datetime-local" value={form.end_time}
                onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                className="w-full px-2 py-1.5 rounded-lg text-[9px] font-bold outline-none"
                style={{ background: '#1a2540', color: '#94a3b8', border: '1px solid #253554' }} />
            </div>
          </div>

          {/* Pending geometry indicator */}
          {pendingGeometry && (
            <div className="mb-3 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest"
              style={{ background: '#052e16', border: '1px solid #14532d', color: '#4ade80' }}>
              ✓ Shape drawn — {pendingGeometry.type}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            {!drawActive ? (
              <button onClick={startDraw}
                className="flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all"
                style={{ background: '#1e3a5f', color: '#60a5fa', border: '1px solid #2563eb' }}>
                <Pencil size={12} />
                {editingId ? 'Redraw Shape' : 'Draw on Map'}
              </button>
            ) : (
              <button onClick={cancelDraw}
                className="flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5"
                style={{ background: '#450a0a', color: '#f87171', border: '1px solid #7f1d1d' }}>
                <X size={12} />Cancel Draw
              </button>
            )}

            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all"
              style={{
                background: saving ? '#1a2540' : '#14532d',
                color: saving ? '#475569' : '#4ade80',
                border: `1px solid ${saving ? '#253554' : '#166534'}`,
                cursor: saving ? 'not-allowed' : 'pointer',
              }}>
              <Plus size={12} />{saving ? 'Saving…' : editingId ? 'Update' : 'Create'}
            </button>
          </div>
        </div>

        {/* Zone List */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#64748b' }}>
              Active Zones
            </div>
            <div className="text-[9px] font-black px-2 py-0.5 rounded-full"
              style={{ background: '#1e2a45', color: '#60a5fa' }}>
              {zones.length}
            </div>
          </div>

          {loading && (
            <div className="text-[10px] font-black uppercase tracking-widest text-center py-8"
              style={{ color: '#475569' }}>Loading zones…</div>
          )}

          {!loading && zones.length === 0 && (
            <div className="text-center py-12">
              <div style={{ color: '#253554', marginBottom: 8 }}><Layers size={40} className="mx-auto" /></div>
              <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#475569' }}>
                No zones defined yet.
              </p>
              <p className="text-[9px] font-bold mt-1" style={{ color: '#334155' }}>
                Use the form above to draw your first zone.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <AnimatePresence>
              {zones.map((zone) => {
                const c = ZONE_COLORS[zone.type] || ZONE_COLORS.NO_FLY;
                const Icon = c.icon;
                const isExpanded = expandedId === zone.id;
                return (
                  <motion.div key={zone.id}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    className="rounded-2xl overflow-hidden"
                    style={{ background: '#1a2540', border: `1px solid ${zone.visible ? c.stroke + '44' : '#253554'}` }}>

                    <div className="px-3 py-2.5 flex items-center gap-2">
                      <div className="p-1.5 rounded-lg" style={{ background: `${c.stroke}22` }}>
                        <Icon size={12} style={{ color: c.stroke }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-black truncate" style={{ color: zone.visible ? '#e2e8f0' : '#475569' }}>
                          {zone.name}
                        </div>
                        <div className="text-[8px] font-bold uppercase tracking-widest" style={{ color: c.stroke + 'cc' }}>
                          {c.label} · {zone.geometry?.type}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => toggleVisibility(zone.id)}
                          className="p-1 rounded-lg transition-all hover:opacity-80"
                          style={{ color: zone.visible ? '#60a5fa' : '#475569' }}
                          title={zone.visible ? 'Hide zone' : 'Show zone'}>
                          {zone.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                        </button>
                        <button onClick={() => handleEdit(zone)}
                          className="p-1 rounded-lg transition-all hover:opacity-80"
                          style={{ color: '#fbbf24' }} title="Edit zone">
                          <Pencil size={12} />
                        </button>
                        <button onClick={() => handleDelete(zone.id)}
                          className="p-1 rounded-lg transition-all hover:opacity-80"
                          style={{ color: '#f87171' }} title="Delete zone">
                          <Trash2 size={12} />
                        </button>
                        <button onClick={() => setExpandedId(isExpanded ? null : zone.id)}
                          className="p-1 rounded-lg transition-all hover:opacity-80"
                          style={{ color: '#64748b' }}>
                          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <div className="px-3 pb-3 pt-1 border-t space-y-1" style={{ borderColor: '#253554' }}>
                            {[
                              ['Altitude', `${zone.altitude_min}m – ${zone.altitude_max}m`],
                              ['Time Start', zone.start_time ? new Date(zone.start_time).toLocaleString() : 'Always'],
                              ['Time End',   zone.end_time   ? new Date(zone.end_time).toLocaleString()   : 'Always'],
                              ['ID',         zone.id?.slice(0, 8) + '…'],
                            ].map(([k, v]) => (
                              <div key={k} className="flex justify-between items-center">
                                <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: '#475569' }}>{k}</span>
                                <span className="text-[8px] font-bold" style={{ color: '#94a3b8' }}>{v}</span>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Footer Stats */}
        <div className="px-4 py-3 border-t" style={{ borderColor: '#1e2a45' }}>
          <div className="grid grid-cols-3 gap-2">
            {TYPE_OPTS.map(t => {
              const count = zones.filter(z => z.type === t).length;
              const c = ZONE_COLORS[t];
              return (
                <div key={t} className="text-center p-2 rounded-xl" style={{ background: '#1a2540' }}>
                  <div className="text-base font-black" style={{ color: c.stroke }}>{count}</div>
                  <div className="text-[7px] font-black uppercase tracking-widest" style={{ color: '#475569' }}>
                    {c.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL — MAP ───────────────────────────────────────────── */}
      <div className="flex-1 relative" style={{ zIndex: 1 }}>

        {/* Map header overlay */}
        <div className="absolute top-4 left-4 z-[1000] flex items-center gap-2.5"
          style={{ background: 'rgba(13,20,37,0.92)', backdropFilter: 'blur(10px)', borderRadius: 12, padding: '8px 12px', border: '1px solid #1e2a45' }}>
          <Radio size={14} style={{ color: '#60a5fa' }} />
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#e2e8f0' }}>
              Airspace Control — Live
            </div>
            <div className="text-[8px] font-bold uppercase tracking-widest" style={{ color: '#475569' }}>
              {zones.filter(z => z.visible).length} active zones · {drawActive ? '🔴 Drawing mode' : 'Viewing mode'}
            </div>
          </div>
        </div>

        {/* Zone legend overlay */}
        <div className="absolute top-4 right-4 z-[1000] space-y-1.5"
          style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(10px)', borderRadius: 12, padding: '10px 14px', border: '1px solid #e2e8f0' }}>
          <div className="text-[8px] font-black uppercase tracking-widest mb-2" style={{ color: '#94a3b8' }}>Zone Legend</div>
          {Object.entries(ZONE_COLORS).map(([type, c]) => (
            <div key={type} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: c.stroke }} />
              <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: '#475569' }}>{c.label}</span>
            </div>
          ))}
        </div>

        {/* Drawing mode banner */}
        <AnimatePresence>
          {drawActive && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2"
              style={{ background: '#172554', border: '1px solid #2563eb', color: '#93c5fd' }}>
              <Pencil size={14} />
              Click on map to draw a {drawShape.toLowerCase()} — complete by closing the shape
            </motion.div>
          )}
        </AnimatePresence>

        {/* Shared map — identical tile + zones as MissionPlanner */}
        <SharedAirspaceMap
          className="h-full w-full"
          showDrones
          showCongestion
          drawControl={
            <DrawControl
              drawShape={drawShape}
              active={drawActive}
              onZoneDrawn={handleZoneDrawn}
              onDrawCancel={cancelDraw}
            />
          }
          popupRenderer={(zone) => {
            const c = ZONE_COLORS[zone.type] || ZONE_COLORS.NO_FLY;
            return (
              <Popup>
                <div style={{ minWidth: 180, fontFamily: 'monospace' }}>
                  <div style={{ fontWeight: 900, fontSize: 12, color: c.stroke, marginBottom: 4 }}>
                    {zone.name}
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6 }}>
                    <span style={{ color: c.stroke, fontWeight: 700 }}>{c.label}</span>
                    {' · '}{zone.geometry?.type}
                  </div>
                  <table style={{ fontSize: 9, width: '100%', borderCollapse: 'collapse' }}>
                    {[
                      ['Altitude',     `${zone.altitude_min}m – ${zone.altitude_max}m`],
                      ['Active From',  zone.start_time ? new Date(zone.start_time).toLocaleString() : 'Always'],
                      ['Active Until', zone.end_time   ? new Date(zone.end_time).toLocaleString()   : 'Always'],
                    ].map(([k, v]) => (
                      <tr key={k}>
                        <td style={{ color: '#94a3b8', paddingRight: 8, fontWeight: 700 }}>{k}</td>
                        <td style={{ color: '#334155' }}>{v}</td>
                      </tr>
                    ))}
                  </table>
                  <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                    <button onClick={() => handleEdit(zone)}
                      style={{ fontSize: 9, fontWeight: 900, color: '#fbbf24', background: 'none', border: 'none', cursor: 'pointer' }}>
                      ✏️ Edit
                    </button>
                    <button onClick={() => handleDelete(zone.id)}
                      style={{ fontSize: 9, fontWeight: 900, color: '#f87171', background: 'none', border: 'none', cursor: 'pointer' }}>
                      🗑 Delete
                    </button>
                  </div>
                </div>
              </Popup>
            );
          }}
        />
      </div>
    </div>
  );
}

