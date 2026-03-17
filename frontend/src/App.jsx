import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { io } from 'socket.io-client';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import StatsOverview from './components/StatsOverview';
import DroneGrid from './components/DroneGrid';
import SafetyAlerts from './components/SafetyAlerts';
import MissionPlanner from './components/MissionPlanner';

const socket = io('http://localhost:5001');

const DashboardOverview = ({ drones, alerts }) => (
  <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 custom-scrollbar">
    <StatsOverview drones={Object.values(drones)} />
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <div className="lg:col-span-3">
        <DroneGrid drones={Object.values(drones)} />
      </div>
      <div className="lg:col-span-1">
        <SafetyAlerts alerts={alerts} />
      </div>
    </div>
  </main>
);

function App() {
  const [drones, setDrones] = useState({});
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    socket.on('connect', () => console.log('Connected to UTM Backend'));
    
    socket.on('telemetry_update', (data) => {
      setDrones(prev => ({ ...prev, [data.droneId]: data }));
    });

    socket.on('safety_alert', (alert) => {
      setAlerts(prev => [alert, ...prev].slice(0, 10));
    });

    return () => {
      socket.off('telemetry_update');
      socket.off('safety_alert');
    };
  }, []);

  return (
    <Router>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header />
          <Routes>
            <Route path="/" element={<DashboardOverview drones={drones} alerts={alerts} />} />
            <Route path="/planner" element={<MissionPlanner />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
