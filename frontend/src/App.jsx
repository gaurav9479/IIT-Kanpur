import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
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
import AirspaceControlPage from './components/AirspaceControlPage';
import SettingsPage from './components/SettingsPage';
import AddFleetPage from './components/AddFleetPage';
import ScenarioPanel from './components/ScenarioPanel';
import AIPredictionPanel from './components/AIPredictionPanel';
import WarningPanel from './components/WarningPanel';
import AltitudeLegend from './components/AltitudeLegend';
import { useSocket } from './hooks/useSocket';
import { useZones } from './hooks/useZones';

const DashboardOverview = ({ drones, alerts, gridData, warningDrones, connected, zones }) => (
  <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 custom-scrollbar">
    {/* Connection status banner */}
    {!connected && (
      <div className="bg-red-100 border border-red-300 text-red-700 text-xs font-bold px-4 py-2 rounded-xl uppercase tracking-widest text-center">
        ⚠️ Socket Disconnected — Reconnecting...
      </div>
    )}
    <MetricsDashboard drones={drones} />
    <div className="grid grid-cols-1 gap-8">
      <div className="w-full space-y-8">
        {/* Map receives both drones, gridData, and live zones */}
        <LiveFleetMap drones={drones} gridData={gridData} warningDrones={warningDrones} zones={zones} />
      </div>
      {/* ── Below the map panels ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <ScenarioPanel />
        </div>
        <div className="lg:col-span-1">
          <AltitudeLegend drones={drones} />
        </div>
        <div className="lg:col-span-1 space-y-8">
          <WarningPanel />
          <SafetyAlerts alerts={alerts} />
        </div>
      </div>
    </div>
  </main>
);

function App() {
  // All real-time state managed centrally in one hook
  const { drones, alerts, eventLog, gridData, warningDrones, connected } = useSocket();
  // Live airspace zones — shared between dashboard map and control page
  const { zones } = useZones();
  
  // Toggle state for Event Log sidebar
  const [showEventLog, setShowEventLog] = React.useState(false);

  return (
    <Router>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header connected={connected} showEventLog={showEventLog} setShowEventLog={setShowEventLog} />
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
                      warningDrones={warningDrones}
                      connected={connected}
                      zones={zones}
                    />
                  }
                />
                <Route path="/planner" element={<MissionPlanner />} />
                <Route path="/tracking/:orderId?" element={<OrderTracking />} />
                <Route path="/history" element={<MissionHistoryPage />} />
                <Route path="/fleet" element={<FleetManagement />} />
                <Route path="/orders" element={<ActiveOrders />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/ai" element={<AIPredictionPanel />} />
                <Route path="/safety" element={<AirspaceControlPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                {/* <Route path="/drone-sim" element={<DroneSimulationPage />} /> */} 
                <Route path="/add-fleet" element={<AddFleetPage />} />
              </Routes>
            </div>
            {/* EventLogPanel receives the log from the shared hook */}
            <AnimatePresence>
              {showEventLog && (
                <EventLogPanel 
                  eventLog={eventLog} 
                  onClose={() => setShowEventLog(false)} 
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </Router>
  );
}

export default App;
