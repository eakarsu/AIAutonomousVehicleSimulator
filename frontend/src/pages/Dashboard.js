import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboard } from '../services/api';
import { features } from '../App';

function Dashboard({ onLogout, theme, setTheme }) {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    loadStats();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    let gPressed = false;
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (gPressed) {
        gPressed = false;
        switch (e.key.toLowerCase()) {
          case 'p': navigate('/profile'); break;
          case 'a': navigate('/analytics'); break;
          case 's': navigate('/settings'); break;
          case 'f': navigate('/favorites'); break;
          case 'l': navigate('/audit-log'); break;
          default: break;
        }
        return;
      }
      if (e.key === 'g') { gPressed = true; setTimeout(() => { gPressed = false; }, 1000); return; }
      if (e.key === '/') { e.preventDefault(); document.querySelector('.dashboard-search')?.focus(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  const loadStats = async () => {
    try {
      const res = await dashboard.getStats();
      setStats(res.data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalRecords = Object.values(stats).reduce((sum, val) => sum + (val || 0), 0);
  const filteredFeatures = features.filter(f =>
    f.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <>
        <nav className="navbar">
          <div className="navbar-brand" onClick={() => navigate('/dashboard')}>
            <span>🚗</span>
            <h2>AV Simulator</h2>
          </div>
        </nav>
        <div className="loading-container"><div className="loading-spinner"></div></div>
      </>
    );
  }

  return (
    <>
      <nav className="navbar">
        <div className="navbar-brand" onClick={() => navigate('/dashboard')}>
          <span>🚗</span>
          <h2>AV Simulator</h2>
        </div>
        <div className="navbar-right">
          <button className="nav-icon-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Toggle theme">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button className="nav-icon-btn" onClick={() => navigate('/favorites')} title="Favorites">⭐</button>
          <button className="nav-icon-btn" onClick={() => navigate('/analytics')} title="Analytics">📈</button>
          <span className="navbar-user" onClick={() => navigate('/profile')} style={{cursor: 'pointer'}} title="Profile">
            Welcome, {user.name || 'User'}
          </span>
          <button className="logout-btn" onClick={onLogout}>Logout</button>
        </div>
      </nav>
      <div className="dashboard">
        <div className="dashboard-header">
          <div>
            <h1>Command Center</h1>
            <p>AI Autonomous Vehicle Simulator - Training & Testing Platform</p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="quick-stats">
          <div className="quick-stat-card">
            <div className="quick-stat-value">{totalRecords}</div>
            <div className="quick-stat-label">Total Records</div>
          </div>
          <div className="quick-stat-card">
            <div className="quick-stat-value">{features.length}</div>
            <div className="quick-stat-label">Modules</div>
          </div>
          <div className="quick-stat-card">
            <div className="quick-stat-value">{stats.simulationResults || 0}</div>
            <div className="quick-stat-label">Simulations</div>
          </div>
          <div className="quick-stat-card">
            <div className="quick-stat-value">{stats.fleetVehicles || 0}</div>
            <div className="quick-stat-label">Fleet Size</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="quick-actions">
          <button className="quick-action-btn" onClick={() => navigate('/profile')}>👤 Profile</button>
          <button className="quick-action-btn" onClick={() => navigate('/analytics')}>📈 Analytics</button>
          <button className="quick-action-btn" onClick={() => navigate('/favorites')}>⭐ Favorites</button>
          <button className="quick-action-btn" onClick={() => navigate('/audit-log')}>📋 Audit Log</button>
          <button className="quick-action-btn" onClick={() => navigate('/settings')}>⚙️ Settings</button>
        </div>

        {/* Search */}
        <div className="dashboard-search-container">
          <input
            type="text"
            className="dashboard-search"
            placeholder="Search modules... (press / to focus)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="feature-grid">
          {filteredFeatures.map(f => (
            <div
              key={f.key}
              className="feature-card"
              style={{ '--card-color': f.color }}
              onClick={() => navigate(`/${f.path}`)}
            >
              <span className="card-icon">{f.icon}</span>
              <div className="card-title">{f.title}</div>
              <div className="card-count">{stats[f.key] || 0}</div>
              <div className="card-label">Total Records</div>
            </div>
          ))}
        </div>

        {filteredFeatures.length === 0 && (
          <div className="empty-state">
            <h3>No modules match "{searchTerm}"</h3>
          </div>
        )}
      </div>
    </>
  );
}

export default Dashboard;
