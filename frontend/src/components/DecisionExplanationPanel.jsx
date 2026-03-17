import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Zap, Map as MapIcon, ShieldAlert, Cpu, ArrowRight } from 'lucide-react';
import { io } from 'socket.io-client';

/**
 * DecisionExplanationPanel Component
 * Provides real-time "Explainable AI" insights into system logic.
 * Listens for 'decision_update' from backend.
 */
const DecisionExplanationPanel = ({ initialData = null }) => {
  const [decision, setDecision] = useState(initialData || {
    drone: "---",
    reason: "Awaiting mission parameters...",
    conflict: "None detected",
    action: "System Standby"
  });

  useEffect(() => {
    const socket = io('http://localhost:5001');

    socket.on('decision_update', (data) => {
      setDecision(data);
    });

    return () => socket.disconnect();
  }, []);

  return (
    <div className="glass-card p-6 border border-navy-900/10 shadow-2xl bg-white/90 backdrop-blur-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-navy-900 rounded-xl shadow-lg shadow-navy-900/20">
            <Brain className="text-white" size={20} />
          </div>
          <div>
            <h3 className="text-navy-900 font-sora font-black text-sm tracking-tight uppercase">Decision Intelligence</h3>
            <p className="text-navy-600 text-[9px] font-black uppercase tracking-widest mt-0.5 opacity-70">Real-time Rationalization Logic</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-navy-900/5 rounded-full border border-navy-900/10">
           <Cpu size={12} className="text-navy-900 animate-pulse" />
           <span className="text-navy-900 text-[9px] font-black uppercase tracking-wider">Active Engine</span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={decision.drone + decision.action}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.4, ease: "circOut" }}
          className="space-y-5"
        >
          {/* Section 1: Drone Selection */}
          <div className="group relative">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-1.5 bg-sky-500/10 rounded-lg group-hover:bg-sky-500/20 transition-colors">
                <Zap className="text-sky-600" size={14} />
              </div>
              <h4 className="text-navy-600 text-[10px] font-black uppercase tracking-widest">Fleet Selection Engine</h4>
            </div>
            <div className="pl-9">
              <p className="text-xs font-medium text-navy-800 leading-relaxed">
                Unit <span className="font-black text-navy-900 bg-sky-500/10 px-1.5 py-0.5 rounded italic">{decision.drone}</span> identified as optimal candidate.
              </p>
              <p className="text-[11px] text-navy-600 mt-1 font-semibold italic">
                Reasoning: {decision.reason}
              </p>
            </div>
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-navy-900/10 to-transparent"></div>

          {/* Section 2: Path Planning */}
          <div className="group relative">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-1.5 bg-purple-500/10 rounded-lg group-hover:bg-purple-500/20 transition-colors">
                <MapIcon className="text-purple-600" size={14} />
              </div>
              <h4 className="text-navy-600 text-[10px] font-black uppercase tracking-widest">Trajectory Rationalization</h4>
            </div>
            <div className="pl-9">
              <p className="text-xs font-medium text-navy-800 leading-relaxed">
                Computed <span className="text-purple-700 font-black">A* 3D Trajectory</span> bypassing all known constraints.
              </p>
              <div className="flex items-center gap-2 mt-2">
                 <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
                 <span className="text-[10px] text-navy-600 font-bold uppercase tracking-tight">Status: Path Validated / Verified</span>
              </div>
            </div>
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-navy-900/10 to-transparent"></div>

          {/* Section 3: Conflict Resolution */}
          <div className="group relative">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-1.5 bg-rose-500/10 rounded-lg group-hover:bg-rose-500/20 transition-colors">
                <ShieldAlert className="text-rose-600" size={14} />
              </div>
              <h4 className="text-navy-600 text-[10px] font-black uppercase tracking-widest">Conflict Resolution Protocol</h4>
            </div>
            <div className="pl-9">
              <div className="flex items-start gap-4">
                 <div className="flex-1">
                    <p className="text-[11px] font-bold text-navy-700 uppercase tracking-tighter opacity-60">Status Check</p>
                    <p className="text-xs font-black text-navy-900 mt-0.5">{decision.conflict}</p>
                 </div>
                 <div className="flex-1">
                    <p className="text-[11px] font-bold text-navy-700 uppercase tracking-tighter opacity-60">Mitigation Action</p>
                    <p className="text-xs font-black text-navy-900 mt-0.5 flex items-center gap-1.5">
                       <ArrowRight size={10} className="text-rose-500" /> {decision.action}
                    </p>
                 </div>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default DecisionExplanationPanel;
