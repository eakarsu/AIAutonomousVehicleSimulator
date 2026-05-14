import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { simulationRuns, services } from '../services/api';

/**
 * Real-Time Simulation Monitoring + History.
 * - List all simulation runs (polled every 5s for status updates)
 * - Start a new run (vehicle + scenario)
 * - Mark a run as complete with results
 * - Open the PDF report
 * - Open the AI streaming analysis page for any run
 */
function SimulationRunsPage({ onLogout }) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [runs, setRuns] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [scenarios, setScenarios] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showComplete, setShowComplete] = useState(null);
  const [form, setForm] = useState({ vehicle_id: '', scenario_id: '', vehicle_speed: 60, sensor_range: 100, simulation_duration: 120 });
  const [completeForm, setCompleteForm] = useState({ duration_seconds: 120, successRate: 95, collisions: 0, nearMisses: 0, avgSpeed: 50, totalDistance: 5, grade: 'A' });
  const pollRef = useRef(null);

  const load = async () => {
    try {
      const [r, v, s] = await Promise.all([
        simulationRuns.list({ page: 1, limit: 50 }),
        services.vehicleModels.getAll({ limit: 1000 }),
        services.drivingScenarios.getAll({ limit: 1000 }),
      ]);
      // Handle both paginated {data, pagination} and legacy array response
      setRuns(Array.isArray(r.data) ? r.data : (r.data?.data || []));
      setVehicles(v.data?.data || v.data || []);
      setScenarios(s.data?.data || s.data || []);
    } catch (e) {
      toast.error('Failed to load runs');
    }
  };

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 5000);
    return () => clearInterval(pollRef.current);
  }, []);

  const handleCreate = async () => {
    try {
      await simulationRuns.create({
        vehicle_id: parseInt(form.vehicle_id, 10),
        scenario_id: parseInt(form.scenario_id, 10),
        vehicle_speed: parseFloat(form.vehicle_speed),
        sensor_range: parseFloat(form.sensor_range),
        simulation_duration: parseInt(form.simulation_duration, 10),
        results: {},
        status: 'running',
      });
      toast.success('Simulation run started');
      setShowCreate(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors ? JSON.stringify(e.response.data.errors) : (e.response?.data?.error || e.message));
    }
  };

  const handleComplete = async () => {
    try {
      const { duration_seconds, ...results } = completeForm;
      await simulationRuns.complete(showComplete.id, {
        duration_seconds: parseInt(duration_seconds, 10),
        results,
        ai_analysis: {},
      });
      toast.success('Run completed');
      setShowComplete(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors ? JSON.stringify(e.response.data.errors) : (e.response?.data?.error || e.message));
    }
  };

  const downloadPDF = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(simulationRuns.pdfReport(id), { headers: { Authorization: `Bearer ${token}` } });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `simulation-run-${id}-report.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { toast.error('PDF download failed'); }
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
            <h1>Simulation Runs · Live Monitoring</h1>
          </div>
          <button className="add-btn" onClick={() => setShowCreate(true)}>+ Start New Run</button>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th><th>Vehicle</th><th>Scenario</th><th>Status</th><th>Started</th>
              <th>Completed</th><th>Duration</th><th>Grade</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 && (
              <tr><td colSpan="9" style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>No simulation runs yet</td></tr>
            )}
            {runs.map((r) => {
              const v = vehicles.find((x) => x.id === r.vehicle_id);
              const s = scenarios.find((x) => x.id === r.scenario_id);
              const grade = (r.results && typeof r.results === 'object' ? r.results.grade : null) || '—';
              return (
                <tr key={r.id}>
                  <td>#{r.id}</td>
                  <td>{v?.name || `#${r.vehicle_id}`}</td>
                  <td>{s?.name || `#${r.scenario_id}`}</td>
                  <td><span className={`status-badge status-${r.status}`}>{r.status}</span></td>
                  <td>{r.started_at ? new Date(r.started_at).toLocaleString() : '-'}</td>
                  <td>{r.completed_at ? new Date(r.completed_at).toLocaleString() : '-'}</td>
                  <td>{r.duration_seconds ? `${r.duration_seconds}s` : '-'}</td>
                  <td>{grade}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    {r.status === 'running' && <button className="add-btn" onClick={() => setShowComplete(r)}>Complete</button>}
                    <button className="add-btn" onClick={() => downloadPDF(r.id)}>📄 PDF</button>
                    <button className="add-btn" onClick={() => navigate(`/ai-stream-analysis/${r.id}`)}>🤖 AI Stream</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Start Simulation Run</h2>
            <label>Vehicle</label>
            <select value={form.vehicle_id} onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}>
              <option value="">Select…</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <label>Scenario</label>
            <select value={form.scenario_id} onChange={(e) => setForm({ ...form, scenario_id: e.target.value })}>
              <option value="">Select…</option>
              {scenarios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <label>Vehicle Speed (km/h, 0-300)</label>
            <input type="number" value={form.vehicle_speed} onChange={(e) => setForm({ ...form, vehicle_speed: e.target.value })} />
            <label>Sensor Range (m, 1-500)</label>
            <input type="number" value={form.sensor_range} onChange={(e) => setForm({ ...form, sensor_range: e.target.value })} />
            <label>Simulation Duration (seconds, 1-3600)</label>
            <input type="number" value={form.simulation_duration} onChange={(e) => setForm({ ...form, simulation_duration: e.target.value })} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="add-btn" onClick={handleCreate}>Start Run</button>
            </div>
          </div>
        </div>
      )}

      {showComplete && (
        <div className="modal-overlay" onClick={() => setShowComplete(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Complete Run #{showComplete.id}</h2>
            {[
              ['duration_seconds', 'Duration (seconds)'],
              ['successRate', 'Success Rate (%)'],
              ['collisions', 'Collisions'],
              ['nearMisses', 'Near Misses'],
              ['avgSpeed', 'Avg Speed (km/h)'],
              ['totalDistance', 'Total Distance (km)'],
            ].map(([k, lbl]) => (
              <div key={k}>
                <label>{lbl}</label>
                <input type="number" value={completeForm[k]} onChange={(e) => setCompleteForm({ ...completeForm, [k]: e.target.value })} />
              </div>
            ))}
            <label>Grade</label>
            <select value={completeForm.grade} onChange={(e) => setCompleteForm({ ...completeForm, grade: e.target.value })}>
              {['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'D', 'F'].map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setShowComplete(null)}>Cancel</button>
              <button className="add-btn" onClick={handleComplete}>Complete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default SimulationRunsPage;
