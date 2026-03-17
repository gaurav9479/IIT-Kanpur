import React from 'react';
import { Bell, User, Search } from 'lucide-react';

const Header = () => {
  return (
    <header className="h-20 bg-white-pure border-b border-navy-900/5 px-8 flex items-center justify-between shadow-sm relative z-10">
      <div className="relative w-96 group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-navy-600 group-focus-within:text-navy-900 transition-colors" size={18} />
        <input 
          type="text" 
          placeholder="Lookup mission artifacts..."
          className="w-full bg-white-soft border border-navy-700/10 rounded-2xl py-2.5 pl-12 pr-4 text-sm text-navy-900 placeholder:text-navy-600 focus:outline-none focus:border-navy-900/20 focus:bg-white transition-all shadow-sm"
        />
      </div>

      <div className="flex items-center gap-6">
        <div className="relative p-2 rounded-xl hover:bg-navy-900/5 cursor-pointer transition-all">
          <Bell className="text-navy-800" size={22} />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-navy-900 rounded-full border border-white"></span>
        </div>
        
        <div className="flex items-center gap-4 pl-6 border-l border-navy-900/10">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-black text-navy-900">IITK Operator</p>
            <p className="text-[10px] uppercase tracking-widest text-navy-600 font-bold">Admin Authority</p>
          </div>
          <div className="w-11 h-11 bg-navy-900 rounded-xl flex items-center justify-center text-white font-bold shadow-xl">
            <User size={24} />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
