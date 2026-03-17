import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Play, Pause, FastForward, RotateCcw, Clock, Navigation, Map as MapIcon, Plane } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';


const MissionReplay = ({ missionData = null }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [mission, setMission] = useState(missionData);
  
  const timerRef = useRef(null);

  // Handle both [lat, lng] and {lat, lng, z} formats
  const trajectory = (mission?.trajectoryData || []).map(point => {
    if (Array.isArray(point)) return point;
    return [point.lat, point.lng];
  });

  // Fallback if empty
  if (trajectory.length === 0) {
    trajectory.push([26.5123, 80.2321], [26.5130, 80.2330], [26.5140, 80.2340]);
  }

  useEffect(() => {
    if (isPlaying && currentIndex < trajectory.length - 1) {
      timerRef.current = setInterval(() => {
        setCurrentIndex(prev => {
          if (prev >= trajectory.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 500 / playbackSpeed); // Base speed 500ms per point
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isPlaying, playbackSpeed, trajectory.length, currentIndex]);

  const togglePlay = () => setIsPlaying(!isPlaying);
  const resetPlayback = () => {
    setIsPlaying(false);
    setCurrentIndex(0);
  };

  const handleSliderChange = (e) => {
    setCurrentIndex(parseInt(e.target.value));
    setIsPlaying(false);
  };

  const droneIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/2965/2965311.png',
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });

  const center = trajectory[0] || [26.5123, 80.2321];

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Replay Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-sora font-black text-navy-900 tracking-tighter uppercase flex items-center gap-3">
            <RotateCcw className={isPlaying ? 'animate-spin-slow' : ''} /> Mission Replay OS
          </h2>
          <p className="text-navy-600 text-[10px] font-black uppercase tracking-widest mt-1">
            Historical Vector Analysis & Telemetry Reconstruction
          </p>
        </div>
        <div className="flex bg-navy-900 rounded-xl p-1 gap-1 shadow-xl">
          {[1, 2, 4].map(speed => (
            <button
              key={speed}
              onClick={() => setPlaybackSpeed(speed)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-all ${
                playbackSpeed === speed ? 'bg-white text-navy-900 shadow-lg' : 'text-white/40 hover:text-white'
              }`}
            >
              {speed}X
            </button>
          ))}
        </div>
      </div>

      {/* Map Content */}
      <div className="flex-1 relative rounded-3xl overflow-hidden glass-card border border-navy-900/10 shadow-2xl min-h-[400px]">
        <MapContainer center={center} zoom={16} className="h-full w-full z-0">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          
          {/* Full Planned Path */}
          <Polyline 
            positions={trajectory} 
            color="#0d1b2a" 
            weight={3} 
            opacity={0.2} 
            dashArray="10, 10" 
          />
          
          {/* Reproduced Path */}
          <Polyline 
            positions={trajectory.slice(0, currentIndex + 1)} 
            color="#0d1b2a" 
            weight={4} 
          />

          {/* Current Drone Position */}
          {trajectory[currentIndex] && (
            <Marker position={trajectory[currentIndex]} icon={droneIcon}>
              <Popup>
                <div className="p-2 text-center">
                  <p className="font-black text-navy-900 text-xs">REPLAY ACTIVE</p>
                  <p className="text-[10px] text-navy-600 font-bold uppercase mt-1">
                    Index: {currentIndex} / {trajectory.length - 1}
                  </p>
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>

        {/* Playback HUD */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[1000] w-[90%] max-w-2xl">
          <div className="glass-card p-6 bg-white/90 backdrop-blur-2xl border border-navy-900/5 shadow-2xl space-y-6">
            
            {/* Timeline Slider */}
            <div className="relative pt-1">
              <input
                type="range"
                min="0"
                max={trajectory.length - 1}
                value={currentIndex}
                onChange={handleSliderChange}
                className="w-full h-1.5 bg-navy-900/10 rounded-lg appearance-none cursor-pointer accent-navy-900"
              />
              <div className="flex justify-between mt-2">
                <span className="text-[9px] font-black text-navy-600 uppercase tracking-widest">T-Start</span>
                <span className="text-[9px] font-black text-navy-600 uppercase tracking-widest">T-Final</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <button 
                  onClick={togglePlay}
                  className="w-12 h-12 bg-navy-900 rounded-2xl flex items-center justify-center text-white shadow-xl hover:scale-110 active:scale-95 transition-all shadow-navy-900/20"
                >
                  {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                </button>
                <button 
                  onClick={resetPlayback}
                  className="p-3 text-navy-600 hover:text-navy-900 transition-colors"
                >
                  <RotateCcw size={20} />
                </button>
              </div>

              <div className="flex items-center gap-8 text-right">
                <div className="hidden sm:block">
                   <p className="text-[9px] font-black text-navy-600 uppercase tracking-widest">Progress</p>
                   <p className="text-xl font-sora font-black text-navy-900 tracking-tighter">
                     {Math.round((currentIndex / (trajectory.length - 1)) * 100)}%
                   </p>
                </div>
                <div>
                   <p className="text-[9px] font-black text-navy-600 uppercase tracking-widest">Active Speed</p>
                   <p className="text-xl font-sora font-black text-navy-900 tracking-tighter">{playbackSpeed}X</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MissionReplay;
