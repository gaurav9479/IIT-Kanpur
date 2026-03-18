import React from 'react';
import { motion } from 'framer-motion';
import { 
  ShieldAlert, 
  Map as MapIcon, 
  Info, 
  MapPin, 
  AlertTriangle,
  Lock,
  Plus
} from 'lucide-react';

const SafetyZones = () => {
  const zones = [
    { id: 'NFZ-01', name: 'Main Gate Security Zone', status: 'CRITICAL', coordinates: '26.5123, 80.2329', radius: '50m' },
    { id: 'NFZ-02', name: 'Experimental Biology Roof', status: 'WARNING', coordinates: '26.5140, 80.2310', radius: '30m' },
    { id: 'NFZ-03', name: 'Student Residential Block', status: 'RESTRICTED', coordinates: '26.5100, 80.2300', radius: '100m' }
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 custom-scrollbar">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-sora font-black text-navy-900 tracking-tighter uppercase mb-2">
            Safety <span className="text-rose-500">Zones</span>
          </h1>
          <p className="text-navy-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
            <Lock size={10} className="text-rose-500" />
            Active No-Fly Zone (NFZ) Protocols | Geofence Intelligence
          </p>
        </div>
        
        <button className="bg-rose-500 text-white px-8 py-3 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20 flex items-center gap-2">
          <Plus size={16} /> Add Restriction
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* NFZ List */}
        <div className="lg:col-span-1 space-y-4">
          {zones.map((zone, i) => (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              key={zone.id}
              className="glass-card p-6 border border-navy-900/5 hover:border-rose-500/20 transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-2 rounded-lg ${
                  zone.status === 'CRITICAL' ? 'bg-rose-500 text-white' : 
                  zone.status === 'WARNING' ? 'bg-amber-500 text-white' : 'bg-navy-900 text-white'
                }`}>
                  <ShieldAlert size={18} />
                </div>
                <span className={`text-[9px] font-black uppercase tracking-widest ${
                   zone.status === 'CRITICAL' ? 'text-rose-600' : 
                   zone.status === 'WARNING' ? 'text-amber-600' : 'text-navy-600'
                }`}>
                  {zone.status}
                </span>
              </div>
              
              <h3 className="font-sora font-black text-sm text-navy-900 uppercase tracking-tight mb-2 italic">
                {zone.name}
              </h3>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[10px] font-black text-navy-500 uppercase tracking-widest">
                  <MapPin size={12} /> {zone.coordinates}
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black text-navy-500 uppercase tracking-widest">
                  <MapIcon size={12} /> {zone.radius} Impact Radius
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-navy-900/5 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                 <button className="text-[10px] font-black uppercase text-navy-400 hover:text-navy-900">Deactivate</button>
                 <button className="text-[10px] font-black uppercase text-rose-500 hover:underline">Edit Geometry</button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Mock Map Detail View */}
        <div className="lg:col-span-2 glass-card p-8 border border-navy-900/10 min-h-[500px] flex flex-col relative overflow-hidden bg-navy-900/5">
           <div className="relative z-10">
              <h3 className="font-sora font-black text-sm uppercase tracking-tight text-navy-900 mb-2">Live Grid Visualization</h3>
              <p className="text-[10px] font-black text-navy-500 uppercase tracking-widest">Overlay: Safety Constraints v2.4</p>
           </div>
           
           <div className="flex-1 flex items-center justify-center">
              <div className="relative">
                 {/* Mock UI for Map Overlays */}
                 <div className="w-96 h-96 border-2 border-navy-900/10 rounded-full flex items-center justify-center animate-[spin_20s_linear_infinite]">
                    <div className="w-64 h-64 border-2 border-dashed border-navy-900/20 rounded-full"></div>
                 </div>
                 <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-4 h-4 bg-navy-900 rounded-full animate-ping"></div>
                    <div className="w-16 h-16 bg-rose-500/20 border-2 border-rose-500 rounded-full animate-pulse"></div>
                 </div>
                 
                 {/* Legend */}
                 <div className="absolute -bottom-8 -right-8 glass-card p-4 text-[9px] font-black uppercase tracking-widest space-y-2">
                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-rose-500"></div> No-Fly (Active)</div>
                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-500"></div> Congestion</div>
                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-navy-900 opacity-20"></div> Static Obstacle</div>
                 </div>
              </div>
           </div>

           {/* AI Insight Box */}
           <div className="mt-auto bg-navy-900 text-white p-6 rounded-2xl shadow-2xl relative overflow-hidden group">
              <div className="flex items-start gap-4">
                 <div className="p-2 bg-white/10 rounded-lg">
                    <AlertTriangle size={20} className="text-amber-400" />
                 </div>
                 <div>
                    <h4 className="font-black text-xs uppercase tracking-widest mb-1">System Risk Assessment</h4>
                    <p className="text-[10px] font-semibold text-white/70 leading-relaxed">
                       Current NFZ config reduces viable lanes by 15.2%. Auto-routing has been adjusted to maintain 99% safety protocol compliance.
                    </p>
                 </div>
              </div>
              <div className="absolute -right-4 -bottom-4 text-white/5 group-hover:rotate-12 transition-transform">
                 <ShieldAlert size={80} />
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default SafetyZones;
