import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import FeaturePage from './pages/FeaturePage';
import Profile from './pages/Profile';
import Analytics from './pages/Analytics';
import AuditLogPage from './pages/AuditLogPage';
import FavoritesPage from './pages/FavoritesPage';
import Settings from './pages/Settings';
import './App.css';

const features = [
  { key: 'vehicleModels', path: 'vehicle-models', title: 'Vehicle Models', icon: '🚗', endpoint: 'vehicle-models', color: '#3b82f6' },
  { key: 'sensorConfigs', path: 'sensor-configs', title: 'Sensor Configurations', icon: '📡', endpoint: 'sensor-configs', color: '#8b5cf6' },
  { key: 'drivingScenarios', path: 'driving-scenarios', title: 'Driving Scenarios', icon: '🛣️', endpoint: 'driving-scenarios', color: '#10b981' },
  { key: 'trainingSessions', path: 'training-sessions', title: 'Training Sessions', icon: '🧠', endpoint: 'training-sessions', color: '#f59e0b' },
  { key: 'simulationResults', path: 'simulation-results', title: 'Simulation Results', icon: '📊', endpoint: 'simulation-results', color: '#ef4444' },
  { key: 'routePlans', path: 'route-plans', title: 'Route Planning', icon: '🗺️', endpoint: 'route-plans', color: '#06b6d4' },
  { key: 'objectDetections', path: 'object-detections', title: 'Object Detection', icon: '👁️', endpoint: 'object-detections', color: '#ec4899' },
  { key: 'trafficSimulations', path: 'traffic-simulations', title: 'Traffic Simulation', icon: '🚦', endpoint: 'traffic-simulations', color: '#f97316' },
  { key: 'weatherSimulations', path: 'weather-simulations', title: 'Weather Simulation', icon: '🌧️', endpoint: 'weather-simulations', color: '#6366f1' },
  { key: 'safetyMetrics', path: 'safety-metrics', title: 'Safety Metrics', icon: '🛡️', endpoint: 'safety-metrics', color: '#14b8a6' },
  { key: 'fleetVehicles', path: 'fleet-vehicles', title: 'Fleet Management', icon: '🚐', endpoint: 'fleet-vehicles', color: '#a855f7' },
  { key: 'mapEnvironments', path: 'map-environments', title: 'Map Environments', icon: '🌍', endpoint: 'map-environments', color: '#22c55e' },
  { key: 'aiModels', path: 'ai-models', title: 'AI Models', icon: '🤖', endpoint: 'ai-models', color: '#e11d48' },
  { key: 'collisionAnalyses', path: 'collision-analyses', title: 'Collision Analysis', icon: '💥', endpoint: 'collision-analyses', color: '#dc2626' },
  { key: 'regulatoryCompliances', path: 'regulatory-compliances', title: 'Regulatory Compliance', icon: '📋', endpoint: 'regulatory-compliances', color: '#0891b2' },
];

export { features };

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) setIsAuthenticated(true);
  }, []);

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleLogin = () => setIsAuthenticated(true);
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
  };

  return (
    <Router>
      <div className={`app theme-${theme}`}>
        <ToastContainer position="top-right" autoClose={3000} theme={theme} />
        <Routes>
          <Route path="/" element={
            isAuthenticated ? <Navigate to="/dashboard" /> : <Login onLogin={handleLogin} />
          } />
          <Route path="/dashboard" element={
            isAuthenticated ? <Dashboard onLogout={handleLogout} theme={theme} setTheme={setTheme} /> : <Navigate to="/" />
          } />
          <Route path="/profile" element={
            isAuthenticated ? <Profile onLogout={handleLogout} /> : <Navigate to="/" />
          } />
          <Route path="/analytics" element={
            isAuthenticated ? <Analytics onLogout={handleLogout} /> : <Navigate to="/" />
          } />
          <Route path="/audit-log" element={
            isAuthenticated ? <AuditLogPage onLogout={handleLogout} /> : <Navigate to="/" />
          } />
          <Route path="/favorites" element={
            isAuthenticated ? <FavoritesPage onLogout={handleLogout} /> : <Navigate to="/" />
          } />
          <Route path="/settings" element={
            isAuthenticated ? <Settings onLogout={handleLogout} theme={theme} setTheme={setTheme} /> : <Navigate to="/" />
          } />
          {features.map(f => (
            <Route key={f.key} path={`/${f.path}`} element={
              isAuthenticated ? <FeaturePage feature={f} onLogout={handleLogout} /> : <Navigate to="/" />
            } />
          ))}
        </Routes>
      </div>
    </Router>
  );
}

export default App;
