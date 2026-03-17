import React from 'react';
import { Plane, Activity, Battery, CheckCircle2 } from 'lucide-react';

const StatCard = ({ icon: Icon, label, value }) => (
  <div className="glass-card p-6 flex items-center justify-between group hover:border-navy-900/10 transition-all duration-300">
    <div className="flex items-center gap-5">
      <div className="p-4 bg-navy-900 rounded-2xl shadow-lg group-hover:scale-105 transition-transform duration-500">
        <Icon className="text-white" size={28} />
      </div>
      <div>
        <p className="text-[10px] font-black text-navy-600 uppercase tracking-widest">{label}</p>
        <p className="text-3xl font-sora font-black text-navy-900 mt-1">{value}</p>
      </div>
    </div>
  </div>
);

const StatsOverview = ({ drones }) => {
  const activeMissions = drones.filter(d => d.status === 'delivering').length;
  const avgBattery = drones.length ? (drones.reduce((acc, d) => acc + d.batteryLevel, 0) / drones.length).toFixed(0) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
      <StatCard 
        icon={Plane} 
        label="Total Fleet" 
        value={drones.length} 
      />
      <StatCard 
        icon={Activity} 
        label="Active Missions" 
        value={activeMissions} 
      />
      <StatCard 
        icon={Battery} 
        label="Avg. Fleet Battery" 
        value={`${avgBattery}%`} 
      />
      <StatCard 
        icon={CheckCircle2} 
        label="Success Rate" 
        value="98.4%" 
      />
    </div>
  );
};

export default StatsOverview;
