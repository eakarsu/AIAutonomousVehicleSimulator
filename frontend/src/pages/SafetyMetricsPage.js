import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { analytics } from '../services/api';

/**
 * Safety Metrics Dashboard.
 * GET /api/analytics/safety-metrics — pass/fail rate, score by category, most failed, collisions by speed.
 */
function SafetyMetricsPage({ onLogout }) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analytics.safetyMetrics()
      .then((res) => setData(res.data))
      .catch(() => toast.error('Failed to load safety metrics'))
      .finally(() => setLoading(false));
  }, []);

  const barWidth = (val, max) => max > 0 ? `${(val / max) * 100}%` : '0%';

  return (
    <>
      <nav className="navbar">
        <div className="navbar-brand" onClick={() => navigate('/dashboard')}><span>🚗</span><h2>AV Simulator</h2></div>
        <div className="navbar-right">
          <span className="navbar-user">{user.name || 'User'}</span>
          <button className="logout-btn" onClick={onLogout}>Logout</button>
        </div>
      </nav>
      <div className="analytics-page">
        <div className="feature-header">
          <div className="feature-header-left">
            <button className="back-btn" onClick={() => navigate('/dashboard')}>← Back</button>
            <h1>🛡️ Safety Metrics Dashboard</h1>
          </div>
        </div>

        {loading && <div>Loading…</div>}

        {data && (
          <>
            <div className="quick-stats">
              <div className="quick-stat-card"><div className="quick-stat-value">{data.run_summary?.total_simulations || 0}</div><div className="quick-stat-label">Total Runs</div></div>
              <div className="quick-stat-card"><div className="quick-stat-value">{data.run_summary?.completed || 0}</div><div className="quick-stat-label">Completed</div></div>
              <div className="quick-stat-card"><div className="quick-stat-value">{data.run_summary?.failed || 0}</div><div className="quick-stat-label">Failed</div></div>
              <div className="quick-stat-card"><div className="quick-stat-value">{data.run_summary?.pass_rate_pct || 0}%</div><div className="quick-stat-label">Pass Rate</div></div>
            </div>

            <div className="analytics-grid">
              <div className="analytics-card">
                <h3>Avg Safety Score by Category</h3>
                {(data.safety_by_scenario || []).length === 0 && <div style={{ color: '#94a3b8' }}>No data</div>}
                {(data.safety_by_scenario || []).map((row, i) => {
                  const max = Math.max(...data.safety_by_scenario.map((r) => parseFloat(r.avg_score) || 0));
                  return (
                    <div key={i} className="bar-row">
                      <span className="bar-label">{row.category}</span>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: barWidth(parseFloat(row.avg_score) || 0, max), background: '#34d399' }}></div>
                      </div>
                      <span className="bar-value">{row.avg_score}</span>
                    </div>
                  );
                })}
              </div>

              <div className="analytics-card">
                <h3>Most Failed Scenarios</h3>
                {(data.most_failed_scenarios || []).length === 0 && <div style={{ color: '#94a3b8' }}>No data</div>}
                <table className="data-table">
                  <thead><tr><th>Scenario</th><th>Runs</th><th>Collisions</th><th>Avg Success</th></tr></thead>
                  <tbody>
                    {(data.most_failed_scenarios || []).map((row, i) => (
                      <tr key={i}>
                        <td>{row.scenarioName}</td>
                        <td>{row.total_runs}</td>
                        <td style={{ color: row.total_collisions > 0 ? '#f87171' : '#94a3b8' }}>{row.total_collisions}</td>
                        <td>{row.avg_success_rate ? `${parseFloat(row.avg_success_rate).toFixed(1)}%` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="analytics-card wide">
                <h3>Collision Frequency by Speed Range</h3>
                {(data.collision_frequency_by_speed || []).length === 0 && <div style={{ color: '#94a3b8' }}>No data</div>}
                {(data.collision_frequency_by_speed || []).map((row, i) => {
                  const max = Math.max(...data.collision_frequency_by_speed.map((r) => parseInt(r.collision_count, 10) || 0));
                  return (
                    <div key={i} className="bar-row">
                      <span className="bar-label">{row.speed_range}</span>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: barWidth(parseInt(row.collision_count, 10), max), background: '#f87171' }}></div>
                      </div>
                      <span className="bar-value">{row.collision_count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default SafetyMetricsPage;
