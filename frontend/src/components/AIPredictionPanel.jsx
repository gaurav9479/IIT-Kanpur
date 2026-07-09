import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, AlertTriangle, Zap, Activity, Navigation, Wind,
  Thermometer, Layers, Clock, Cpu, BatteryCharging, ChevronRight,
  ShieldCheck, ArrowRight, ServerCrash, RefreshCw
} from 'lucide-react';
import { useAIPredictions } from '../hooks/useAIPredictions';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell
} from 'recharts';
import { useSocket } from '../hooks/useSocket';

// ── Components ─────────────────────────────────────────────────────────────

export default function AIPredictionPanel() {
  const { lanes, aiOnline, aiHealth, laneLoading, lastUpdated, fetchLaneStatus, predictCongestion, predictETA, predictBattery } = useAIPredictions();
  const { drones } = useSocket();

  // Prediction Form State
  const [formParams, setFormParams] = useState({
    lane_id: 1,
    num_drones: 2,
    wind_speed: 10,
    hour: new Date().getHours(),
    payload_kg: 2.0,
    distance_km: 1.5,
    temperature: 28.0,
    visibility_km: 8.0,
    battery_level: 75.0,
  });

  const [predictLoading, setPredictLoading] = useState(false);
  const [predictionResult, setPredictionResult] = useState(null);
  
  const [etaResult, setEtaResult] = useState(null);
  const [etaLoading, setEtaLoading] = useState(false);

  // Stats
  const highCongestedCount = lanes.filter(l => l.congestion_level === 'high').length;
  
  const handleCongestionPredict = async () => {
    setPredictLoading(true);
    try {
      const res = await predictCongestion(formParams);
      setPredictionResult(res);
    } catch (error) {
      console.error(error);
    } finally {
      setPredictLoading(false);
    }
  };

  const handleSyncScenario = () => {
    const activeDrones = Object.values(drones).filter(d => 
      d.status === 'delivering' || d.status === 'active' || d.status === 'returning'
    );
    const numDrones = activeDrones.length;
    const avgBattery = activeDrones.length > 0 
      ? activeDrones.reduce((sum, d) => sum + (d.battery || d.batteryLevel || 100), 0) / activeDrones.length 
      : 100;
    
    setFormParams(prev => ({
      ...prev,
      num_drones: numDrones,
      battery_level: Math.round(avgBattery),
      hour: new Date().getHours()
    }));
  };

  const handleETAPredict = async () => {
    setEtaLoading(true);
    try {
      const p = {
        distance: formParams.distance_km,
        windSpeed: formParams.wind_speed,
        payload: formParams.payload_kg,
        numDrones: formParams.num_drones,
        temperature: formParams.temperature,
        visibility: formParams.visibility_km,
        batteryLevel: formParams.battery_level
      };
      
      const [etaRes, batRes] = await Promise.all([
        predictETA(p), predictBattery(p)
      ]);
      
      setEtaResult({ ...etaRes, ...batRes });
    } catch (error) {
      console.error(error);
    } finally {
      setEtaLoading(false);
    }
  };

  const modelImportance = [
    { name: 'is_peak_hour', value: 31 },
    { name: 'num_drones', value: 25 },
    { name: 'hour', value: 7 },
    { name: 'wind_speed', value: 5 },
    { name: 'payload_kg', value: 4 },
    { name: 'visibility_km', value: 4 },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6" style={{ background: '#050a0e' }}>
      
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#0a1628] rounded-xl border border-[#00ff8844]">
            <Brain className="text-[#00ff88]" size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-widest text-[#00ff88]" style={{ fontFamily: 'Orbitron, monospace' }}>
              AI Intelligence Center
            </h1>
            <p className="text-[#00ff8888] font-mono text-sm uppercase tracking-wider">
              RandomForest Prediction Models (Congestion, ETA, Battery)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-[#0a1628] rounded-lg border border-[#1e2a45]">
            <ServerCrash size={14} className={aiOnline ? "text-emerald-400" : "text-red-400"} />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Model Endpoint: <span className={aiOnline ? "text-emerald-400" : "text-red-400"}>{aiOnline ? 'ONLINE' : 'OFFLINE'}</span>
            </span>
          </div>
          <button 
            onClick={fetchLaneStatus}
            disabled={laneLoading}
            className="flex items-center gap-2 px-4 py-2 bg-[#00ff8822] text-[#00ff88] rounded-lg font-bold text-[10px] uppercase tracking-widest hover:bg-[#00ff8844] transition-all border border-[#00ff8844]"
          >
            <RefreshCw size={14} className={laneLoading ? "animate-spin" : ""} />
            Sync Status
          </button>
        </div>
      </div>

      {/* ── Top Metrics ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard label="Active Model Status" value={aiOnline ? "HEALTHY" : "DOWN"} icon={<Activity />} color={aiOnline ? "#00ff88" : "#ff3333"} />
        <MetricCard label="High Congestion Lanes" value={highCongestedCount} icon={<Layers />} color={highCongestedCount > 0 ? "#ff3333" : "#00ff88"} />
        <MetricCard label="Congestion Model Accuracy" value="~94%" icon={<ShieldCheck />} color="#00ff88" />
        <MetricCard label="ETA Model R² Score" value="0.92" icon={<Clock />} color="#00ff88" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* ── Left Column: Live Traffic AI ── */}
        <div className="space-y-6">
          <div className="bg-[#0a1628] rounded-xl border border-[#00ff8833] p-5">
            <h3 className="text-[#00ff88] font-bold uppercase tracking-widest mb-4 flex items-center gap-2 text-sm font-mono">
              <Layers size={16} /> Live Lane Predictions
            </h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {lanes.map((lane) => {
                const isHigh = lane.congestion_level === 'high';
                const isMed = lane.congestion_level === 'medium';
                const color = isHigh ? '#ff3333' : isMed ? '#ffaa00' : '#00ff88';
                
                return (
                  <div key={lane.lane_id} className="flex items-center justify-between p-3 rounded-lg bg-[#050a0e] border" style={{ borderColor: `${color}44` }}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded border flex items-center justify-center font-black font-mono text-xs" style={{ borderColor: color, color, background: `${color}11` }}>
                        L{lane.lane_id}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-200">Alt: {lane.altitude}m {lane.direction}</div>
                        <div className="text-[10px] text-gray-400 font-mono tracking-widest">{lane.num_drones}/5 DRONES ACTV</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black uppercase font-mono tracking-widest" style={{ color }}>
                        {lane.congestion_level}
                      </div>
                      <div className="text-[10px] text-gray-500 font-mono">CONF: {(lane.confidence * 100).toFixed(0)}%</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-[#0a1628] rounded-xl border border-[#00ff8833] p-5">
            <h3 className="text-[#00ff88] font-bold uppercase tracking-widest mb-4 flex items-center gap-2 text-sm font-mono">
              <Cpu size={16} /> Feature Importance (XGBoost)
            </h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={modelImportance} layout="vertical" margin={{ top: 0, right: 0, left: 40, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2a45" horizontal={false} />
                  <XAxis type="number" stroke="#475569" fontSize={10} tickFormatter={v => `${v}%`} />
                  <YAxis dataKey="name" type="category" stroke="#fff" fontSize={10} width={90} />
                  <RechartsTooltip cursor={{ fill: '#1e2a45' }} contentStyle={{ backgroundColor: '#0a1628', border: '1px solid #1e2a45', borderRadius: '8px' }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {modelImportance.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index < 2 ? '#ff3333' : index < 4 ? '#ffaa00' : '#00ff88'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── Right Column: AI Sim & Diagnostics ── */}
        <div className="space-y-6">
          
          <div className="bg-[#0a1628] rounded-xl border border-[#00ff8833] overflow-hidden">
            <div className="p-4 border-b border-[#1e2a45] bg-[#050a0e] flex items-center justify-between">
              <h3 className="text-[#00ff88] font-bold uppercase tracking-widest flex items-center gap-2 text-sm font-mono">
                <Navigation size={16} /> Predict Mode: Test Drone Logistics
              </h3>
              <button 
                onClick={handleSyncScenario}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00ff8822] text-[#00ff88] rounded border border-[#00ff8844] font-bold text-[9px] uppercase tracking-widest hover:bg-[#00ff8844] transition-all"
              >
                <RefreshCw size={12} /> Sync Live Scenario
              </button>
            </div>
            
            <div className="p-5 grid grid-cols-2 gap-4 border-b border-[#1e2a45]">
              <label className="block">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Target Lane (1-10)</span>
                <input type="number" min="1" max="10" value={formParams.lane_id} onChange={e => setFormParams({...formParams, lane_id: Number(e.target.value)})} className="w-full bg-[#050a0e] border border-[#1e2a45] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#00ff88]" />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Active Drones</span>
                <input type="number" min="0" max="5" value={formParams.num_drones} onChange={e => setFormParams({...formParams, num_drones: Number(e.target.value)})} className="w-full bg-[#050a0e] border border-[#1e2a45] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#00ff88]" />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Wind (km/h)</span>
                <input type="number" value={formParams.wind_speed} onChange={e => setFormParams({...formParams, wind_speed: Number(e.target.value)})} className="w-full bg-[#050a0e] border border-[#1e2a45] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#00ff88]" />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Hour of Day (0-23)</span>
                <input type="number" value={formParams.hour} onChange={e => setFormParams({...formParams, hour: Number(e.target.value)})} className="w-full bg-[#050a0e] border border-[#1e2a45] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#00ff88]" />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Distance (km)</span>
                <input type="number" step="0.1" value={formParams.distance_km} onChange={e => setFormParams({...formParams, distance_km: Number(e.target.value)})} className="w-full bg-[#050a0e] border border-[#1e2a45] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#00ff88]" />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Payload (kg)</span>
                <input type="number" step="0.1" value={formParams.payload_kg} onChange={e => setFormParams({...formParams, payload_kg: Number(e.target.value)})} className="w-full bg-[#050a0e] border border-[#1e2a45] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#00ff88]" />
              </label>
            </div>
            
            <div className="p-4 flex gap-3">
              <button onClick={handleCongestionPredict} disabled={predictLoading || !aiOnline} className="flex-1 bg-gradient-to-r from-[#00ff88] to-[#00cc66] text-black font-bold uppercase tracking-widest text-[10px] py-3 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity">
                {predictLoading ? 'Analyzing...' : 'Predict Lane Congestion'}
              </button>
              <button onClick={handleETAPredict} disabled={etaLoading || !aiOnline} className="flex-1 bg-gradient-to-r from-sky-400 to-blue-600 text-white font-bold uppercase tracking-widest text-[10px] py-3 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity">
                {etaLoading ? 'Analyzing...' : 'Predict ETA & Battery'}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {predictionResult && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-5 rounded-xl border border-[#1e2a45] bg-[#050a0e]">
                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Route Congestion Result</h4>
                <div className="flex items-center gap-4">
                  <div className={`p-4 rounded-full border-2 ${predictionResult.congestionLevel === 'high' ? 'border-red-500 text-red-500 bg-red-500/10' : predictionResult.congestionLevel === 'medium' ? 'border-yellow-500 text-yellow-500 bg-yellow-500/10' : 'border-emerald-500 text-emerald-500 bg-emerald-500/10'}`}>
                    <AlertTriangle size={24} />
                  </div>
                  <div>
                    <div className="text-xl font-black font-mono tracking-wider uppercase" style={{ color: predictionResult.congestionLevel === 'high' ? '#ef4444' : predictionResult.congestionLevel === 'medium' ? '#eab308' : '#10b981' }}>
                      {predictionResult.congestionLevel} RISK
                    </div>
                    <div className="text-xs text-gray-500 mt-1 uppercase font-mono">
                      Model Confidence: {(predictionResult.confidence * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
                
                {predictionResult.congestionLevel === 'high' && (
                  <div className="mt-4 p-3 bg-red-950/40 border border-red-900/50 rounded-lg text-red-400 text-xs font-mono uppercase tracking-widest">
                    🚨 ACTION: Reroute to adjacent lane or delay dispatch.
                  </div>
                )}
              </motion.div>
            )}
            
            {etaResult && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-5 rounded-xl border border-[#1e2a45] bg-[#050a0e]">
                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Flight Logistics Estimation</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-[#0a1628] rounded-xl border border-[#1e2a45]">
                    <div className="flex justify-between items-start mb-2">
                      <Clock size={16} className="text-sky-400" />
                      <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">ETA Model</span>
                    </div>
                    <div className="text-2xl font-black text-white font-mono">{etaResult.etaMinutes} <span className="text-sm text-gray-500">MIN</span></div>
                    <div className="text-xs text-gray-400 mt-1 font-mono">Arr: {etaResult.estimatedArrival}</div>
                  </div>
                  
                  <div className="p-4 bg-[#0a1628] rounded-xl border border-[#1e2a45]">
                    <div className="flex justify-between items-start mb-2">
                      <Zap size={16} className="text-yellow-400" />
                      <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Battery Model</span>
                    </div>
                    <div className="text-2xl font-black text-white font-mono">{(etaResult.batteryUsed || 0).toFixed(1)}<span className="text-sm text-gray-500">%</span></div>
                    <div className="text-xs text-gray-400 mt-1 font-mono flex items-center justify-between">
                      <span>RMN: {etaResult.batteryAfter}%</span>
                      {etaResult.safeToFly ? <span className="text-emerald-400">SAFE</span> : <span className="text-red-400">UNSAFE</span>}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon, color }) {
  return (
    <div className="bg-gradient-to-br from-[#0a1628] to-[#0d2137] border border-[#00ff8844] rounded-xl p-4 relative overflow-hidden">
      <div className="flex justify-between items-start z-10 relative">
        <div>
          <div className="text-[10px] font-mono font-bold text-[#00ff88] uppercase tracking-widest mb-2">{label}</div>
          <div className="text-2xl font-bold text-white font-mono">{value}</div>
        </div>
        <div style={{ color }}>{icon}</div>
      </div>
      <div className="absolute -right-4 -bottom-4 opacity-10" style={{ color }}>
        <Brain size={80} />
      </div>
    </div>
  );
}
