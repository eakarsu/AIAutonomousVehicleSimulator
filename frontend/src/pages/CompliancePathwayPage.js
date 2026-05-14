import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { aiExtended, services } from '../services/api';

/**
 * Regulatory Pathway Assistant.
 * POST /api/ai/compliance-check { vehicle_id, jurisdiction }
 */
const JURISDICTIONS = [
  { code: 'US', label: 'United States (NHTSA, FMVSS, SAE J3016)' },
  { code: 'EU', label: 'European Union (EU 2019/2144, UNECE WP.29)' },
  { code: 'UK', label: 'United Kingdom (CCAV)' },
  { code: 'CN', label: 'China (GB, MIIT)' },
  { code: 'JP', label: 'Japan (MLIT)' },
  { code: 'AU', label: 'Australia (NTC)' },
  { code: 'CA', label: 'Canada (Transport Canada)' },
];

function CompliancePathwayPage({ onLogout }) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [vehicles, setVehicles] = useState([]);
  const [vehicleId, setVehicleId] = useState('');
  const [jurisdiction, setJurisdiction] = useState('US');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    services.vehicleModels.getAll({ limit: 1000 })
      .then((res) => setVehicles(res.data?.data || res.data || []))
      .catch(() => toast.error('Failed to load vehicles'));
  }, []);

  const check = async () => {
    if (!vehicleId) { toast.error('Pick a vehicle'); return; }
    setLoading(true); setResult(null);
    try {
      const res = await aiExtended.complianceCheck({ vehicle_id: parseInt(vehicleId, 10), jurisdiction });
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
            <h1>📋 Regulatory Pathway · Compliance Check</h1>
          </div>
        </div>

        <div className="analytics-card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end' }}>
            <div>
              <label>Vehicle</label>
              <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
                <option value="">Select…</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name} (L{v.autonomyLevel})</option>)}
              </select>
            </div>
            <div>
              <label>Jurisdiction</label>
              <select value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)}>
                {JURISDICTIONS.map((j) => <option key={j.code} value={j.code}>{j.label}</option>)}
              </select>
            </div>
            <button className="add-btn" onClick={check} disabled={loading}>
              {loading ? 'Analyzing…' : 'Check Compliance'}
            </button>
          </div>
        </div>

        {result && (
          <div className="analytics-grid">
            <div className="analytics-card">
              <h3>Vehicle</h3>
              <div>Name: {result.vehicle?.name}</div>
              <div>Manufacturer: {result.vehicle?.manufacturer}</div>
              <div>Type: {result.vehicle?.type}</div>
              <div>Autonomy Level: SAE L{result.vehicle?.autonomyLevel}</div>
            </div>
            <div className="analytics-card">
              <h3>Simulation Summary</h3>
              <div>Total runs: {result.simulation_summary?.count}</div>
              <div>Avg success rate: {result.simulation_summary?.avg_success_rate}%</div>
              <div>Total collisions: {result.simulation_summary?.total_collisions}</div>
              <div>Existing records: {result.existing_compliance_records?.length || 0}</div>
            </div>
            <div className="analytics-card wide">
              <h3>🤖 AI Compliance Report ({result.jurisdiction})</h3>
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 1.6 }}>{result.compliance_analysis}</pre>
              <div style={{ marginTop: 12, fontSize: 12, color: '#94a3b8' }}>Checked at {result.checked_at}</div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default CompliancePathwayPage;
