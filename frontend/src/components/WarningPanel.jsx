import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Clock, MapPin, X, ArrowRight } from 'lucide-react';
import { io } from "socket.io-client";
import { SOCKET_URL } from "../config/mapConfig";

const WarningPanel = () => {
  const [warnings, setWarnings] = useState([]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ["polling", "websocket"],
      reconnection: true,
    });
    
    socket.emit("join_admin");

    socket.on("predictive_warning", (warning) => {
      setWarnings((prev) => {
        // Prevent duplicate warnings for the same pair
        const pairKey = [warning.drone1, warning.drone2].sort().join('-');
        const existing = prev.find(w => [w.drone1, w.drone2].sort().join('-') === pairKey);
        if (existing) {
          return prev.map(w => w === existing ? { ...warning, id: existing.id } : w);
        }
        return [...prev, { ...warning, id: Date.now() + Math.random() }];
      });
    });

    // Cleanup warnings after 20 seconds
    const interval = setInterval(() => {
      setWarnings((prev) => prev.filter(w => Date.now() - w.timestamp < 20000));
    }, 1000);

    return () => {
      socket.off("predictive_warning");
      socket.disconnect();
      clearInterval(interval);
    };
  }, []);

  const getSeverityStyles = (type) => {
    switch (type) {
      case 'CRITICAL': return { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', icon: 'text-red-500' };
      case 'MODERATE': return { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', icon: 'text-orange-500' };
      default:         return { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', icon: 'text-yellow-500' };
    }
  };

  if (warnings.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-navy-900 font-sora font-bold text-sm tracking-tight uppercase flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-500 animate-pulse" />
          Predictive Warnings
        </h3>
        <span className="text-[10px] font-black bg-navy-900 text-white px-2 py-0.5 rounded-full">
          {warnings.length}
        </span>
      </div>
      
      <div className="space-y-3">
        <AnimatePresence>
          {warnings.map((warning) => {
            const styles = getSeverityStyles(warning.type);
            return (
              <motion.div
                key={warning.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className={`p-4 rounded-2xl border ${styles.bg} ${styles.border} shadow-sm backdrop-blur-md`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${styles.text}`}>
                    <AlertTriangle size={12} className={styles.icon} />
                    {warning.type} RISK
                  </div>
                  <div className="flex items-center gap-1.5 bg-white/50 px-2 py-1 rounded-lg">
                    <Clock size={12} className="text-navy-600" />
                    <span className="text-[10px] font-bold text-navy-900">
                      T - {warning.timeToConflict}s
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-white/40 p-2 rounded-xl mb-3">
                  <span className="text-xs font-bold text-navy-900">{warning.drone1}</span>
                  <ArrowRight size={14} className="text-navy-400" />
                  <span className="text-xs font-bold text-navy-900">{warning.drone2}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[10px] font-medium text-navy-600">
                    <MapPin size={12} />
                    {warning.conflictPoint.lat.toFixed(4)}, {warning.conflictPoint.lng.toFixed(4)}
                  </div>
                  <div className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${styles.bg} ${styles.text}`}>
                    Action: {warning.resolutionAction}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default WarningPanel;
