import React from 'react';
import { Battery, Navigation, Wind, ShieldAlert, Cpu, Plane } from 'lucide-react';

const DroneCard = ({ drone }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'delivering': return 'text-emerald-400 bg-emerald-400/10 border-emerald-500/20';
      case 'avoidance': return 'text-amber-400 bg-amber-400/10 border-amber-500/20';
      case 'charging': return 'text-sky-400 bg-sky-400/10 border-sky-500/20';
      default: return 'text-slate-400 bg-slate-400/10 border-slate-500/20';
    }
  };

  return (
    <div className="glass-card overflow-hidden group hover:shadow-2xl transition-all duration-500 border border-navy-900/5">
      <div className="p-5 border-b border-navy-900/5 flex items-center justify-between bg-navy-900">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white/10 rounded-xl group-hover:bg-white transition-all duration-500">
            <Cpu size={20} className="text-white group-hover:text-navy-900" />
          </div>
          <div>
            <h3 className="text-white font-black tracking-tight uppercase text-xs">{drone.droneId}</h3>
            <span className={`text-[9px] uppercase tracking-widest font-black px-2 py-0.5 rounded-full border mt-1 inline-block ${getStatusColor(drone.status)}`}>
              {drone.status || 'OFFLINE'}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[9px] text-white/50 font-black uppercase tracking-tighter">Fleet Unit</p>
          <p className="text-xs font-black text-white">IITK-DR-01</p>
        </div>
      </div>

      <div className="p-5 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-navy-600 text-[9px] font-black uppercase tracking-widest">
              <Battery size={13} strokeWidth={3} /> <span>Battery</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-white-muted rounded-full overflow-hidden shadow-inner">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ${drone.batteryLevel < 20 ? 'bg-red-600' : 'bg-navy-900'}`}
                  style={{ width: `${drone.batteryLevel}%` }}
                />
              </div>
              <span className={`text-xs font-black ${drone.batteryLevel < 20 ? 'text-red-700' : 'text-navy-900'}`}>
                {drone.batteryLevel}%
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-navy-600 text-[9px] font-black uppercase tracking-widest">
              <Navigation size={13} strokeWidth={3} /> <span>Altitude</span>
            </div>
            <p className="text-sm font-black text-navy-900 tracking-widest">
              {drone.altitude || 0}m <span className="text-[9px] font-bold text-navy-600 ml-1">AGL</span>
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between p-3.5 bg-white-soft rounded-xl border border-navy-900/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-navy-900 rounded-lg text-white">
              <Wind size={16} />
            </div>
            <div>
              <p className="text-[9px] text-navy-600 font-bold uppercase tracking-widest">Velocity</p>
              <p className="text-xs font-black text-navy-900">{(drone.speed || 0).toFixed(1)} km/h</p>
            </div>
          </div>
          {drone.safety?.nfzViolation && (
            <div className="flex items-center gap-1.5 text-red-600 animate-bounce">
              <ShieldAlert size={16} />
              <span className="text-[9px] font-black tracking-tighter">NFZ ALARM</span>
            </div>
          )}
        </div>
      </div>

      <div className="px-5 pb-5">
        <button className="w-full py-2.5 bg-navy-900 text-white hover:bg-navy-800 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl active:scale-95">
          System Override Active
        </button>
      </div>
    </div>
  );
};

const DroneGrid = ({ drones }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-sora font-bold text-white flex items-center gap-3">
          Live Fleet Monitor
          <span className="px-2.5 py-0.5 bg-sky-500/20 text-sky-400 text-xs rounded-lg border border-sky-500/30">
            {drones.length} Running
          </span>
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {drones.map((drone) => (
          <DroneCard key={drone.droneId} drone={drone} />
        ))}
        {drones.length === 0 && (
          <div className="col-span-full py-20 glass-card flex flex-col items-center justify-center text-slate-500 border-dashed">
            <Plane className="opacity-20 mb-4" size={48} />
            <p className="font-medium">Waiting for mission telemetry...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DroneGrid;
