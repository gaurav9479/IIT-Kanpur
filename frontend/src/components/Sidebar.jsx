import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Plane,
  Map as MapIcon,
  ShoppingCart,
  BarChart3,
  Search,
  ShieldAlert,
  Settings,
  RotateCcw,
  LogOut,
  PlusCircle,
  ChevronRight,
  Wifi
} from 'lucide-react';

// ── Nav Sections ──────────────────────────────────────────────
const sections = [
  {
    label: "Command",
    items: [
      { icon: LayoutDashboard, label: 'Overview',         path: '/',         badge: null },
      { icon: MapIcon,         label: 'Mission Planner',  path: '/planner',  badge: null },
      { icon: Plane,           label: 'Fleet Management', path: '/fleet',    badge: 'Live' },
    ]
  },
  {
    label: "Operations",
    items: [
      { icon: ShoppingCart,   label: 'Active Orders',    path: '/orders',    badge: null },
      { icon: Search,         label: 'Order Tracking',   path: '/tracking',  badge: null },
      { icon: RotateCcw,      label: 'Mission History',  path: '/history',   badge: null },
    ]
  },
  {
    label: "Intelligence",
    items: [
      { icon: BarChart3,      label: 'Analytics',        path: '/analytics', badge: null },
      { icon: ShieldAlert,    label: 'Safety Zones',     path: '/safety',    badge: null },
    ]
  },
  {
    label: "System",
    items: [
      { icon: PlusCircle,     label: 'Add Fleet Asset',  path: '/add-fleet', badge: null },
      { icon: Settings,       label: 'Settings',         path: '/settings',  badge: null },
    ]
  }
];

const Sidebar = () => {
  const location = useLocation();
  const [hovered, setHovered] = useState(null);

  return (
    <aside className="w-64 bg-navy-900 flex flex-col shadow-2xl" style={{ background: 'linear-gradient(180deg, #0a1628 0%, #0d1f3c 60%, #0f2447 100%)' }}>

      {/* ── Logo ── */}
      <div className="px-6 pt-8 pb-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/50">
              <Plane className="text-white" size={20} strokeWidth={2.5} />
            </div>
            {/* Live pulse dot */}
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>
          <div>
            <span className="font-sora font-black text-lg tracking-tight text-white uppercase leading-none">SkyTrace</span>
            <div className="flex items-center gap-1 mt-0.5">
              <Wifi size={8} className="text-emerald-400" />
              <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">System Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="mx-6 h-px bg-white/5 mb-4" />

      {/* ── Nav Sections ── */}
      <nav className="flex-1 px-3 overflow-y-auto custom-scrollbar space-y-5 pb-4">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/25 px-3 mb-2">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = location.pathname === item.path;
                const isHovered = hovered === item.path;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onMouseEnter={() => setHovered(item.path)}
                    onMouseLeave={() => setHovered(null)}
                    className={`
                      group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
                      ${isActive
                        ? 'bg-gradient-to-r from-sky-500/20 to-blue-600/10 text-white border border-sky-500/20'
                        : 'text-white/50 hover:text-white/90 hover:bg-white/5'
                      }
                    `}
                  >
                    {/* Active indicator bar */}
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 bg-sky-400 rounded-full" />
                    )}

                    {/* Icon */}
                    <span className={`transition-colors duration-200 ${isActive ? 'text-sky-400' : 'text-white/40 group-hover:text-white/70'}`}>
                      <item.icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                    </span>

                    {/* Label */}
                    <span className="flex-1 font-bold text-[11px] uppercase tracking-widest leading-none">
                      {item.label}
                    </span>

                    {/* Badge */}
                    {item.badge && (
                      <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">
                        {item.badge}
                      </span>
                    )}

                    {/* Hover arrow */}
                    {!isActive && (
                      <ChevronRight
                        size={12}
                        className={`text-white/20 transition-all duration-200 ${isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-1'}`}
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Bottom ── */}
      <div className="mx-6 h-px bg-white/5 mb-4" />
      <div className="px-3 pb-6">
        <button className="
          w-full group flex items-center gap-3 px-3 py-2.5 rounded-xl
          text-red-400/70 hover:text-red-400 hover:bg-red-500/10 
          transition-all duration-200 border border-transparent hover:border-red-500/20
        ">
          <LogOut size={16} strokeWidth={2} />
          <span className="font-bold text-[11px] uppercase tracking-widest">Terminate Session</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
