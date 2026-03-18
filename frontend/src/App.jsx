import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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
import FleetManagement from './components/FleetManagement';
import ActiveOrders from './components/ActiveOrders';
import AnalyticsPage from './components/AnalyticsPage';
import SafetyZones from './components/SafetyZones';
import SettingsPage from './components/SettingsPage';
import AddFleetPage from './components/AddFleetPage';
import { useSocket } from './hooks/useSocket';

const DashboardOverview = ({ drones, alerts, gridData, connected }) => (
  <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 custom-scrollbar">
    {/* Connection status banner */}
    {!connected && (
      <div className="bg-red-100 border border-red-300 text-red-700 text-xs font-bold px-4 py-2 rounded-xl uppercase tracking-widest text-center">
        ⚠️ Socket Disconnected — Reconnecting...
      </div>
    )}
    <MetricsDashboard drones={drones} />
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <div className="lg:col-span-3 space-y-8">
        {/* Map receives both drones and gridData */}
        <LiveFleetMap drones={drones} gridData={gridData} />
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
  // All real-time state managed centrally in one hook
  const { drones, alerts, eventLog, gridData, connected } = useSocket();

  return (
    <Router>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header connected={connected} />
          <div className="flex-1 flex min-h-0 overflow-hidden relative">
            <div className="flex-1 flex flex-col h-full overflow-hidden relative">
              <Routes>
                <Route
                  path="/"
                  element={
                    <DashboardOverview
                      drones={drones}
                      alerts={alerts}
                      gridData={gridData}
                      connected={connected}
                    />
                  }
                />
                <Route path="/planner" element={<MissionPlanner />} />
                <Route path="/tracking/:orderId?" element={<OrderTracking />} />
                <Route path="/history" element={<MissionHistoryPage />} />
                <Route path="/fleet" element={<FleetManagement />} />
                <Route path="/orders" element={<ActiveOrders />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/safety" element={<SafetyZones />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/add-fleet" element={<AddFleetPage />} />
              </Routes>
            </div>
            {/* EventLogPanel receives the log from the shared hook */}
            <EventLogPanel eventLog={eventLog} />
          </div>
        </div>
      </div>
    </Router>
  );
}

export default App;
