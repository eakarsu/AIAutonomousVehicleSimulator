
import FullAIExamples, { useFullAIExamples } from "../components/FullAIExamples.jsx";
import FormattedAIReport from "../components/FormattedAIReport";
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
  const fullAIExamples = useFullAIExamples();

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
        domain: genForm.odd,
        difficulty: genForm.severity_focus === 'nominal' ? 'easy' : genForm.severity_focus === 'adversarial' ? 'hard' : 'edge_case',
        count: parseInt(genForm.target_count, 10),
        constraints: { seed_description: genForm.seed_description, operational_design_domain: genForm.odd },
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
        vehicle_context: { feature_description: safForm.feature_description, odd: safForm.odd },
        sae_level: parseInt(safForm.autonomy_level, 10),
        failure_events: safForm.failure_modes
          .split(',')
          .map((mode, index) => ({ event_ref: index + 1, description: mode.trim() }))
          .filter((event) => event.description),
      });
      setResult(res.data);
    } catch (e) {
      toast.error(e.response?.data?.errors ? JSON.stringify(e.response.data.errors) : (e.response?.data?.error || e.message));
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (k) => { setTab(k); setResult(null); };
  const generationExamples = [
    { seed_description: 'Rainy highway merge at dusk with a stopped vehicle on the shoulder', odd: 'divided highway, 80–110 km/h, wet pavement, low visibility', target_count: 5, severity_focus: 'edge_case' },
    { seed_description: 'Urban intersection with a cyclist emerging from behind a parked van', odd: 'urban streets, 0–50 km/h, dry pavement, daylight', target_count: 8, severity_focus: 'adversarial' },
    { seed_description: 'Suburban school zone with a pedestrian at a marked crossing', odd: 'residential roads, 0–40 km/h, clear weather, morning', target_count: 4, severity_focus: 'nominal' },
  ];
  const safetyExamples = [
    { feature_description: 'Automatic emergency braking for a lead vehicle stopping suddenly', odd: 'urban streets, 0–60 km/h, dry pavement, daylight', autonomy_level: 2, failure_modes: 'radar occlusion, false positive from overhead signs, delayed brake response' },
    { feature_description: 'Lane keeping assistance through a highway construction zone', odd: 'highway, 60–100 km/h, temporary lane markings, dusk', autonomy_level: 2, failure_modes: 'faded markings, conflicting temporary signs, cut-in vehicle' },
    { feature_description: 'Automated pedestrian yielding at a signalized crossing', odd: 'urban intersection, 0–40 km/h, rain, night', autonomy_level: 3, failure_modes: 'pedestrian occlusion, glare, sensor degradation in rain' },
  ];

  return (
    <div data-full-ai-workspace="AIScenarioSafetyPage"><FullAIExamples controller={fullAIExamples} disabled={Boolean(loading)} />
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
          <div className="ai-actions" style={{ marginBottom: 16 }}>
            {['Highway', 'Urban', 'Suburban'].map((label, index) => <button key={label} type="button" className="btn btn-secondary" disabled={loading} onClick={() => tab === 'generate' ? setGenForm(generationExamples[index]) : setSafForm(safetyExamples[index])}>Fill {label} example</button>)}
          </div>

          {tab === 'generate' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label>Seed Description</label>
                <textarea rows={2} value={genForm.seed_description}
                  onChange={(e) => setGenForm({ ...genForm, seed_description: e.target.value })} data-full-ai-field={fullAIExamples.bind({ current: genForm.seed_description, change: (e) => setGenForm({ ...genForm, seed_description: e.target.value }), label: "genForm.seed_description", manual: false, json: false, sample: 'Highway merge in heavy rain at dusk with debris on shoulder' }, "p1-4108", undefined)} />
              </div>
              <div>
                <label>Operational Design Domain (ODD)</label>
                <input type="text" value={genForm.odd}
                  onChange={(e) => setGenForm({ ...genForm, odd: e.target.value })} data-full-ai-field={fullAIExamples.bind({ current: genForm.odd, change: (e) => setGenForm({ ...genForm, odd: e.target.value }), label: "genForm.odd", manual: false, json: false, sample: 'highway, 100km/h limit, multi-lane, urban-fringe' }, "p1-4380", undefined)} />
              </div>
              <div>
                <label>Target Count</label>
                <input type="number" min="1" max="10" value={genForm.target_count}
                  onChange={(e) => setGenForm({ ...genForm, target_count: e.target.value })} data-full-ai-field={fullAIExamples.bind({ current: genForm.target_count, change: (e) => setGenForm({ ...genForm, target_count: e.target.value }), label: "genForm.target_count", manual: false, json: false, sample: 5 }, "p1-4607", undefined)} />
              </div>
              <div>
                <label>Severity Focus</label>
                <select value={genForm.severity_focus}
                  onChange={(e) => setGenForm({ ...genForm, severity_focus: e.target.value })} data-full-ai-field={fullAIExamples.bind({ current: genForm.severity_focus, change: (e) => setGenForm({ ...genForm, severity_focus: e.target.value }), label: "genForm.severity_focus", manual: false, json: false, sample: 'edge_case' }, "p1-4873", undefined)}>
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
                  onChange={(e) => setSafForm({ ...safForm, feature_description: e.target.value })} data-full-ai-field={fullAIExamples.bind({ current: safForm.feature_description, change: (e) => setSafForm({ ...safForm, feature_description: e.target.value }), label: "safForm.feature_description", manual: false, json: false, sample: 'Automatic Emergency Braking activates when forward radar detects unavoidable closing speed > 25 km/h' }, "p1-5770", undefined)} />
              </div>
              <div>
                <label>Operational Design Domain (ODD)</label>
                <input type="text" value={safForm.odd}
                  onChange={(e) => setSafForm({ ...safForm, odd: e.target.value })} data-full-ai-field={fullAIExamples.bind({ current: safForm.odd, change: (e) => setSafForm({ ...safForm, odd: e.target.value }), label: "safForm.odd", manual: false, json: false, sample: 'urban driving, 0-60 km/h, dry pavement, daylight' }, "p1-6048", undefined)} />
              </div>
              <div>
                <label>Autonomy Level (SAE)</label>
                <select value={safForm.autonomy_level}
                  onChange={(e) => setSafForm({ ...safForm, autonomy_level: e.target.value })} data-full-ai-field={fullAIExamples.bind({ current: safForm.autonomy_level, change: (e) => setSafForm({ ...safForm, autonomy_level: e.target.value }), label: "safForm.autonomy_level", manual: false, json: false, sample: 2 }, "p1-6283", undefined)}>
                  {[0, 1, 2, 3, 4, 5].map(l => <option key={l} value={l}>L{l}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label>Failure Modes (comma-separated)</label>
                <textarea rows={2} value={safForm.failure_modes}
                  onChange={(e) => setSafForm({ ...safForm, failure_modes: e.target.value })} data-full-ai-field={fullAIExamples.bind({ current: safForm.failure_modes, change: (e) => setSafForm({ ...safForm, failure_modes: e.target.value }), label: "safForm.failure_modes", manual: false, json: false, sample: 'sensor occlusion in heavy rain, false-positive on overhanging signs, late detection of pedestrians at night' }, "p1-6686", undefined)} />
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
              <FormattedAIReport response={result} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AIScenarioSafetyPage;
