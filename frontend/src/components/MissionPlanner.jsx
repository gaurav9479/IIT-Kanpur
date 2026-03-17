import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Send, MapPin, Navigation, Trash2 } from 'lucide-react';
import axios from 'axios';

// Fix for default marker icons in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const LocationMarker = ({ setPoint, label, color }) => {
  const customIcon = new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  return null; // Logic is handled in the parent click event
};

const MissionPlanner = () => {
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [isDeploying, setIsDeploying] = useState(false);

  const MapEvents = () => {
    useMapEvents({
      click(e) {
        if (!origin) {
          setOrigin(e.latlng);
        } else if (!destination) {
          setDestination(e.latlng);
        }
      },
    });
    return null;
  };

  const handleDeploy = async () => {
    if (!origin || !destination) return;
    setIsDeploying(true);
    try {
      await axios.post('http://localhost:5001/api/v1/orders', {
        pickupLocation: { lat: origin.lat, lng: origin.lng },
        dropLocation: { lat: destination.lat, lng: destination.lng },
        weight: 1.5, // Standard simulated payload
      });
      alert('Mission Deployed Successfully!');
      setOrigin(null);
      setDestination(null);
    } catch (error) {
      console.error('Deployment Failed:', error.message);
      alert('Failed to deploy mission.');
    } finally {
      setIsDeploying(false);
    }
  };

  const center = [26.5123, 80.2321]; // IIT Kanpur Center

  return (
    <div className="flex-1 flex flex-col h-full bg-white border-l border-navy-900/5 overflow-hidden">
      <div className="p-8 pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-sora font-black text-navy-900 tracking-tighter uppercase">Mission Logistics Planner</h2>
          <p className="text-navy-600 text-[10px] font-black uppercase tracking-widest mt-1">Authorized Flight Vector Configuration Node</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => { setOrigin(null); setDestination(null); }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white-soft hover:bg-navy-900 hover:text-white text-navy-900 font-black uppercase text-[10px] tracking-widest transition-all border border-navy-900/10 shadow-sm"
          >
            <Trash2 size={16} /> Purge Coordinates
          </button>
          <button 
            disabled={!origin || !destination || isDeploying}
            onClick={handleDeploy}
            className={`flex items-center gap-2 px-8 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl ${
              (!origin || !destination) ? 'bg-white-muted text-navy-600 cursor-not-allowed opacity-50' : 'bg-navy-900 text-white hover:scale-105 active:scale-95 shadow-navy-900/20 shadow-2xl'
            }`}
          >
            <Send size={16} /> {isDeploying ? 'Deploying...' : 'Deploy Autonomous Vector'}
          </button>
        </div>
      </div>

      <div className="flex-1 m-8 mt-4 rounded-3xl overflow-hidden glass-card relative border border-navy-900/10 shadow-2xl">
        <MapContainer 
          center={center} 
          zoom={15} 
          className="h-full w-full z-0"
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <MapEvents />
          
          {origin && (
            <Marker 
              position={origin} 
              icon={new L.Icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-black.png',
                iconSize: [25, 41], iconAnchor: [12, 41]
              })} 
            />
          )}
          {destination && (
            <Marker 
              position={destination} 
              icon={new L.Icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                iconSize: [25, 41], iconAnchor: [12, 41]
              })} 
            />
          )}
          {origin && destination && (
            <Polyline 
              positions={[origin, destination]} 
              color="#0d1b2a" 
              weight={3} 
              dashArray="8, 8"
              className="animate-pulse"
            />
          )}
        </MapContainer>

        <div className="absolute bottom-10 left-10 z-10 space-y-4">
          <div className="glass-card p-5 flex items-center gap-5 bg-white border border-navy-900/20 shadow-2xl">
            <div className={`w-3.5 h-3.5 rounded-full ${origin ? 'bg-navy-900' : 'bg-white-muted'}`}></div>
            <div>
              <p className="text-[9px] font-black text-navy-600 uppercase tracking-widest">Departure Link</p>
              <p className="text-xs font-black text-navy-900 tracking-widest">
                {origin ? `${origin.lat.toFixed(6)}, ${origin.lng.toFixed(6)}` : 'Awaiting Uplink...'}
              </p>
            </div>
          </div>
          <div className="glass-card p-5 flex items-center gap-5 bg-white border border-navy-900/20 shadow-2xl">
            <div className={`w-3.5 h-3.5 rounded-full ${destination ? 'bg-navy-900 shadow-[0_0_15px_rgba(13,27,42,0.4)]' : 'bg-white-muted'}`}></div>
            <div>
              <p className="text-[9px] font-black text-navy-600 uppercase tracking-widest">Arrival Target</p>
              <p className="text-xs font-black text-navy-900 tracking-widest">
                {destination ? `${destination.lat.toFixed(6)}, ${destination.lng.toFixed(6)}` : 'Awaiting Target Lock...'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MissionPlanner;
