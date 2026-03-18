import React, { useEffect, useState } from 'react';
import { motion, animate } from 'framer-motion';
import { TrendingUp, Package, Zap, Battery, Activity } from 'lucide-react';

const CountUp = ({ value, suffix = "" }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const numericValue = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.]/g, '')) : value;
    const controls = animate(0, numericValue, {
      duration: 1,
      ease: "easeOut",
      onUpdate: (latest) => setDisplayValue(latest)
    });
    return () => controls.stop();
  }, [value]);

  const formatted = typeof value === 'string' && value.includes('.') 
    ? displayValue.toFixed(1) 
    : Math.floor(displayValue);

  return <span>{formatted}{suffix}</span>;
};

const MetricCard = ({ title, value, suffix, icon: Icon, delay, breakdown }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay }}
      className="glass-card p-6 border border-navy-900/5 hover:border-navy-900/10 transition-all duration-500 group relative overflow-hidden bg-white/50 backdrop-blur-xl"
    >
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-navy-900/5 rounded-full blur-3xl group-hover:bg-navy-900/10 transition-colors duration-500"></div>

      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className="p-3 bg-navy-900 rounded-xl shadow-lg shadow-navy-900/10 group-hover:scale-110 transition-transform duration-500">
          <Icon className="text-white" size={20} />
        </div>
        {breakdown && breakdown}
      </div>

      <div className="relative z-10 mt-auto">
        <p className="text-[10px] font-black text-navy-600 uppercase tracking-widest">{title}</p>
        <div className="flex items-baseline gap-1 mt-1">
          <h3 className="text-4xl font-sora font-black text-navy-900 tracking-tighter">
             <CountUp value={value} />
          </h3>
          <span className="text-xl font-black text-navy-900/30 tracking-widest ml-1">{suffix}</span>
        </div>
      </div>
    </motion.div>
  );
};

const MetricsDashboard = ({ drones }) => {
  // Compute metrics dynamically from the real-time drones object
  const droneList = drones ? Object.values(drones) : [];
  const totalDrones = droneList.length;
  
  const activeDrones = droneList.filter(d => d.status === "delivering").length;
  const idleDrones = droneList.filter(d => d.status === "idle").length;
  const groundedDrones = droneList.filter(d => d.status === "grounded").length;
  const lowBatteryDrones = droneList.filter(d => typeof d.batteryLevel === 'number' && d.batteryLevel < 20).length;
  
  const avgBattery = totalDrones > 0
    ? (droneList.reduce((sum, d) => sum + (d.batteryLevel || 100), 0) / totalDrones).toFixed(1)
    : "0.0";

  // Simple loading state if no drones
  if (!drones || totalDrones === 0) {
    return (
      <div className="w-full flex justify-center py-6">
         <span className="text-xs font-bold text-navy-600 animate-pulse tracking-widest uppercase">Initializing Fleet Metrics...</span>
      </div>
    );
  }

  const liveMetrics = [
    { 
      title: "Active Deliveries", 
      value: activeDrones, 
      suffix: " PKTS", 
      icon: Package,
      breakdown: (
        <div className="flex bg-green-500/10 px-3 py-1 rounded-full text-[10px] items-center gap-1 font-black uppercase text-green-600">
          <TrendingUp size={10} /> {activeDrones > 0 ? "LIVE" : "IDLE"}
        </div>
      )
    },
    { 
      title: "Total Fleet", 
      value: totalDrones, 
      suffix: " DRNZ", 
      icon: Activity,
      breakdown: (
        <div className="flex flex-col items-end gap-1 font-bold text-[9px] uppercase tracking-widest text-navy-600 text-right">
          <span>Delivering: {activeDrones}</span>
          <span>Idle: {idleDrones}</span>
          <span className={groundedDrones > 0 ? "text-rose-600" : ""}>Grounded: {groundedDrones}</span>
        </div>
      )
    },
    { 
      title: "Avg Battery", 
      value: avgBattery, 
      suffix: "%", 
      icon: Zap,
      breakdown: (
         <div className="flex bg-sky-500/10 px-3 py-1 rounded-full text-[10px] items-center gap-1 font-black uppercase text-sky-600">
          CHARGE
        </div>
      )
    },
    { 
      title: "Low Battery", 
      value: lowBatteryDrones, 
      suffix: " WARN", 
      icon: Battery,
      breakdown: (
         lowBatteryDrones > 0 ? (
            <div className="flex bg-rose-500/10 px-3 py-1 rounded-full text-[10px] items-center gap-1 font-black uppercase text-rose-600">
              CRITICAL
            </div>
         ) : null
      )
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
      {liveMetrics.map((m, i) => (
        <MetricCard key={m.title} {...m} delay={i * 0.1} />
      ))}
    </div>
  );
};

export default MetricsDashboard;
