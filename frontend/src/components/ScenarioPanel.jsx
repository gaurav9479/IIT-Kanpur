import React, { useState } from 'react';
import axios from 'axios';
import { Play, Zap, Activity, RefreshCcw, RotateCcw } from 'lucide-react';
import { API_URL } from '../config/mapConfig';

const ScenarioPanel = () => {
    const [loading, setLoading] = useState(null);
    const [resetting, setResetting] = useState(false);

    const scenarios = [
        {
            id: 'traffic',
            name: 'High Traffic Density',
            desc: 'Launch 8 units between all hubs with anti-collision lanes.',
            icon: <Activity className="text-blue-500" size={18} />,
            color: 'from-blue-50/50 to-blue-100/50',
            border: 'border-blue-200'
        },
        {
            id: 'altitude',
            name: 'Altitude Traffic Conflict',
            desc: '8 drones launched at identical altitudes — forced lane reassignment every 600ms.',
            icon: <Activity className="text-purple-500" size={18} />,
            color: 'from-purple-50/50 to-purple-100/50',
            border: 'border-purple-200'
        },
        {
            id: 'congestion',
            name: 'Hub Rush Hour',
            desc: 'Mass arrival at Hub Central to trigger grid density alerts.',
            icon: <Zap className="text-amber-500" size={18} />,
            color: 'from-amber-50/50 to-amber-100/50',
            border: 'border-amber-200'
        },
        {
            id: 'battery',
            name: 'Critical Battery Failsafe',
            desc: 'Long cross-campus mission with 35% battery — triggers Power Station divert.',
            icon: <Zap className="text-orange-500" size={18} fill="currentColor" />,
            color: 'from-orange-50/50 to-orange-100/50',
            border: 'border-orange-200'
        }
    ];

    const runScenario = async (id) => {
        setLoading(id);
        try {
            await axios.post(`${API_URL}/scenarios/run/${id}`);
        } catch (error) {
            console.error('Scenario failed:', error);
            alert('Failed to launch scenario. Check server connection.');
        } finally {
            setTimeout(() => setLoading(null), 1000);
        }
    };

    const resetEnv = async () => {
        setResetting(true);
        try {
            await axios.post(`${API_URL}/scenarios/reset`);
        } catch (error) {
            console.error('Reset failed:', error);
            alert('Failed to reset environment. Check server connection.');
        } finally {
            setTimeout(() => setResetting(false), 1200);
        }
    };

    const isDisabled = loading !== null || resetting;

    return (
        <div className="glass-card p-6 border border-navy-900/10 shadow-xl rounded-3xl space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-navy-900 font-sora font-black text-sm tracking-tight uppercase">
                        Evaluation Scenarios
                    </h3>
                    <p className="text-navy-500 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                        One-Click Demo Orchestration
                    </p>
                </div>
                <div className="p-2 bg-navy-50 rounded-xl">
                    <Play className="text-navy-900" size={16} fill="currentColor" />
                </div>
            </div>

            <div className="grid gap-4">
                {scenarios.map((s) => (
                    <button
                        key={s.id}
                        disabled={isDisabled}
                        onClick={() => runScenario(s.id)}
                        className={`group relative text-left p-4 rounded-2xl border ${s.border} bg-gradient-to-br ${s.color} hover:scale-[1.02] active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:scale-100 shadow-sm hover:shadow-md overflow-hidden`}
                    >
                        {loading === s.id && (
                            <div className="absolute inset-0 bg-white/40 flex items-center justify-center backdrop-blur-[1px] z-10">
                                <RefreshCcw className="animate-spin text-navy-900" size={20} />
                            </div>
                        )}
                        <div className="flex items-start gap-3">
                            <div className="p-2.5 bg-white rounded-xl shadow-inner group-hover:bg-navy-900 group-hover:text-white transition-colors duration-300">
                                {s.icon}
                            </div>
                            <div>
                                <h4 className="text-navy-900 font-black text-xs uppercase tracking-tight">
                                    {s.name}
                                </h4>
                                <p className="text-navy-600 text-[9px] font-bold leading-relaxed mt-1 opacity-80 uppercase italic">
                                    {s.desc}
                                </p>
                            </div>
                        </div>
                        
                        <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-100 transition-opacity">
                             <Play size={12} fill="currentColor" />
                        </div>
                    </button>
                ))}
            </div>

            {/* Reset Button */}
            <button
                disabled={isDisabled}
                onClick={resetEnv}
                className="group w-full flex items-center justify-center gap-2 p-3 rounded-2xl border border-red-200 bg-gradient-to-br from-red-50/60 to-red-100/60 hover:from-red-100 hover:to-red-200 active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:scale-100 shadow-sm hover:shadow-md"
            >
                {resetting
                    ? <RefreshCcw className="animate-spin text-red-500" size={15} />
                    : <RotateCcw className="text-red-500 group-hover:rotate-[-30deg] transition-transform duration-300" size={15} />
                }
                <span className="text-red-600 font-black text-[10px] uppercase tracking-widest">
                    {resetting ? 'Resetting...' : 'Reset Environment'}
                </span>
            </button>
        </div>
    );
};

export default ScenarioPanel;
