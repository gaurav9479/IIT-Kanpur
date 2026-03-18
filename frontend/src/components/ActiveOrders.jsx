import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Package, 
  Clock, 
  MapPin, 
  Search, 
  Filter, 
  ArrowRight, 
  CheckCircle2, 
  Timer,
  ExternalLink,
  ChevronRight,
  Plane
} from 'lucide-react';
import { API_URL } from '../config/mapConfig';
import { Link } from 'react-router-dom';

const ActiveOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | pending | assigned | in-flight | delivered

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000); // Polling every 10s
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await axios.get(`${API_URL}/orders`);
      setOrders(response.data.data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      setLoading(false);
    }
  };

  const filteredOrders = useMemo(() => {
    if (filter === 'all') return orders;
    return orders.filter(o => o.status === filter);
  }, [orders, filter]);

  const stats = useMemo(() => {
    return {
      total: orders.length,
      pending: orders.filter(o => o.status === 'pending').length,
      inFlight: orders.filter(o => o.status === 'in-flight' || o.status === 'assigned').length,
    };
  }, [orders]);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 custom-scrollbar">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-sora font-black text-navy-900 tracking-tighter uppercase mb-2">
            Active <span className="text-navy-400">Orders</span>
          </h1>
          <p className="text-navy-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
            <Timer size={10} className="text-sky-500" />
            Live Delivery Queue Management | {stats.total} Total Records
          </p>
        </div>

        <div className="flex bg-white p-2 rounded-2xl shadow-xl border border-navy-900/5 items-center gap-4">
          <div className="flex gap-1 bg-navy-900/5 p-1 rounded-xl">
            {['all', 'pending', 'assigned', 'in-flight', 'delivered'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all ${
                  filter === f ? 'bg-navy-900 text-white shadow-md' : 'text-navy-500 hover:text-navy-900'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="h-6 w-px bg-navy-900/10"></div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" size={14} />
            <input 
              type="text" 
              placeholder="FILTER ORDER ID..." 
              className="pl-9 pr-4 py-2 bg-navy-900/5 rounded-xl text-[10px] font-black tracking-widest focus:outline-none w-40"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-48 bg-navy-900/5 rounded-3xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredOrders.map((order, index) => (
              <motion.div
                layout
                key={order._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className="glass-card p-6 flex flex-col border border-navy-900/5 hover:border-navy-900/20 transition-all group overflow-hidden"
              >
                {/* Status Badge */}
                <div className="flex justify-between items-start mb-6">
                  <div className="p-3 bg-navy-900 text-white rounded-2xl shadow-xl shadow-navy-900/20 group-hover:scale-110 transition-transform duration-500">
                    <Package size={22} />
                  </div>
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                    order.status === 'delivered' ? 'bg-emerald-500/10 text-emerald-600' :
                    order.status === 'in-flight' ? 'bg-sky-500/10 text-sky-600 animate-pulse' :
                    order.status === 'pending' ? 'bg-amber-500/10 text-amber-600' : 'bg-navy-900/5 text-navy-600'
                  }`}>
                    {order.status === 'delivered' && <CheckCircle2 size={10} />}
                    {order.status}
                  </div>
                </div>

                {/* Info Grid */}
                <div className="space-y-4 mb-6">
                  <div>
                    <h3 className="text-[10px] font-black text-navy-400 uppercase tracking-widest mb-1">Quantum Routing ID</h3>
                    <p className="font-sora font-black text-navy-900 truncate tracking-tight uppercase italic underline decoration-sky-500/30">
                      {order._id.slice(-12)}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-[9px] font-black text-navy-400 uppercase tracking-widest mb-1">Payload</p>
                      <p className="text-sm font-black text-navy-900">{order.weight} KG</p>
                    </div>
                    <div className="flex-1">
                      <p className="text-[9px] font-black text-navy-400 uppercase tracking-widest mb-1">ETA Status</p>
                      <p className="text-sm font-black text-sky-600">Calculated</p>
                    </div>
                  </div>
                </div>

                {/* Location Visualizer */}
                <div className="relative py-4 mb-6 border-y border-navy-900/5">
                  <div className="flex items-center justify-between relative z-10">
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-navy-900 shadow-[0_0_10px_rgba(0,0,0,0.2)]"></div>
                      <span className="text-[8px] font-black text-navy-500 uppercase tracking-tighter">Origin</span>
                    </div>
                    <div className="flex-1 mx-2 h-px bg-dashed-border border-t border-dashed border-navy-900/20 relative">
                       <Plane size={14} className={`text-sky-500 absolute top-1/2 -translate-y-1/2 transition-all ${order.status === 'in-flight' ? 'animate-pulse' : ''}`} style={{ left: '40%' }} />
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.3)]"></div>
                      <span className="text-[8px] font-black text-navy-500 uppercase tracking-tighter">Dest</span>
                    </div>
                  </div>
                </div>

                {/* Footer Link */}
                <Link 
                  to={`/tracking/${order._id}`}
                  className="mt-auto group/btn flex items-center justify-between w-full bg-navy-900 text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-navy-800 transition-all shadow-lg shadow-navy-900/10"
                >
                  <span>Real-time Telemetry</span>
                  <ChevronRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                </Link>
                
                {/* Background Decor */}
                <div className="absolute -bottom-12 -left-12 opacity-[0.03] rotate-12 group-hover:rotate-0 transition-transform duration-1000">
                   <Package size={200} />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default ActiveOrders;
