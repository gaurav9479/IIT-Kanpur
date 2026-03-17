import React from 'react';
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
  LogOut 
} from 'lucide-react';

const Sidebar = () => {
  const location = useLocation();
  const menuItems = [
    { icon: LayoutDashboard, label: 'Overview', path: '/' },
    { icon: MapIcon, label: 'Mission Planner', path: '/planner' },
    { icon: Plane, label: 'Fleet Management', path: '/fleet' },
    { icon: ShoppingCart, label: 'Active Orders', path: '/orders' },
    { icon: Search, label: 'Order Tracking', path: '/tracking' },
    { icon: RotateCcw, label: 'Mission History', path: '/history' },
    { icon: BarChart3, label: 'Analytics', path: '/analytics' },
    { icon: ShieldAlert, label: 'Safety Zones', path: '/safety' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  return (
    <aside className="w-64 bg-white border-r border-navy-900/5 flex flex-col shadow-sm">
      <div className="p-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-navy-900 rounded-xl flex items-center justify-center shadow-lg">
            <Plane className="text-white" size={24} />
          </div>
          <span className="font-sora font-black text-xl tracking-tight text-navy-900 uppercase">SKYTRACE</span>
        </div>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto custom-scrollbar">
        {menuItems.map((item, index) => (
          <Link
            key={index}
            to={item.path}
            className={`nav-link ${location.pathname === item.path ? 'active' : 'text-navy-700 hover:text-navy-900 hover:bg-navy-900/5'}`}
          >
            <item.icon size={20} />
            <span className="font-bold text-xs uppercase tracking-widest">{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="p-6 mt-auto">
        <button className="nav-link text-red-600 hover:bg-red-50 w-full cursor-pointer font-bold text-xs uppercase tracking-widest">
          <LogOut size={20} />
          <span>Terminate Session</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
