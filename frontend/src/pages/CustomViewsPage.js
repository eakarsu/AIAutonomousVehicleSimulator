import React from 'react';
import { useNavigate } from 'react-router-dom';
import ScenarioCoverageMatrix from '../components/customViews/ScenarioCoverageMatrix';
import SensorFusionHeatmap from '../components/customViews/SensorFusionHeatmap';
import ScenarioSpecPdf from '../components/customViews/ScenarioSpecPdf';
import ScenarioEditor from '../components/customViews/ScenarioEditor';

/**
 * 4 custom AV-simulation views:
 *   VIZ:     ScenarioCoverageMatrix, SensorFusionHeatmap
 *   NON-VIZ: ScenarioSpecPdf, ScenarioEditor (CRUD: weather, traffic, road)
 */
function CustomViewsPage({ onLogout }) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

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

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 64px)' }}>
        <aside
          data-testid="sim-views-sidebar"
          style={{
            width: 220,
            background: '#0b1220',
            borderRight: '1px solid #1e293b',
            padding: '20px 14px',
          }}
        >
          <div style={{ color: '#94a3b8', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
            Sim Views
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <a href="#scenario-coverage" style={navLink}>🗺️ Coverage Matrix</a>
            <a href="#sensor-fusion"     style={navLink}>🔬 Sensor Fusion Heatmap</a>
            <a href="#scenario-spec-pdf" style={navLink}>📄 Scenario Spec PDF</a>
            <a href="#scenario-editor"   style={navLink}>✍️ Scenario Editor</a>
          </nav>
          <button
            onClick={() => navigate('/dashboard')}
            style={{ ...navLink, background: '#1e293b', color: '#e2e8f0', border: 'none', marginTop: 16, cursor: 'pointer', textAlign: 'left' }}
          >
            ← Back to Dashboard
          </button>
        </aside>

        <main style={{ flex: 1, padding: '24px 28px', background: '#020617' }}>
          <div style={{ marginBottom: 18 }}>
            <h1 style={{ color: '#e2e8f0', margin: 0 }} data-testid="custom-views-title">Sim Views</h1>
            <p style={{ color: '#94a3b8', marginTop: 4 }}>
              Operational visualisations and scenario tooling for AV simulation testing.
            </p>
          </div>

          <section id="scenario-coverage" style={section}>
            <ScenarioCoverageMatrix />
          </section>

          <section id="sensor-fusion" style={section}>
            <SensorFusionHeatmap />
          </section>

          <section id="scenario-spec-pdf" style={section}>
            <ScenarioSpecPdf />
          </section>

          <section id="scenario-editor" style={section}>
            <ScenarioEditor />
          </section>
        </main>
      </div>
    </>
  );
}

const navLink = {
  display: 'block',
  padding: '8px 10px',
  color: '#cbd5e1',
  textDecoration: 'none',
  borderRadius: 6,
  fontSize: 13,
  background: '#0f172a',
};

const section = { marginBottom: 22 };

export default CustomViewsPage;
