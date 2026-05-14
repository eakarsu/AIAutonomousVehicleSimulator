import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { aiExtended, services } from '../services/api';

/**
 * Side-by-side AI comparison of two driving scenarios.
 * POST /api/ai/compare-scenarios { scenario_ids: [a, b] }
 */
function ScenarioComparisonPage({ onLogout }) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [scenarios, setScenarios] = useState([]);
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    services.drivingScenarios.getAll({ limit: 1000 })
      .then((res) => setScenarios(res.data?.data || res.data || []))
      .catch(() => toast.error('Failed to load scenarios'));
  }, []);

  const compare = async () => {
    if (!a || !b || a === b) { toast.error('Pick two different scenarios'); return; }
    setLoading(true); setResult(null);
    try {
      const res = await aiExtended.compareScenarios([parseInt(a, 10), parseInt(b, 10)]);
      setResult(res.data);
    } catch (e) {
      toast.error(e.response?.data?.errors ? JSON.stringify(e.response.data.errors) : (e.response?.data?.error || e.message));
    } finally {
      setLoading(false);
    }
  };

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
            <h1>🆚 Scenario Comparison (AI)</h1>
          </div>
        </div>

        <div className="analytics-card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end' }}>
            <div>
              <label>Scenario A</label>
              <select value={a} onChange={(e) => setA(e.target.value)}>
                <option value="">Select…</option>
                {scenarios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label>Scenario B</label>
              <select value={b} onChange={(e) => setB(e.target.value)}>
                <option value="">Select…</option>
                {scenarios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <button className="add-btn" onClick={compare} disabled={loading}>
              {loading ? 'Comparing…' : 'Compare'}
            </button>
          </div>
        </div>

        {result && (
          <div className="analytics-grid">
            <div className="analytics-card">
              <h3>Scenario A: {result.scenario_a?.name}</h3>
              <div>Category: {result.scenario_a?.category}</div>
              <div>Difficulty: {result.scenario_a?.difficulty}</div>
              <div>Weather: {result.scenario_a?.weatherCondition}</div>
              <div>Run history: {result.run_history_a?.count || 0} runs</div>
            </div>
            <div className="analytics-card">
              <h3>Scenario B: {result.scenario_b?.name}</h3>
              <div>Category: {result.scenario_b?.category}</div>
              <div>Difficulty: {result.scenario_b?.difficulty}</div>
              <div>Weather: {result.scenario_b?.weatherCondition}</div>
              <div>Run history: {result.run_history_b?.count || 0} runs</div>
            </div>
            <div className="analytics-card wide">
              <h3>🤖 AI Comparison</h3>
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 1.6 }}>{result.comparison}</pre>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default ScenarioComparisonPage;
