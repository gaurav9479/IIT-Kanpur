import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import { io } from 'socket.io-client';
import axios from 'axios';
import L from 'leaflet';
import { Search, Package, Navigation, CheckCircle2, Clock, AlertCircle, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SOCKET_URL, API_URL } from '../config/mapConfig';

const OrderTracking = () => {
  const { orderId: urlOrderId } = useParams();
  const navigate = useNavigate();
  const [searchId, setSearchId] = useState(urlOrderId || '');
  const [order, setOrder] = useState(null);
  const [dronePos, setDronePos] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const stages = ['pending', 'assigned', 'delivering', 'delivered'];

  useEffect(() => {
    if (urlOrderId) {
      fetchOrder(urlOrderId);
    }
  }, [urlOrderId]);

  useEffect(() => {
    if (order?.assignedDrone?.droneId && order.status === 'delivering') {
      const socket = io(SOCKET_URL);
      
      socket.on(`drone_update_${order.assignedDrone.droneId}`, (data) => {
        setDronePos(data.location);
      });

      return () => socket.disconnect();
    }
  }, [order]);

  const fetchOrder = async (id) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_URL}/orders/${id}`);
      setOrder(response.data.data);
      // If drone is already delivering, set initial position
      if (response.data.data.assignedDrone?.location) {
          setDronePos(response.data.data.assignedDrone.location);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Order not found or invalid ID');
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchId.trim()) {
      navigate(`/track/${searchId.trim()}`);
    }
  };

  const getStatusIndex = (status) => stages.indexOf(status.toLowerCase());

  const droneIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/2965/2965311.png', // Drone icon
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });

  return (
    <div className="flex-1 overflow-y-auto bg-white-soft custom-scrollbar p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-3xl font-sora font-black text-navy-900 tracking-tighter uppercase">Order Tracker</h2>
            <p className="text-navy-600 text-[10px] font-black uppercase tracking-widest mt-1">Global Logistics Synchronization Hub</p>
          </div>
          <form onSubmit={handleSearch} className="relative flex-1 md:w-auto flex items-center gap-4 group">
            <div className="relative w-full md:w-96">
                <input 
                  type="text" 
                  placeholder="Enter Order Registry ID..." 
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                  className="w-full bg-white border-2 border-navy-900/5 rounded-2xl px-6 py-4 pl-14 font-bold text-navy-900 focus:border-navy-900/10 outline-none transition-all shadow-premium"
                />
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-navy-600 group-focus-within:text-navy-900 transition-colors" size={20} />
            </div>
            {order && (
                <button type="button" onClick={() => fetchOrder(urlOrderId || order._id)} disabled={loading} className="px-6 py-4 rounded-2xl bg-navy-900 text-white hover:bg-navy-800 disabled:opacity-50 transition-colors font-black uppercase text-[10px] tracking-widest shadow-premium">
                   Refresh
                </button>
            )}
            <button type="submit" className="hidden">Search</button>
          </form>
        </div>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="h-96 flex flex-col items-center justify-center space-y-4"
            >
              <div className="w-12 h-12 border-4 border-navy-900/10 border-t-navy-900 rounded-full animate-spin"></div>
              <p className="text-[10px] font-black text-navy-600 uppercase tracking-widest animate-pulse">Accessing Decentralized Ledger...</p>
            </motion.div>
          ) : error ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="navy-card p-12 flex flex-col items-center text-center space-y-6 max-w-2xl mx-auto"
            >
              <div className="p-4 bg-white/10 rounded-full">
                <AlertCircle size={48} className="text-rose-400" />
              </div>
              <div>
                <h3 className="text-2xl font-black uppercase tracking-tight">Signal Loss Detected</h3>
                <p className="text-navy-600 font-bold mt-2">{error}</p>
              </div>
              <button onClick={() => { setError(null); setSearchId(''); navigate('/track'); }} className="px-8 py-3 bg-white text-navy-900 rounded-xl font-black uppercase text-xs tracking-widest hover:scale-105 transition-transform">
                Reset Uplink
              </button>
            </motion.div>
          ) : order ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              {/* Status Overview Card */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card p-6 border-l-4 border-navy-900">
                  <p className="text-[10px] font-black text-navy-600 uppercase tracking-widest">Live Status</p>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <p className="text-2xl font-black text-navy-900 uppercase tracking-tight">{order.status}</p>
                  </div>
                </div>
                <div className="glass-card p-6">
                  <p className="text-[10px] font-black text-navy-600 uppercase tracking-widest">Assigned Unit</p>
                  <p className="text-2xl font-black text-navy-900 mt-2">{order.assignedDrone?.droneId || 'UNASSIGNED'}</p>
                </div>
                <div className="glass-card p-6">
                  <p className="text-[10px] font-black text-navy-600 uppercase tracking-widest">Payload weight</p>
                  <p className="text-2xl font-black text-navy-900 mt-2">{order.weight} KG</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="glass-card p-8">
                <div className="flex justify-between relative mb-12">
                  <div className="absolute top-1/2 left-0 w-full h-1 bg-white-muted -translate-y-1/2 z-0"></div>
                  <motion.div 
                    initial={{ width: 0 }} 
                    animate={{ width: `${(getStatusIndex(order.status) / (stages.length - 1)) * 100}%` }}
                    className="absolute top-1/2 left-0 h-1 bg-navy-900 -translate-y-1/2 z-0 shadow-[0_0_15px_rgba(13,27,42,0.3)]"
                  ></motion.div>
                  
                  {stages.map((stage, i) => {
                    const isActive = getStatusIndex(order.status) >= i;
                    const Icon = i === 0 ? Clock : i === 1 ? Package : i === 2 ? Navigation : CheckCircle2;
                    return (
                      <div key={stage} className="relative z-10 flex flex-col items-center">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center border-4 transition-colors duration-500 ${
                          isActive ? 'bg-navy-900 border-navy-900 text-white' : 'bg-white border-white-muted text-navy-600'
                        }`}>
                          <Icon size={20} />
                        </div>
                        <p className={`absolute -bottom-8 text-[9px] font-black uppercase tracking-widest whitespace-nowrap ${
                          isActive ? 'text-navy-900' : 'text-navy-600 opacity-50'
                        }`}>{stage}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Map Section */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-3 h-[400px] rounded-3xl overflow-hidden glass-card border border-navy-900/10 shadow-2xl relative">
                  <MapContainer 
                    center={[order.pickupLocation.lat, order.pickupLocation.lng]} 
                    zoom={15} 
                    className="h-full w-full"
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <Marker position={[order.pickupLocation.lat, order.pickupLocation.lng]} />
                    <Marker position={[order.dropLocation.lat, order.dropLocation.lng]} />
                    <Polyline positions={[
                      [order.pickupLocation.lat, order.pickupLocation.lng],
                      [order.dropLocation.lat, order.dropLocation.lng]
                    ]} color="#0d1b2a" dashArray="10, 10" />
                    
                    {dronePos && (
                        <Marker 
                            position={[dronePos.lat, dronePos.lng]} 
                            icon={droneIcon}
                        />
                    )}
                  </MapContainer>
                </div>
                <div className="lg:col-span-1 space-y-6">
                  <div className="glass-card p-6">
                    <h4 className="text-xs font-black text-navy-900 uppercase tracking-[0.2em] mb-4">Origin Node</h4>
                    <p className="text-[10px] text-navy-600 font-bold leading-relaxed">{order.pickupLocation.lat}, {order.pickupLocation.lng}</p>
                  </div>
                  <div className="glass-card p-6">
                    <h4 className="text-xs font-black text-navy-900 uppercase tracking-[0.2em] mb-4">Target Vector</h4>
                    <p className="text-[10px] text-navy-600 font-bold leading-relaxed">{order.dropLocation.lat}, {order.dropLocation.lng}</p>
                  </div>
                  <div className="navy-card p-6">
                    <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest">Estimated ETA</p>
                    <p className="text-3xl font-sora font-black mt-1">12:45 <span className="text-sm opacity-60 font-medium">PM</span></p>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }}
               className="h-96 flex flex-col items-center justify-center text-center space-y-6"
            >
               <div className="w-20 h-20 bg-white shadow-premium rounded-3xl flex items-center justify-center">
                  <Navigation className="text-navy-900" size={32} />
               </div>
               <div>
                  <h3 className="text-xl font-black text-navy-900 uppercase tracking-tight">Vessel Tracking Inactive</h3>
                  <p className="text-sm text-navy-600 font-bold mt-1 max-w-xs">Enter a valid registry ID above to initialize autonomous vector synchronization.</p>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default OrderTracking;
