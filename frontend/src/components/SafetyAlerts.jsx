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
            {alerts && alerts.length > 0 ? (
              alerts.map((alert, idx) => {
                const isNfz = alert.nfzViolation;
                const isEmergency = !!alert.emergencyLanding;
                const isProximity = alert.proximityAlerts && alert.proximityAlerts.length > 0;
                let bgClass = 'bg-white-soft border-navy-900/10 hover:shadow-md text-navy-900';
                let iconColor = 'text-navy-900';
                
                if (isNfz || isEmergency) {
                   bgClass = 'bg-rose-50 border-rose-200 text-rose-800';
                   iconColor = 'text-rose-600';
                } else if (isProximity) {
                   bgClass = 'bg-orange-50 border-orange-200 text-orange-800';
                   iconColor = 'text-orange-600';
                }

                return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={`p-4 rounded-2xl border space-y-3 shadow-sm transition-shadow ${bgClass}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {isNfz || isEmergency ? <ShieldAlert className={iconColor} size={16} /> : isProximity ? <AlertTriangle className={iconColor} size={16} /> : <Zap className={iconColor} size={16} />}
                        <span className={`text-[9px] font-black uppercase tracking-widest ${iconColor}`}>
                          {alert.type?.replace('_', ' ') || (isNfz ? 'RESTRICTED AIRSPACE' : isEmergency ? 'EMERGENCY PROTOCOL' : isProximity ? 'COLLISION RISK' : 'SYSTEM OVERRIDE')}
                        </span>
                    </div>
                    <span className="text-[9px] font-bold opacity-70">
                      {new Date(alert.timestamp || Date.now()).toLocaleTimeString()}
                    </span>
                  </div>

                  <p className="text-xs leading-relaxed font-bold">
                    {isProximity && `Collision Risk: Drone ${alert.droneId}. `}
                    {isNfz && `Drone ${alert.droneId} entered No-Fly Zone. `}
                    {isEmergency && `Emergency Landing: ${alert.droneId} at ${alert.emergencyLanding.lat.toFixed(4)}, ${alert.emergencyLanding.lng.toFixed(4)}.`}
                    {!isProximity && !isNfz && !isEmergency && `Security alert for Drone ${alert.droneId}.`}
                  </p>

                  <div className="flex items-center gap-2 px-3 py-2 bg-navy-900 text-white rounded-lg shadow-inner">
                    <Zap size={11} fill="currentColor" />
                    <span className="text-[9px] font-black uppercase tracking-widest">
                      Resolution: {alert.action || 'Deploy Manual Guard'}
                    </span>
                  </div>
                </motion.div>
              )})
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center py-20 grayscale-0">
                <ShieldAlert size={48} className="mb-4 text-green-500" />
                <p className="text-[10px] font-black uppercase tracking-widest text-green-600">No active alerts</p>
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
