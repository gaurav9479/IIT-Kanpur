import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Info, AlertTriangle, XCircle, Clock } from 'lucide-react';

/**
 * EventLogPanel Component
 * Receives eventLog from useSocket hook in App.jsx.
 * No separate socket connection — avoids duplicate event listeners.
 */
const EventLogPanel = ({ eventLog = [] }) => {
  // Map the eventLog prop to local display format
  const logs = eventLog.map((entry, i) => ({
    id: entry.timestamp + i,
    timestamp: entry.timestamp
      ? new Date(entry.timestamp).toLocaleTimeString([], { hour12: false })
      : '--:--:--',
    message: entry.message,
    type: entry.type || 'info',
  }));
  const scrollRef = useRef(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [logs]);

  const getTypeStyles = (type) => {
    switch (type) {
      case 'warning':
        return {
          bg: 'bg-amber-500/10',
          border: 'border-amber-500/20',
          icon: <AlertTriangle className="text-amber-400" size={14} />,
          text: 'text-amber-100',
          dot: 'bg-amber-400'
        };
      case 'error':
        return {
          bg: 'bg-rose-500/10',
          border: 'border-rose-500/20',
          icon: <XCircle className="text-rose-400" size={14} />,
          text: 'text-rose-100',
          dot: 'bg-rose-400'
        };
      default:
        return {
          bg: 'bg-sky-500/10',
          border: 'border-sky-500/20',
          icon: <Info className="text-sky-400" size={14} />,
          text: 'text-sky-100',
          dot: 'bg-sky-400'
        };
    }
  };

  return (
    <aside className="w-[350px] h-full bg-navy-900 border-l border-navy-800 flex flex-col shadow-2xl relative z-20">
      {/* Panel Header */}
      <div className="p-6 border-b border-navy-800 flex items-center justify-between bg-navy-900/50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-sky-500/10 rounded-lg">
            <Terminal className="text-sky-400" size={18} />
          </div>
          <div>
            <h3 className="text-white font-sora font-bold text-sm tracking-tight uppercase">Event Log</h3>
            <p className="text-navy-600 text-[9px] font-black uppercase tracking-widest mt-0.5">Autonomous Tracking Feed</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
          <span className="text-navy-600 text-[8px] font-black uppercase tracking-widest">Live</span>
        </div>
      </div>

      {/* Logs Container */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-navy-900/30"
      >
        <AnimatePresence initial={false}>
          {logs.map((log) => {
            const styles = getTypeStyles(log.type);
            return (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className={`p-3 rounded-xl border ${styles.bg} ${styles.border} group transition-all hover:bg-navy-800/40`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{styles.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[11px] leading-relaxed font-medium ${styles.text} break-words`}>
                      {log.message}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                       <div className="flex items-center gap-1.5">
                         <div className={`w-1 h-1 rounded-full ${styles.dot}`}></div>
                         <span className="text-[8px] font-black text-navy-600 uppercase tracking-widest">{log.type}</span>
                       </div>
                       <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                         <Clock className="text-navy-600" size={10} />
                         <span className="text-[9px] font-bold text-navy-600">{log.timestamp}</span>
                       </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        
        {logs.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center py-20 opacity-30">
            <div className="w-12 h-12 bg-navy-800 rounded-full flex items-center justify-center mb-4">
              <Terminal size={20} className="text-navy-600" />
            </div>
            <p className="text-navy-600 text-[10px] font-black uppercase tracking-[0.2em]">Scanner Synchronizing...</p>
          </div>
        )}
      </div>
      
      {/* Footer Stats */}
      <div className="p-4 border-t border-navy-800 bg-navy-950/20">
        <label className="text-[8px] font-black text-navy-600 uppercase tracking-[0.2em] mb-3 block opacity-50 text-center">Protocol Distribution</label>
        <div className="grid grid-cols-3 gap-2">
           <div className="bg-navy-800/40 p-2 rounded-lg text-center border border-navy-800">
             <div className="text-sky-400 text-[10px] font-bold">{logs.filter(l => l.type === 'info').length}</div>
             <div className="text-navy-700 text-[7px] font-black uppercase">Info</div>
           </div>
           <div className="bg-navy-800/40 p-2 rounded-lg text-center border border-navy-800">
             <div className="text-amber-400 text-[10px] font-bold">{logs.filter(l => l.type === 'warning').length}</div>
             <div className="text-navy-700 text-[7px] font-black uppercase">Warn</div>
           </div>
           <div className="bg-navy-800/40 p-2 rounded-lg text-center border border-navy-800">
             <div className="text-rose-400 text-[10px] font-bold">{logs.filter(l => l.type === 'error').length}</div>
             <div className="text-navy-700 text-[7px] font-black uppercase">Err</div>
           </div>
        </div>
      </div>
    </aside>
  );
};

export default EventLogPanel;
