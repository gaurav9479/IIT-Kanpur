import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Clock, 
  Zap, 
  CheckCircle2,
  AlertCircle,
  ArrowUpRight
} from 'lucide-react';

const AnalyticsPage = () => {
  const stats = [
    { label: 'DELIVERY SUCCESS', value: '99.4%', trend: '+0.2%', icon: CheckCircle2, color: 'text-emerald-500' },
    { label: 'AVG. AIRTIME', value: '14.2m', trend: '-1.5m', icon: Clock, color: 'text-sky-500' },
    { label: 'FLEET UPTIME', value: '98.8%', trend: '+1.1%', icon: Zap, color: 'text-amber-500' },
    { label: 'ACTIVE USERS', value: '1,240', trend: '+84', icon: Users, color: 'text-purple-500' }
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 custom-scrollbar">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-sora font-black text-navy-900 tracking-tighter uppercase mb-2">
          Systems <span className="text-navy-400">Analytics</span>
        </h1>
        <p className="text-navy-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
          <TrendingUp size={10} className="text-emerald-500" />
          Recursive Performance Intelligence | Data-Driven Insights
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-card p-6 border border-navy-900/5 hover:border-navy-900/10 transition-all"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`p-2 bg-navy-900/5 rounded-lg ${stat.color}`}>
                <stat.icon size={18} />
              </div>
              <span className="text-[10px] font-black text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                {stat.trend}
              </span>
            </div>
            <p className="text-[9px] font-black text-navy-400 uppercase tracking-widest mb-1">{stat.label}</p>
            <p className="text-2xl font-sora font-black text-navy-900 tracking-tighter">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Main Charts Mockup */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Large Chart Container */}
        <div className="lg:col-span-2 glass-card p-8 min-h-[400px] flex flex-col border border-navy-900/10 shadow-2xl">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-sora font-black text-sm uppercase tracking-tight text-navy-900">Fleet Throughput (24H)</h3>
            <div className="flex gap-2">
               <div className="flex items-center gap-2 px-3 py-1 bg-navy-900/5 rounded-full text-[9px] font-black uppercase tracking-widest text-navy-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-sky-500"></div> Planned
               </div>
               <div className="flex items-center gap-2 px-3 py-1 bg-navy-900/5 rounded-full text-[9px] font-black uppercase tracking-widest text-navy-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Executed
               </div>
            </div>
          </div>
          
          {/* Custom SVG Bar Chart Mockup */}
          <div className="flex-1 flex items-end justify-between gap-4 py-4">
            {[40, 70, 45, 90, 65, 80, 55, 95, 40, 75, 85, 60].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col gap-1 items-center">
                <motion.div 
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ delay: i * 0.05 + 0.5, duration: 1, ease: 'circOut' }}
                  className="w-full bg-gradient-to-t from-navy-900 to-sky-500 rounded-t-lg relative group"
                >
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-navy-900 text-white text-[8px] font-black px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {h} Units
                  </div>
                </motion.div>
                <span className="text-[8px] font-black text-navy-400 uppercase tracking-tighter">{i}:00</span>
              </div>
            ))}
          </div>
        </div>

        {/* Circular Efficiency Mockup */}
        <div className="lg:col-span-1 glass-card p-8 flex flex-col border border-navy-900/10">
          <h3 className="font-sora font-black text-sm uppercase tracking-tight text-navy-900 mb-8">Energy Efficiency</h3>
          <div className="flex-1 flex flex-col items-center justify-center relative">
            <svg viewBox="0 0 100 100" className="w-48 h-48 -rotate-90">
              <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-navy-900/5" />
              <motion.circle 
                cx="50" cy="50" r="40" 
                stroke="currentColor" strokeWidth="8" fill="transparent" 
                strokeDasharray="251.2"
                initial={{ strokeDashoffset: 251.2 }}
                animate={{ strokeDashoffset: 251.2 * 0.25 }}
                transition={{ duration: 2, delay: 1, ease: 'circOut' }}
                className="text-sky-500" 
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-sora font-black text-navy-900 tracking-tighter">75%</span>
              <span className="text-[9px] font-black text-navy-400 uppercase tracking-widest">Optimized</span>
            </div>
          </div>
          <div className="space-y-4 pt-8">
             <div className="flex justify-between items-center bg-navy-900/5 p-4 rounded-xl">
                <span className="text-[10px] font-black uppercase text-navy-600">Regenerative Braking</span>
                <span className="text-[10px] font-black text-emerald-600">+12%</span>
             </div>
             <div className="flex justify-between items-center bg-navy-900/5 p-4 rounded-xl">
                <span className="text-[10px] font-black uppercase text-navy-600">Wind Resistance Loss</span>
                <span className="text-[10px] font-black text-rose-500">-5%</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
