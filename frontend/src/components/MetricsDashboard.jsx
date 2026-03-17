import React, { useEffect, useState } from 'react';
import { motion, useSpring, useTransform, animate } from 'framer-motion';
import { TrendingUp, TrendingDown, Package, Target, ShieldCheck, Zap } from 'lucide-react';

const CountUp = ({ value, suffix = "" }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const numericValue = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.]/g, '')) : value;
    const controls = animate(0, numericValue, {
      duration: 2,
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

const MetricCard = ({ title, value, suffix, trend, icon: Icon, delay }) => {
  const isPositive = trend > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay }}
      className="glass-card p-6 border border-navy-900/5 hover:border-navy-900/10 transition-all duration-500 group relative overflow-hidden bg-white/50 backdrop-blur-xl"
    >
      {/* Background Accent */}
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-navy-900/5 rounded-full blur-3xl group-hover:bg-navy-900/10 transition-colors duration-500"></div>

      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className="p-3 bg-navy-900 rounded-xl shadow-lg shadow-navy-900/10 group-hover:scale-110 transition-transform duration-500">
          <Icon className="text-white" size={20} />
        </div>
        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black tracking-widest uppercase ${
          isPositive ? 'bg-green-500/10 text-green-600' : 'bg-rose-500/10 text-rose-600'
        }`}>
          {isPositive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          {Math.abs(trend)}%
        </div>
      </div>

      <div className="relative z-10">
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

const MetricsDashboard = ({ metrics }) => {
  const defaultMetrics = [
    { title: "Total Deliveries", value: 1284, suffix: "PKTS", trend: 12.5, icon: Package },
    { title: "Avg ETA Accuracy", value: 98.2, suffix: "%", trend: 2.1, icon: Target },
    { title: "Conflicts Avoided", value: 42, suffix: "SAFE", trend: 5.4, icon: ShieldCheck },
    { title: "Drone Utilization", value: 84.6, suffix: "%", trend: -0.8, icon: Zap },
  ];

  const displayMetrics = metrics || defaultMetrics;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
      {displayMetrics.map((m, i) => (
        <MetricCard key={m.title} {...m} delay={i * 0.1} />
      ))}
    </div>
  );
};

export default MetricsDashboard;
