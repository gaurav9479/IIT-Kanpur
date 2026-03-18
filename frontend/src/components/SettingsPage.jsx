import React from 'react';
import { motion } from 'framer-motion';
import { 
  Settings as SettingsIcon, 
  User, 
  Bell, 
  Shield, 
  Database, 
  Cpu, 
  Globe, 
  Zap,
  ChevronRight,
  Lock
} from 'lucide-react';

const SettingsPage = () => {
  const sections = [
    { title: 'System Configuration', icon: Cpu, desc: 'Manage drone hardware parameters and OS versions.' },
    { title: 'Security & Access', icon: Shield, desc: 'RBAC controls and authentication protocol settings.' },
    { title: 'Telemetry Notifications', icon: Bell, desc: 'Configure real-time event logging and alerts.' },
    { title: 'Database & Sync', icon: Database, desc: 'Manage MongoDB Atlas connection and data retention.' },
    { title: 'Global Operations', icon: Globe, desc: 'Regional deployment settings and campus hub config.' }
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 custom-scrollbar">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-sora font-black text-navy-900 tracking-tighter uppercase mb-2">
          System <span className="text-navy-400">Settings</span>
        </h1>
        <p className="text-navy-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
          <SettingsIcon size={10} className="animate-spin-slow" />
          Quantum Core Preferences | Administrative Control Center
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        {/* Left Nav (Internal to Settings) */}
        <div className="xl:col-span-1 space-y-2">
           <div className="glass-card p-6 border border-navy-900/10 mb-6 bg-navy-900 text-white">
              <div className="flex items-center gap-4 mb-4">
                 <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                    <User size={24} />
                 </div>
                 <div>
                    <h3 className="font-black text-sm uppercase">Admin Console</h3>
                    <p className="text-[10px] text-white/50 uppercase font-black">Superuser Access</p>
                 </div>
              </div>
              <div className="h-px bg-white/10 my-4"></div>
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">System Status: Optimal</p>
           </div>
           
           {sections.map((s, i) => (
             <button key={i} className="w-full text-left p-4 rounded-xl flex items-center gap-4 hover:bg-navy-900 hover:text-white transition-all group">
                <div className="p-2 bg-navy-900/5 group-hover:bg-white/10 rounded-lg">
                   <s.icon size={18} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest flex-1">{s.title}</span>
                <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
             </button>
           ))}
        </div>

        {/* Setting Panel Details */}
        <div className="xl:col-span-3 glass-card p-10 border border-navy-900/10 flex flex-col space-y-10">
           {/* Section 1 */}
           <section>
              <div className="flex items-center gap-3 mb-6">
                 <Zap size={20} className="text-sky-500" />
                 <h2 className="font-sora font-black text-lg uppercase tracking-tight text-navy-900">Performance Optimization</h2>
              </div>
              
              <div className="space-y-6">
                 {[
                   { label: 'Auto-Route Re-optimization', desc: 'Recalculate 3D trajectory every 500ms during delivery.' },
                   { label: 'Battery Reserve Buffer', desc: 'Trigger automatic return-to-base at 20% charge.' },
                   { label: 'Collision Mitigation Level', desc: 'AI confidence threshold for evasive maneuvers.' }
                 ].map((s, i) => (
                   <div key={i} className="flex items-center justify-between p-6 bg-navy-900/5 rounded-2xl group hover:bg-navy-900/10 transition-colors">
                      <div className="max-w-md">
                         <h4 className="text-[11px] font-black uppercase tracking-widest text-navy-900 mb-1">{s.label}</h4>
                         <p className="text-[10px] text-navy-500 font-semibold">{s.desc}</p>
                      </div>
                      <div className="w-12 h-6 bg-sky-500 rounded-full relative shadow-inner">
                         <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-md"></div>
                      </div>
                   </div>
                 ))}
              </div>
           </section>

           <div className="h-px bg-navy-900/5"></div>

           {/* Section 2 */}
           <section>
              <div className="flex items-center gap-3 mb-6">
                 <Shield size={20} className="text-emerald-500" />
                 <h2 className="font-sora font-black text-lg uppercase tracking-tight text-navy-900">Advanced Safety Overrides</h2>
              </div>
              
              <div className="p-8 border-2 border-dashed border-navy-900/10 rounded-[2rem] flex flex-col items-center text-center">
                 <Lock size={32} className="text-navy-300 mb-4" />
                 <h3 className="font-black text-sm uppercase mb-2">Human Intervention Protocols</h3>
                 <p className="max-w-xs text-[10px] text-navy-500 font-semibold mb-6">
                    Override autonomous systems for critical safety events. Requires Level 3 Authentication.
                 </p>
                 <button className="px-8 py-3 bg-navy-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-navy-900/20 active:scale-95 transition-all">
                    Enable Manual Mode
                 </button>
              </div>
           </section>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
