import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plane, 
  Battery, 
  Activity, 
  MapPin, 
  AlertTriangle, 
  CheckCircle2, 
  Search,
  Cpu,
  Navigation,
  Settings
} from 'lucide-react';
import { useSocket } from '../hooks/useSocket';
import axios from 'axios';
import { API_URL } from '../config/mapConfig';

const FleetManagement = () => {
  const navigate = useNavigate();
  const { drones, connected } = useSocket();
  const droneList = useMemo(() => Object.values(drones), [drones]);

  const stats = useMemo(() => {
    return {
      total: droneList.length,
      active: droneList.filter(d => d.status === 'delivering').length,
      idle: droneList.filter(d => d.status === 'idle').length,
      grounded: droneList.filter(d => d.status === 'grounded').length,
      lowBattery: droneList.filter(d => d.batteryLevel < 25).length
    };
  }, [droneList]);

  const handleRecharge = async (id) => {
    try {
      await axios.patch(`${API_URL}/drones/${id}/status`, {
        status: 'idle',
        batteryLevel: 100
      });
      // The socket update will handle state refresh
    } catch (err) {
      console.error("Recharge failed:", err);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 custom-scrollbar">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-sora font-black text-navy-900 tracking-tighter uppercase mb-2">
            Fleet <span className="text-navy-400">Management</span>
          </h1>
          <p className="text-navy-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
            <Activity size={10} className="text-sky-500 animate-pulse" />
            Real-time Autonomous Asset Monitoring | {stats.total} Active Units
          </p>
        </div>
        
        <div className="flex bg-white p-2 rounded-2xl shadow-xl border border-navy-900/5 items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" size={14} />
            <input 
              type="text" 
              placeholder="SEARCH UNIT ID..." 
              className="pl-9 pr-4 py-2 bg-navy-900/5 rounded-xl text-[10px] font-black tracking-widest uppercase focus:outline-none focus:ring-2 ring-navy-900/10 w-48 transition-all"
            />
          </div>
          <button 
            onClick={() => navigate('/add-fleet')}
            className="bg-navy-900 text-white px-6 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase shadow-lg shadow-navy-900/20 active:scale-95 transition-all"
          >
            Add Asset
          </button>
        </div>
      </div>

      {/* Stats Quick Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Fleet', value: stats.total, color: 'navy' },
          { label: 'In-Flight', value: stats.active, color: 'sky' },
          { label: 'Ready/Idle', value: stats.idle, color: 'emerald' },
          { label: 'Grounded', value: stats.grounded, color: 'rose' }
        ].map((stat, i) => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={i}
            className="glass-card p-6 border-b-4 border-b-navy-900/10"
          >
            <p className="text-[10px] font-black uppercase tracking-widest text-navy-500 mb-1">{stat.label}</p>
            <p className="text-3xl font-sora font-black text-navy-900 italic tracking-tighter">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Drones Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
        <AnimatePresence>
          {droneList.map((drone) => (
            <motion.div
              layout
              key={drone.droneId}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="glass-card relative overflow-hidden group border border-navy-900/5 hover:border-navy-900/20 transition-all duration-500"
            >
              {/* Status Indicator Bar */}
              <div className={`absolute top-0 left-0 right-0 h-1 ${
                drone.status === 'delivering' ? 'bg-sky-500' :
                drone.status === 'grounded' ? 'bg-red-600' :
                drone.status === 'maintenance' ? 'bg-amber-500' : 'bg-emerald-500'
              }`} />

              <div className="p-6">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-navy-900 text-white rounded-2xl shadow-xl shadow-navy-900/20 group-hover:rotate-12 transition-transform duration-500">
                      <Plane size={24} />
                    </div>
                    <div>
                      <h3 className="font-sora font-black text-lg tracking-tighter text-navy-900 italic italic">
                        {drone.droneId}
                      </h3>
                      <p className="text-[10px] font-black uppercase text-navy-500 tracking-widest">{drone.type || 'QUADCOPTER'}</p>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                    drone.status === 'delivering' ? 'bg-sky-500/10 text-sky-600' :
                    drone.status === 'idle' ? 'bg-emerald-500/10 text-emerald-600' : 
                    drone.status === 'grounded' ? 'bg-red-600/10 text-red-600' :
                    'bg-amber-500/10 text-amber-600'
                  }`}>
                    {drone.status === 'delivering' ? 'ONLINE' : drone.status === 'idle' ? 'STANDBY' : drone.status === 'grounded' ? 'GROUNDED' : drone.status}
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Battery Section */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                      <div className="flex items-center gap-1.5 text-navy-600">
                        <Battery size={14} className={drone.batteryLevel < 25 ? 'text-rose-500 animate-pulse' : 'text-emerald-500'} />
                        <span>Battery Reserve</span>
                      </div>
                      <span className={drone.batteryLevel < 25 ? 'text-rose-600' : 'text-navy-900'}>{drone.batteryLevel}%</span>
                    </div>
                    <div className="h-1.5 bg-navy-900/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${drone.batteryLevel}%` }}
                        className={`h-full ${
                          drone.batteryLevel < 25 ? 'bg-rose-500' : 
                          drone.batteryLevel < 60 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Meta Stats */}
                  <div className="grid grid-cols-2 gap-4 py-4 border-y border-navy-900/5">
                    <div>
                      <p className="text-[9px] font-black uppercase text-navy-400 mb-0.5">Capacity</p>
                      <p className="text-xs font-black text-navy-900 italic">{drone.payloadCapacity}KG MAX</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black uppercase text-navy-400 mb-0.5">Latency</p>
                      <p className="text-xs font-black text-navy-900 italic">22MS RT</p>
                    </div>
                  </div>

                  {/* Telemetry/Action */}
                  <div className="flex items-center justify-between gap-3 pt-2">
                    {drone.status === 'grounded' ? (
                      <button 
                        onClick={() => handleRecharge(drone._id)}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-xl text-[10px] font-black tracking-widest uppercase shadow-lg shadow-red-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                        <Battery size={14} fill="currentColor" />
                        Recharge & Restore
                      </button>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <Navigation size={12} className="text-navy-400" />
                          <span className="text-[9px] font-black text-navy-900 uppercase">TELEMETRY LINK: ACTIVE</span>
                        </div>
                        <button className="p-2 hover:bg-navy-900 hover:text-white rounded-lg transition-colors text-navy-600">
                          <Settings size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Background Accent */}
              <div className="absolute -bottom-6 -right-6 text-navy-900/5 transform group-hover:-translate-y-2 group-hover:-translate-x-2 transition-transform duration-700">
                <Cpu size={120} />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default FleetManagement;
