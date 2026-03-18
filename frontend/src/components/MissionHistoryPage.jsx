import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Map as MapIcon, Calendar, Clock, ChevronRight, PlayCircle, Layers, Navigation } from 'lucide-react';
import MissionReplay from './MissionReplay';
import { API_URL } from '../config/mapConfig';

const MissionHistoryPage = () => {
  const [missions, setMissions] = useState([]);
  const [selectedMission, setSelectedMission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    fetchMissions();
  }, []);

  const fetchMissions = async () => {
    try {
      const response = await axios.get(`${API_URL}/missions`);
      setMissions(response.data.data);
    } catch (error) {
      console.error('Failed to fetch missions:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-white-soft">
      {/* Sidebar: Mission List */}
      <div className="w-96 border-r border-navy-900/5 bg-white flex flex-col shadow-sm">
        <div className="p-8 border-b border-navy-900/5">
          <h2 className="text-2xl font-sora font-black text-navy-900 tracking-tighter uppercase mb-4">Registry Logs</h2>
          <div className="flex bg-navy-900/5 p-1 rounded-xl">
             {['All', 'Active', 'Completed', 'Failed'].map(f => (
                <button 
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${filter === f ? 'bg-white shadow-sm text-navy-900' : 'text-navy-600 hover:text-navy-900'}`}
                >
                  {f}
                </button>
             ))}
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
          {loading ? (
            <div className="py-20 text-center space-y-4">
               <div className="w-8 h-8 border-4 border-navy-900/10 border-t-navy-900 rounded-full animate-spin mx-auto"></div>
               <p className="text-[10px] font-black text-navy-600 uppercase tracking-widest animate-pulse">Synchronizing Logs...</p>
            </div>
          ) : missions.length === 0 ? (
            <div className="py-20 text-center text-navy-600">
               <Layers className="text-navy-900/20 mx-auto mb-4" size={32} />
               <p className="text-[10px] font-black uppercase tracking-widest">No mission history yet</p>
            </div>
          ) : (
            missions.filter(m => {
                if (filter === 'All') return true;
                const status = (m.status || '').toUpperCase();
                if (filter === 'Active') return ['ASSIGNED', 'DELIVERING', 'PENDING'].includes(status);
                if (filter === 'Completed') return ['COMPLETED', 'DELIVERED'].includes(status);
                if (filter === 'Failed') return ['FAILED'].includes(status);
                return true;
            }).map((m) => (
              <motion.button
                key={m._id}
                whileHover={{ x: 5 }}
                onClick={() => setSelectedMission(m)}
                className={`w-full text-left p-4 rounded-2xl transition-all border-2 ${
                  selectedMission?._id === m._id 
                  ? 'border-navy-900 bg-navy-900 text-white shadow-2xl' 
                  : 'border-transparent bg-white-soft hover:border-navy-900/10'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-60">
                    {m.missionId.split('-').slice(0, 2).join('-')}
                  </span>
                  <div className={`w-2 h-2 rounded-full ${m.status === 'COMPLETED' ? 'bg-green-400' : 'bg-amber-400'}`}></div>
                </div>
                <h4 className={`text-sm font-black tracking-tight ${selectedMission?._id === m._id ? 'text-white' : 'text-navy-900'}`}>
                  Mission Vector {m.missionId.slice(-4)}
                </h4>
                <div className={`flex items-center gap-3 mt-3 ${selectedMission?._id === m._id ? 'text-white/60' : 'text-navy-600'}`}>
                  <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-tighter">
                    <Calendar size={12} /> {new Date(m.createdAt).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-tighter">
                    <Clock size={12} /> {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </motion.button>
            ))
          )}
        </div>
      </div>

      {/* Main Content: Replay Area */}
      <div className="flex-1 p-8 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {selectedMission ? (
            <motion.div 
               key={selectedMission._id}
               initial={{ opacity: 0, scale: 0.98 }} 
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.98 }}
               className="h-full"
            >
              <MissionReplay missionData={selectedMission} />
            </motion.div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-8">
               <div className="p-10 bg-white shadow-premium rounded-[3rem] relative">
                  <PlayCircle className="text-navy-900/5 absolute -inset-10" size={200} />
                  <div className="w-24 h-24 bg-navy-900 rounded-3xl flex items-center justify-center shadow-2xl relative z-10">
                     <Layers className="text-white" size={40} />
                  </div>
               </div>
               <div className="max-w-xs">
                  <h3 className="text-2xl font-black text-navy-900 uppercase tracking-tight">Mission Replay Center</h3>
                  <p className="text-sm text-navy-600 font-bold mt-2 leading-relaxed">Select an archived vector log from the registry to initialize full-scale telemetry reconstruction.</p>
               </div>
               <div className="flex gap-4">
                  <button onClick={fetchMissions} className="px-6 py-2.5 bg-navy-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-navy-900/20">
                    Refresh Logs
                  </button>
               </div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default MissionHistoryPage;
