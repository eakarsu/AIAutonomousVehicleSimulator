import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { aiExtended } from '../services/api';

/**
 * AI Scenario Generation & Safety Assessment.
 * POST /api/ai/scenario-generate
 * POST /api/ai/safety-assessment
 */
function AIScenarioSafetyPage({ onLogout }) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [tab, setTab] = useState('generate');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  // Scenario Generation form
  const [genForm, setGenForm] = useState({
    seed_description: 'Highway merge in heavy rain at dusk with debris on shoulder',
    odd: 'highway, 100km/h limit, multi-lane, urban-fringe',
    target_count: 5,
    severity_focus: 'edge_case',
  });

  // Safety Assessment form
  const [safForm, setSafForm] = useState({
    feature_description: 'Automatic Emergency Braking activates when forward radar detects unavoidable closing speed > 25 km/h',
    odd: 'urban driving, 0-60 km/h, dry pavement, daylight',
    autonomy_level: 2,
    failure_modes: 'sensor occlusion in heavy rain, false-positive on overhanging signs, late detection of pedestrians at night',
  });

  const runGenerate = async () => {
    setLoading(true); setResult(null);
    try {
      const res = await aiExtended.scenarioGenerate({
        seed_description: genForm.seed_description,
        odd: genForm.odd,
        target_count: parseInt(genForm.target_count, 10),
        severity_focus: genForm.severity_focus,
      });
      setResult(res.data);
    } catch (e) {
      toast.error(e.response?.data?.errors ? JSON.stringify(e.response.data.errors) : (e.response?.data?.error || e.message));
    } finally {
      setLoading(false);
    }
  };

  const runSafety = async () => {
    setLoading(true); setResult(null);
    try {
      const res = await aiExtended.safetyAssessment({
        feature_description: safForm.feature_description,
        odd: safForm.odd,
        autonomy_level: parseInt(safForm.autonomy_level, 10),
        failure_modes: safForm.failure_modes
          .split(',')
          .map(s => s.trim())
          .filter(Boolean),
      });
      setResult(res.data);
    } catch (e) {
      toast.error(e.response?.data?.errors ? JSON.stringify(e.response.data.errors) : (e.response?.data?.error || e.message));
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (k) => { setTab(k); setResult(null); };

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
            <h1>🧪 AI Scenario Generation & Safety Assessment</h1>
          </div>
        </div>

        <div className="analytics-card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button className={`add-btn ${tab !== 'generate' ? 'secondary' : ''}`} style={{ opacity: tab === 'generate' ? 1 : 0.6 }} onClick={() => switchTab('generate')}>Scenario Generation</button>
            <button className={`add-btn ${tab !== 'safety' ? 'secondary' : ''}`} style={{ opacity: tab === 'safety' ? 1 : 0.6 }} onClick={() => switchTab('safety')}>Safety Assessment</button>
          </div>

          {tab === 'generate' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label>Seed Description</label>
                <textarea rows={2} value={genForm.seed_description}
                  onChange={(e) => setGenForm({ ...genForm, seed_description: e.target.value })} />
              </div>
              <div>
                <label>Operational Design Domain (ODD)</label>
                <input type="text" value={genForm.odd}
                  onChange={(e) => setGenForm({ ...genForm, odd: e.target.value })} />
              </div>
              <div>
                <label>Target Count</label>
                <input type="number" min="1" max="20" value={genForm.target_count}
                  onChange={(e) => setGenForm({ ...genForm, target_count: e.target.value })} />
              </div>
              <div>
                <label>Severity Focus</label>
                <select value={genForm.severity_focus}
                  onChange={(e) => setGenForm({ ...genForm, severity_focus: e.target.value })}>
                  <option value="nominal">Nominal</option>
                  <option value="edge_case">Edge Case</option>
                  <option value="adversarial">Adversarial</option>
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <button className="add-btn" onClick={runGenerate} disabled={loading}>
                  {loading ? 'Generating…' : 'Generate Scenarios'}
                </button>
              </div>
            </div>
          )}

          {tab === 'safety' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label>Feature Description</label>
                <textarea rows={3} value={safForm.feature_description}
                  onChange={(e) => setSafForm({ ...safForm, feature_description: e.target.value })} />
              </div>
              <div>
                <label>Operational Design Domain (ODD)</label>
                <input type="text" value={safForm.odd}
                  onChange={(e) => setSafForm({ ...safForm, odd: e.target.value })} />
              </div>
              <div>
                <label>Autonomy Level (SAE)</label>
                <select value={safForm.autonomy_level}
                  onChange={(e) => setSafForm({ ...safForm, autonomy_level: e.target.value })}>
                  {[0, 1, 2, 3, 4, 5].map(l => <option key={l} value={l}>L{l}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label>Failure Modes (comma-separated)</label>
                <textarea rows={2} value={safForm.failure_modes}
                  onChange={(e) => setSafForm({ ...safForm, failure_modes: e.target.value })} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <button className="add-btn" onClick={runSafety} disabled={loading}>
                  {loading ? 'Assessing…' : 'Run Safety Assessment'}
                </button>
              </div>
            </div>
          )}
        </div>

        {result && (
          <div className="analytics-grid">
            <div className="analytics-card wide">
              <h3>🤖 {tab === 'generate' ? 'Generated Scenarios' : 'Safety Assessment'}</h3>
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 1.6, fontSize: 13 }}>
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default AIScenarioSafetyPage;
