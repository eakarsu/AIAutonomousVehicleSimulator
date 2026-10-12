// Apply pass 5 — surface /api/ai/* extension endpoints
import React, { useState } from 'react';
import axios from 'axios';
import AIReport from '../components/AIReport';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3501/api';

function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const SECTIONS = [
  {
    id: 'behavior',
    title: 'AI Vehicle Behavior Model (TOO-RISKY → text-grounded)',
    method: 'POST',
    path: '/ai/behavior-model',
    sample: { driver_profile: 'aggressive_urban', simulation_result_ids: [] },
  },
  {
    id: 'env',
    title: 'Environment Randomization (PRODUCT-DECISION: bounded RNG)',
    method: 'POST',
    path: '/ai/env-randomize',
    sample: { seed: 42, count: 5 },
  },
  {
    id: 'carla-status',
    title: 'CARLA Status (NEEDS-CREDS: CARLA_API_URL + CARLA_API_KEY)',
    method: 'GET',
    path: '/ai/carla/status',
  },
  {
    id: 'carla-dispatch',
    title: 'CARLA Dispatch Scenario (NEEDS-CREDS)',
    method: 'POST',
    path: '/ai/carla/dispatch',
    sample: { simulator: 'carla' },
    prerequisite: 'Select an actual saved scenario in the native scenario workflow before dispatching.',
  },
  {
    id: 'lidar',
    title: 'Lidar/Radar Sim Stub (TOO-RISKY → in-memory points)',
    method: 'POST',
    path: '/ai/lidar-simulate',
    sample: { density: 0.5 },
    prerequisite: 'Actual saved sensor configuration and scenario references are required.',
  },
  {
    id: 'av-status',
    title: 'AV Platform Status (NEEDS-CREDS: AV_PLATFORM + AV_PLATFORM_API_KEY)',
    method: 'GET',
    path: '/ai/av-platform/status',
  },
  {
    id: 'av-export',
    title: 'AV Platform Export (unavailable)',
    prerequisite: 'No export endpoint is implemented. A vendor integration and an actual saved simulation result are required.',
  },
];

export default function ExtensionsPage() {
  const [out, setOut] = useState({});
  const [busy, setBusy] = useState({});

  async function run(s) {
    setBusy({ ...busy, [s.id]: true });
    try {
      const url = `${API_BASE}${s.path}`;
      const res = await axios({ method: s.method, url, data: s.sample, headers: authHeaders(), validateStatus: () => true });
      setOut({ ...out, [s.id]: { status: res.status, body: res.data } });
    } catch (e) {
      setOut({ ...out, [s.id]: { status: 0, body: { error: e.message } } });
    } finally {
      setBusy({ ...busy, [s.id]: false });
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>Backlog Extensions (Apply pass 5)</h2>
      <p>503 means env vars missing; configure backend `.env` to enable.</p>
      {SECTIONS.map(s => (
        <div key={s.id} style={{ border: '1px solid #ddd', borderRadius: 6, padding: 12, margin: '12px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <strong>{s.title}</strong>
            {s.path ? <button onClick={() => run(s)} disabled={busy[s.id] || Boolean(s.prerequisite)}>
              {busy[s.id] ? 'Calling…' : `Run ${s.method}`}
            </button> : <span>Unavailable</span>}
          </div>
          {s.prerequisite && <p role="status">{s.prerequisite}</p>}
          {s.sample && (
            <details>
              <summary>Sample payload</summary>
              <pre>{JSON.stringify(s.sample, null, 2)}</pre>
            </details>
          )}
          {out[s.id] && (
            <div>
              <div>HTTP <code>{out[s.id].status}</code></div>
              <AIReport response={out[s.id].body} title={s.title} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
