import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { io } from 'socket.io-client';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import MetricsDashboard from './components/MetricsDashboard';
import DroneGrid from './components/DroneGrid';
import SafetyAlerts from './components/SafetyAlerts';
import MissionPlanner from './components/MissionPlanner';
import EventLogPanel from './components/EventLogPanel';
import DecisionExplanationPanel from './components/DecisionExplanationPanel';
import OrderTracking from './components/OrderTracking';
import LiveFleetMap from './components/LiveFleetMap';
import MissionHistoryPage from './components/MissionHistoryPage';

const socket = io('http://localhost:5001');

const DashboardOverview = ({ drones, alerts }) => (
  <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 custom-scrollbar">
    <MetricsDashboard />
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <div className="lg:col-span-3 space-y-8">
        <LiveFleetMap drones={drones} />
        <DroneGrid drones={Object.values(drones)} />
      </div>
      <div className="lg:col-span-1 space-y-8">
        <SafetyAlerts alerts={alerts} />
        <DecisionExplanationPanel />
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
          <div className="flex-1 flex min-h-0 overflow-hidden relative">
            <div className="flex-1 overflow-hidden relative">
              <Routes>
                <Route path="/" element={<DashboardOverview drones={drones} alerts={alerts} />} />
                <Route path="/planner" element={<MissionPlanner />} />
                <Route path="/tracking/:orderId?" element={<OrderTracking />} />
                <Route path="/history" element={<MissionHistoryPage />} />
              </Routes>
            </div>
            <EventLogPanel />
          </div>
        </div>
      </div>
    </Router>
  );
}

export default App;
