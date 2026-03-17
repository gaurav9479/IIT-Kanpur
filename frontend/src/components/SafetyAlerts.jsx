import React from 'react';
import { ShieldAlert, MapPin, Zap, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const SafetyAlerts = ({ alerts }) => {
  const getAlertIcon = (type) => {
    switch (type) {
      case 'collision_critical': return <ShieldAlert className="text-white" />;
      case 'collision_warning': return <AlertTriangle className="text-white" />;
      default: return <Zap className="text-white" />;
    }
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      <h2 className="text-xl font-sora font-black text-navy-900 uppercase tracking-tighter">Safety Protocols</h2>
      
      <div className="flex-1 glass-card p-6 overflow-hidden flex flex-col border border-navy-900/5">
        <div className="flex items-center gap-3 p-3 bg-navy-900 rounded-xl mb-6 shadow-lg">
          <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
          <span className="text-[10px] font-black text-white tracking-widest uppercase">Security Engine Online</span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
          <AnimatePresence>
            {alerts.length > 0 ? (
              alerts.map((alert, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="p-4 rounded-2xl bg-white-soft border border-navy-900/10 space-y-3 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {getAlertIcon(alert.type)}
                        <span className="text-[9px] font-black uppercase tracking-widest text-navy-900">
                          {alert.type?.replace('_', ' ') || 'SYSTEM OVERRIDE'}
                        </span>
                    </div>
                    <span className="text-[9px] font-bold text-navy-600">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <p className="text-xs text-navy-800 leading-relaxed font-bold">
                    {alert.droneA && `Proximity violation between ${alert.droneA} & ${alert.droneB}. `}
                    {alert.nfzViolation && `Restricted Airspace Violation: ${alert.nfzViolation}. `}
                    {alert.emergencyLanding && `Emergency protocols active for ${alert.droneId}.`}
                  </p>

                  <div className="flex items-center gap-2 px-3 py-2 bg-navy-900 text-white rounded-lg shadow-inner">
                    <Zap size={11} fill="currentColor" />
                    <span className="text-[9px] font-black uppercase tracking-widest">
                      Resolution: {alert.action || 'Deploy Manual Guard'}
                    </span>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center opacity-10 text-center py-20 grayscale">
                <ShieldAlert size={48} className="mb-4 text-navy-900" />
                <p className="text-[10px] font-black uppercase tracking-widest text-navy-900">No compromised vectors</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="glass-card p-5 border-l-4 border-l-navy-900">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-navy-900 rounded-xl text-white shadow-lg">
            <MapPin size={20} />
          </div>
          <div>
            <p className="text-[9px] text-navy-600 font-black uppercase tracking-widest">Authority Control</p>
            <p className="text-xs font-black text-navy-900 uppercase tracking-widest">IITK CAMPUS UTM NODE</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SafetyAlerts;
