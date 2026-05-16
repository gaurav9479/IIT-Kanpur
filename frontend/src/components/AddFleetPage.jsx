import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plane, Plus, Cpu, Weight, ShieldCheck, Trash2, Activity,
  Zap, CheckCircle2, AlertCircle, Mountain, MapPin, Battery
} from 'lucide-react';
import { useSocket } from '../hooks/useSocket';
import axios from 'axios';
import { API_URL, DRONE_HUBS } from '../config/mapConfig';

import AltitudeLegend from './AltitudeLegend';

// Altitude layers mapped to colour bands for visual cue
const ALT_BANDS = [
  { min: 0,   max: 80,  label: 'Layer 1 (Low)',       color: '#3b82f6' }, // blue
  { min: 81,  max: 130, label: 'Layer 2 (Mid)',       color: '#22c55e' }, // green
  { min: 131, max: 180, label: 'Layer 3 (High)',      color: '#f97316' }, // orange
  { min: 181, max: 230, label: 'Layer 4 (Very High)', color: '#ef4444' }, // red
  { min: 231, max: 999, label: 'Layer 5 (Max)',       color: '#a855f7' }, // purple
];

function getAltColor(alt) {
  const band = ALT_BANDS.find(b => alt >= b.min && alt <= b.max);
  return band?.color ?? '#94a3b8';
}

const HUB_NAMES = Object.keys(DRONE_HUBS || {});
const DEFAULT_HUB = 'Hub Central';

const AddFleetPage = () => {
  const { drones } = useSocket();
  const droneList = useMemo(() => Object.values(drones || {}), [drones]);

  const [formData, setFormData] = useState({
    droneId: '',
    vehicleType: 'drone',
    payloadCapacity: 2.0,
    operatingAltitude: 80,
    homeHub: DEFAULT_HUB,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Battery drain estimator — genuine physics:
  // A typical campus delivery drone draws ~150W, battery ~50Wh → ~20 min flight
  // At 10 m/s cruise that's ~12 km range per charge
  // Drain ≈ 100% / 12000m = 0.0083% per metre
  // We display it from operating altitude: higher altitude → slightly more draw
  function estimateBatteryPerKm(alt) {
    const base = 8.3; // % per km at 50 m
    const altFactor = 1 + ((alt - 50) / 50) * 0.15; // +15% per 50 m above baseline
    return (base * altFactor).toFixed(1);
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.droneId) return;
    setIsSubmitting(true);
    setFeedback(null);

    const hubCoords = DRONE_HUBS[formData.homeHub] || DRONE_HUBS[DEFAULT_HUB];
    const payload = {
      ...formData,
      homeHub: {
        name: formData.homeHub,
        lat: hubCoords.lat,
        lng: hubCoords.lng,
      },
      location: { lat: hubCoords.lat, lng: hubCoords.lng }, // start at hub
    };

    try {
      await axios.post(`${API_URL}/drones`, payload);
      setFeedback({ type: 'success', msg: `✅ ${formData.droneId} added to fleet at ${formData.homeHub}.` });
      setFormData({ droneId: '', vehicleType: 'drone', payloadCapacity: 2.0, operatingAltitude: 80, homeHub: DEFAULT_HUB });
    } catch (err) {
      setFeedback({ type: 'error', msg: err.response?.data?.message || 'Failed to add vehicle. Ensure ID is unique.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id, droneId) => {
    if (!window.confirm(`Remove ${droneId} from fleet?`)) return;
    try {
      await axios.delete(`${API_URL}/drones/${id}`);
      setFeedback({ type: 'success', msg: `Asset ${droneId} removed.` });
    } catch (err) {
      setFeedback({ type: 'error', msg: 'Failed to remove asset.' });
    }
  };

  const altColor = getAltColor(formData.operatingAltitude);
  const drainPerKm = estimateBatteryPerKm(formData.operatingAltitude);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 custom-scrollbar bg-white">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-sora font-black text-navy-900 tracking-tighter uppercase mb-2">
            Fleet <span className="text-navy-400">Expansion</span>
          </h1>
          <p className="text-navy-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
            <Activity size={10} className="text-sky-500 animate-pulse" />
            Integrate New Autonomous Assets | {droneList.length} Units Total
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ─── Form ─────────────────────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-card p-8 border border-navy-900/10 shadow-2xl relative overflow-hidden bg-white/50 backdrop-blur-xl"
          >
            <div className="absolute -right-8 -top-8 text-navy-900/5 rotate-12">
              <Plus size={160} />
            </div>

            <h3 className="text-xl font-sora font-black text-navy-900 tracking-tighter uppercase mb-6 flex items-center gap-2">
              <Plane size={20} /> Register Asset
            </h3>

            <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
              {/* Drone ID */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-navy-600 uppercase tracking-widest">Unique Asset ID</label>
                <input
                  type="text" required placeholder="e.g. SKY-001"
                  value={formData.droneId}
                  onChange={e => setFormData({ ...formData, droneId: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-3 bg-navy-900/5 rounded-xl text-sm font-bold text-navy-900 border border-transparent focus:border-navy-900/20 focus:outline-none transition-all"
                />
              </div>

              {/* Vehicle Type */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-navy-600 uppercase tracking-widest">Vehicle Architecture</label>
                <div className="grid grid-cols-2 gap-3">
                  {['drone', 'plane']?.map(type => (
                    <button key={type} type="button"
                      onClick={() => setFormData({ ...formData, vehicleType: type })}
                      className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                        formData.vehicleType === type
                          ? 'bg-navy-900 text-white border-navy-900 shadow-lg'
                          : 'bg-white text-navy-600 border-navy-900/10 hover:bg-navy-900/5'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Home Hub */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-navy-600 uppercase tracking-widest flex items-center gap-1">
                  <MapPin size={10} /> Home Hub Assignment
                </label>
                <select
                  value={formData.homeHub}
                  onChange={e => setFormData({ ...formData, homeHub: e.target.value })}
                  className="w-full px-4 py-3 bg-navy-900/5 rounded-xl text-sm font-bold text-navy-900 border border-transparent focus:border-navy-900/20 focus:outline-none transition-all"
                >
                  {HUB_NAMES?.map(hub => (
                    <option key={hub} value={hub}>{hub}</option>
                  ))}
                </select>
                {DRONE_HUBS[formData.homeHub] && (
                  <p className="text-[8px] text-navy-400 font-bold flex items-center gap-1">
                    📍 Lat {DRONE_HUBS[formData.homeHub].lat.toFixed(4)}, Lng {DRONE_HUBS[formData.homeHub].lng.toFixed(4)}
                  </p>
                )}
              </div>

              {/* Payload */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-navy-600 uppercase tracking-widest">Payload Capacity (KG)</label>
                <div className="flex items-center gap-4">
                  <input type="range" min="1" max="10" step="0.5"
                    value={formData.payloadCapacity}
                    onChange={e => setFormData({ ...formData, payloadCapacity: parseFloat(e.target.value) })}
                    className="flex-1 h-1.5 bg-navy-900/10 rounded-lg appearance-none cursor-pointer accent-navy-900"
                  />
                  <span className="text-lg font-sora font-black text-navy-900 min-w-[40px]">{formData.payloadCapacity}</span>
                </div>
              </div>

              {/* Operating Altitude with colour band */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-navy-600 uppercase tracking-widest flex items-center gap-1">
                  <Mountain size={10} /> Operating Altitude (m)
                </label>
                <div className="flex items-center gap-4">
                  <input type="range" min="80" max="280" step="50"
                    value={formData.operatingAltitude}
                    onChange={e => setFormData({ ...formData, operatingAltitude: parseInt(e.target.value) })}
                    className="flex-1 h-1.5 rounded-lg appearance-none cursor-pointer"
                    style={{ accentColor: altColor }}
                  />
                  <span className="text-lg font-sora font-black min-w-[50px]" style={{ color: altColor }}>
                    {formData.operatingAltitude}m
                  </span>
                </div>
                {/* Live altitude band indicator */}
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: altColor }} />
                  <p className="text-[8px] font-bold" style={{ color: altColor }}>
                    {ALT_BANDS.find(b => formData.operatingAltitude >= b.min && formData.operatingAltitude <= b.max)?.label}
                  </p>
                  <span className="text-[8px] text-navy-400 font-bold ml-auto">Trail colour on map</span>
                </div>
              </div>

              {/* Genuine battery depletion estimate */}
              <div className="p-3 rounded-xl border border-navy-900/10 bg-navy-900/[0.02] space-y-2">
                <div className="flex items-center gap-2 text-[9px] font-black text-navy-600 uppercase tracking-widest">
                  <Battery size={11} /> Battery Depletion Estimate
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 5]?.map(km => (
                    <div key={km} className="text-center p-2 rounded-lg bg-white border border-navy-900/5">
                      <p className="text-[8px] text-navy-400 font-bold">{km} km trip</p>
                      <p className="text-sm font-black text-navy-900">
                        {(parseFloat(drainPerKm) * km).toFixed(1)}%
                      </p>
                    </div>
                  ))}
                </div>
                <p className="text-[8px] text-navy-400 font-bold">
                  ~{drainPerKm}% per km at {formData.operatingAltitude}m | Based on 150W draw, 50Wh battery
                </p>
              </div>

              {feedback && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  className={`p-4 rounded-xl text-[10px] font-bold flex items-center gap-2 ${
                    feedback.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {feedback.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  {feedback.msg}
                </motion.div>
              )}

              <button type="submit" disabled={isSubmitting}
                className="w-full bg-navy-900 text-white py-4 rounded-xl text-[10px] font-black tracking-widest uppercase shadow-xl shadow-navy-900/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? 'Integrating...' : (<><Zap size={14} fill="currentColor" /> Deploy to Fleet</>)}
              </button>
            </form>
          </motion.div>

          <div className="relative z-10">
            <AltitudeLegend drones={drones} compactMode={false} />
          </div>
        </div>

        {/* ─── Fleet Table ───────────────────────────────────────────── */}
        <div className="lg:col-span-2">
          <div className="glass-card border border-navy-900/5 bg-white/50 backdrop-blur-xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-navy-900/5 flex items-center justify-between">
              <h3 className="text-sm font-black text-navy-900 uppercase tracking-widest">Active Assets Registry</h3>
              <div className="px-3 py-1 bg-navy-900/5 rounded-full text-[9px] font-bold text-navy-600">
                TOTAL: {droneList.length} READY
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-navy-900/[0.02] border-b border-navy-900/5">
                    {['Unit ID', 'Type', 'Home Hub', 'Payload', 'Altitude', 'Battery', 'Status', '']?.map(h => (
                      <th key={h} className="px-4 py-4 text-[9px] font-black uppercase tracking-widest text-navy-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/5">
                  <AnimatePresence>
                    {droneList?.map(drone => {
                      const altClr = getAltColor(drone.operatingAltitude ?? 80);
                      const battery = drone.batteryLevel ?? 100;
                      const hubName = drone.homeHub?.name ?? '—';
                      return (
                        <motion.tr key={drone.droneId}
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          className="group hover:bg-navy-900/[0.01] transition-colors"
                        >
                          {/* ID */}
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-lg text-white shadow-md group-hover:scale-110 transition-transform" style={{ background: altClr }}>
                                <Plane size={12} />
                              </div>
                              <span className="font-sora font-black text-navy-900 text-xs">{drone.droneId}</span>
                            </div>
                          </td>
                          {/* Type */}
                          <td className="px-4 py-4">
                            <span className="text-[10px] font-black uppercase text-navy-500 tracking-widest">{drone.vehicleType || 'DRONE'}</span>
                          </td>
                          {/* Home Hub */}
                          <td className="px-4 py-4">
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-700 rounded text-[10px] font-black">
                              <MapPin size={9} /> {hubName}
                            </span>
                          </td>
                          {/* Payload */}
                          <td className="px-4 py-4">
                            <span className="text-xs font-bold text-navy-900 uppercase">{drone.payloadCapacity}kg</span>
                          </td>
                          {/* Altitude */}
                          <td className="px-4 py-4">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-black text-white" style={{ background: altClr }}>
                              <Mountain size={9} /> {drone.operatingAltitude ?? 50}m
                            </span>
                          </td>
                          {/* Battery — genuine drain display */}
                          <td className="px-4 py-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-navy-900/5 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-1000 ${battery < 20 ? 'bg-rose-500' : battery < 50 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                                    style={{ width: `${battery}%` }}
                                  />
                                </div>
                                <span className={`text-[10px] font-black ${battery < 20 ? 'text-rose-600' : 'text-navy-900'}`}>{battery}%</span>
                              </div>
                              <p className="text-[8px] text-navy-400 font-bold">
                                ~{(parseFloat(estimateBatteryPerKm(drone.operatingAltitude ?? 50)) * (battery / 100) * 12).toFixed(1)}km range left
                              </p>
                            </div>
                          </td>
                          {/* Status */}
                          <td className="px-4 py-4">
                            <span className={`px-2 py-1 rounded text-[8px] font-black tracking-tighter uppercase ${
                              drone.status === 'delivering' ? 'bg-sky-500/10 text-sky-600' :
                              drone.status === 'returning'  ? 'bg-teal-500/10 text-teal-600' :
                              drone.status === 'idle'       ? 'bg-emerald-500/10 text-emerald-600' :
                              drone.status === 'grounded'   ? 'bg-rose-500/10 text-rose-600' :
                              'bg-amber-500/10 text-amber-600'
                            }`}>
                              {drone.status === 'returning' ? '🏠 RTH' : drone.status}
                            </span>
                          </td>
                          {/* Delete */}
                          <td className="px-4 py-4 text-right">
                            <button onClick={() => handleDelete(drone._id, drone.droneId)}
                              className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>

              {droneList.length === 0 && (
                <div className="py-16 text-center text-navy-400 text-sm font-bold">
                  No assets registered yet. Add your first drone above.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddFleetPage;
