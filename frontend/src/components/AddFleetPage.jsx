import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plane, 
  Plus, 
  Cpu, 
  Weight, 
  ShieldCheck, 
  Trash2, 
  Activity,
  Zap,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useSocket } from '../hooks/useSocket';
import axios from 'axios';
import { API_URL } from '../config/mapConfig';

const AddFleetPage = () => {
  const { drones } = useSocket();
  const droneList = useMemo(() => Object.values(drones), [drones]);

  const [formData, setFormData] = useState({
    droneId: '',
    vehicleType: 'drone',
    payloadCapacity: 2.0
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.droneId) return;

    setIsSubmitting(true);
    setFeedback(null);

    try {
      await axios.post(`${API_URL}/drones`, formData);
      setFeedback({ type: 'success', msg: `Successfully added ${formData.droneId} to the fleet.` });
      setFormData({ droneId: '', vehicleType: 'drone', payloadCapacity: 2.0 });
    } catch (err) {
      setFeedback({ 
        type: 'error', 
        msg: err.response?.data?.message || 'Failed to add vehicle. Ensure ID is unique.' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id, droneId) => {
    if (!window.confirm(`Are you sure you want to PERMANENTLY remove ${droneId} from the fleet?`)) return;
    try {
      await axios.delete(`${API_URL}/drones/${id}`);
      setFeedback({ type: 'success', msg: `Asset ${droneId} removed successfully.` });
    } catch (err) {
      setFeedback({ type: 'error', msg: 'Failed to remove asset.' });
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 custom-scrollbar bg-white">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-sora font-black text-navy-900 tracking-tighter uppercase mb-2">
            Fleet <span className="text-navy-400">Expansion</span>
          </h1>
          <p className="text-navy-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
            <Activity size={10} className="text-sky-500 animate-pulse" />
            Integrate New Autonomous Assets | {droneList.length} Units Total
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Section */}
        <div className="lg:col-span-1 space-y-6">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-card p-8 border border-navy-900/10 shadow-2xl relative overflow-hidden bg-white/50 backdrop-blur-xl"
          >
            <div className="absolute -right-8 -top-8 text-navy-900/5 rotate-12">
              <Plus size={160} />
            </div>

            <h3 className="text-xl font-sora font-black text-navy-900 tracking-tighter uppercase mb-6 flex items-center gap-2">
              <Plane size={20} className="text-navy-900" />
              Register Asset
            </h3>

            <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-navy-600 uppercase tracking-widest">Unique Asset ID</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. SKY-001"
                  value={formData.droneId}
                  onChange={(e) => setFormData({...formData, droneId: e.target.value.toUpperCase()})}
                  className="w-full px-4 py-3 bg-navy-900/5 rounded-xl text-sm font-bold text-navy-900 border border-transparent focus:border-navy-900/20 focus:outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-navy-600 uppercase tracking-widest">Vehicle Architecture</label>
                <div className="grid grid-cols-2 gap-3">
                  {['drone', 'plane'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormData({...formData, vehicleType: type})}
                      className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                        formData.vehicleType === type 
                        ? 'bg-navy-900 text-white border-navy-900 shadow-lg' 
                        : 'bg-white text-navy-600 border-navy-900/10 hover:bg-navy-900/5'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-navy-600 uppercase tracking-widest">Payload Capacity (KG)</label>
                <div className="flex items-center gap-4">
                  <input 
                    type="range"
                    min="1"
                    max="10"
                    step="0.5"
                    value={formData.payloadCapacity}
                    onChange={(e) => setFormData({...formData, payloadCapacity: parseFloat(e.target.value)})}
                    className="flex-1 h-1.5 bg-navy-900/10 rounded-lg appearance-none cursor-pointer accent-navy-900"
                  />
                  <span className="text-lg font-sora font-black text-navy-900 min-w-[40px]">{formData.payloadCapacity}</span>
                </div>
              </div>

              {feedback && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`p-4 rounded-xl text-[10px] font-bold flex items-center gap-2 ${
                    feedback.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {feedback.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  {feedback.msg}
                </motion.div>
              )}

              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-navy-900 text-white py-4 rounded-xl text-[10px] font-black tracking-widest uppercase shadow-xl shadow-navy-900/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? 'Integrating...' : (
                  <>
                    <Zap size={14} fill="currentColor" />
                    Deploy to Fleet
                  </>
                )}
              </button>
            </form>
          </motion.div>
        </div>

        {/* Fleet List Section */}
        <div className="lg:col-span-2">
          <div className="glass-card border border-navy-900/5 bg-white/50 backdrop-blur-xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-navy-900/5 flex items-center justify-between">
              <h3 className="text-sm font-black text-navy-900 uppercase tracking-widest">Active Assets Registry</h3>
              <div className="px-3 py-1 bg-navy-900/5 rounded-full text-[9px] font-bold text-navy-600">
                TOTAL: {droneList.length} READY
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-navy-900/[0.02] border-b border-navy-900/5">
                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-navy-400">Unit ID</th>
                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-navy-400">Type</th>
                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-navy-400">Max Payload</th>
                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-navy-400">Current Battery</th>
                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-navy-400">Status</th>
                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-navy-400 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/5">
                  <AnimatePresence>
                    {droneList.map((drone) => (
                      <motion.tr 
                        key={drone.droneId}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="group hover:bg-navy-900/[0.01] transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-navy-900 text-white rounded-lg shadow-md group-hover:scale-110 transition-transform">
                              <Plane size={14} />
                            </div>
                            <span className="font-sora font-black text-navy-900 italic">{drone.droneId}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-black uppercase text-navy-500 tracking-widest">{drone.vehicleType || drone.type || 'DRONE'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-bold text-navy-900 uppercase">{drone.payloadCapacity}KG</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-navy-900/5 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${drone.batteryLevel < 25 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                                style={{ width: `${drone.batteryLevel}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-black text-navy-900">{drone.batteryLevel}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-[8px] font-black tracking-tighter uppercase ${
                            drone.status === 'delivering' ? 'bg-sky-500/10 text-sky-600' :
                            drone.status === 'idle' ? 'bg-emerald-500/10 text-emerald-600' :
                            drone.status === 'grounded' ? 'bg-rose-500/10 text-rose-600' : 'bg-amber-500/10 text-amber-600'
                          }`}>
                            {drone.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                           <button 
                             onClick={() => handleDelete(drone._id, drone.droneId)}
                             className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            >
                             <Trash2 size={16} />
                           </button>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddFleetPage;
