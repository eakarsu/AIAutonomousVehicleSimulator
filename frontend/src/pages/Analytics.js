import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboard } from '../services/api';
import { toast } from 'react-toastify';

function Analytics({ onLogout }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const res = await dashboard.getAnalytics();
      setData(res.data);
    } catch (err) {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const getBarWidth = (value, max) => max > 0 ? `${(value / max) * 100}%` : '0%';

  const statusColors = {
    active: '#34d399', completed: '#34d399', testing: '#fbbf24', running: '#fbbf24',
    inactive: '#f87171', failed: '#f87171', pending: '#f87171', prototype: '#a5b4fc',
    maintenance: '#a5b4fc', operational: '#34d399', production: '#34d399'
  };

  const riskColors = {
    'Very Low': '#34d399', 'Low': '#6ee7b7', 'Medium': '#fbbf24', 'High': '#f97316', 'Critical': '#ef4444'
  };

  const gradeColors = {
    'A+': '#22c55e', 'A': '#34d399', 'A-': '#6ee7b7', 'B+': '#fbbf24', 'B': '#f59e0b',
    'B-': '#f97316', 'C+': '#fb923c', 'C': '#ef4444', 'D': '#dc2626', 'F': '#991b1b'
  };

  if (loading) {
    return (
      <>
        <nav className="navbar">
          <div className="navbar-brand" onClick={() => navigate('/dashboard')}>
            <span>🚗</span><h2>AV Simulator</h2>
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
          <span className="navbar-user">{user.name || 'User'}</span>
          <button className="logout-btn" onClick={onLogout}>Logout</button>
        </div>
      </nav>
      <div className="analytics-page">
        <div className="feature-header">
          <div className="feature-header-left">
            <button className="back-btn" onClick={() => navigate('/dashboard')}>← Back</button>
            <h1>Analytics Dashboard</h1>
          </div>
        </div>

        {data && (
          <div className="analytics-grid">
            {/* Status Distribution */}
            <div className="analytics-card">
              <h3>Status Distribution</h3>
              <div className="chart-container">
                {Object.entries(data.statusCounts).map(([model, statuses]) => (
                  <div key={model} className="chart-group">
                    <div className="chart-group-label">{model.replace(/([A-Z])/g, ' $1').trim()}</div>
                    {Object.entries(statuses).map(([status, count]) => (
                      <div key={status} className="bar-row">
                        <span className="bar-label">{status}</span>
                        <div className="bar-track">
                          <div className="bar-fill" style={{
                            width: getBarWidth(count, Math.max(...Object.values(statuses))),
                            backgroundColor: statusColors[status] || '#94a3b8'
                          }}></div>
                        </div>
                        <span className="bar-value">{count}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Grade Distribution */}
            <div className="analytics-card">
              <h3>Simulation Grades</h3>
              <div className="chart-container">
                {Object.entries(data.gradeDistribution).map(([grade, count]) => (
                  <div key={grade} className="bar-row">
                    <span className="bar-label">{grade}</span>
                    <div className="bar-track">
                      <div className="bar-fill" style={{
                        width: getBarWidth(count, Math.max(...Object.values(data.gradeDistribution))),
                        backgroundColor: gradeColors[grade] || '#94a3b8'
                      }}></div>
                    </div>
                    <span className="bar-value">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk Distribution */}
            <div className="analytics-card">
              <h3>Safety Risk Levels</h3>
              <div className="chart-container">
                {Object.entries(data.riskDistribution).map(([risk, count]) => (
                  <div key={risk} className="bar-row">
                    <span className="bar-label">{risk}</span>
                    <div className="bar-track">
                      <div className="bar-fill" style={{
                        width: getBarWidth(count, Math.max(...Object.values(data.riskDistribution))),
                        backgroundColor: riskColors[risk] || '#94a3b8'
                      }}></div>
                    </div>
                    <span className="bar-value">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Fleet Battery */}
            <div className="analytics-card">
              <h3>Fleet Battery Levels</h3>
              <div className="chart-container">
                {data.fleetVehicles.map(v => (
                  <div key={v.name} className="bar-row">
                    <span className="bar-label">{v.name}</span>
                    <div className="bar-track">
                      <div className="bar-fill" style={{
                        width: `${v.batteryLevel || 0}%`,
                        backgroundColor: v.batteryLevel > 50 ? '#34d399' : v.batteryLevel > 20 ? '#fbbf24' : '#ef4444'
                      }}></div>
                    </div>
                    <span className="bar-value">{v.batteryLevel}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Training Sessions */}
            <div className="analytics-card wide">
              <h3>Training Sessions</h3>
              <div className="training-table">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Algorithm</th>
                      <th>Accuracy</th>
                      <th>Loss</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.trainingSessions.map(t => (
                      <tr key={t.name}>
                        <td>{t.name}</td>
                        <td>{t.algorithm}</td>
                        <td>{t.accuracy ? `${t.accuracy}%` : '-'}</td>
                        <td>{t.loss || '-'}</td>
                        <td><span className={`status-badge status-${(t.status || '').toLowerCase()}`}>{t.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="analytics-card wide">
              <h3>Recent Activity</h3>
              <div className="activity-list">
                {data.recentActivity.map((item, i) => (
                  <div key={i} className="activity-item">
                    <div className="activity-dot"></div>
                    <div className="activity-content">
                      <strong>{item.name}</strong>
                      <span className="activity-type">{item.type}</span>
                      {item.status && <span className={`status-badge status-${(item.status || '').toLowerCase().replace(/\s+/g, '-')}`}>{item.status}</span>}
                    </div>
                    <span className="activity-time">{new Date(item.updatedAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default Analytics;
