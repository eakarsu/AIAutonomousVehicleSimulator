import React, { useEffect, useState } from 'react';
import { customViews } from '../../services/api';

/**
 * NON-VIZ: CRUD editor for driving scenarios, focused on the three
 * key simulation parameters: weather, traffic, road.
 */
const DEFAULT_FORM = {
  name: '',
  category: 'general',
  weatherCondition: 'clear',
  trafficDensity: 'medium',
  roadType: 'urban',
  duration: 120,
  description: '',
};

function ScenarioEditor() {
  const [items, setItems] = useState([]);
  const [enums, setEnums] = useState({ road: [], weather: [], traffic: [] });
  const [form, setForm] = useState(DEFAULT_FORM);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState(null);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await customViews.scenarioEditorList();
      setItems(res.data.items || []);
      setEnums(res.data.enums || enums);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const update = (k, v) => setForm({ ...form, [k]: v });

  const reset = () => { setForm(DEFAULT_FORM); setEditId(null); setIssues([]); setError(null); };

  const submit = async () => {
    setError(null);
    setIssues([]);
    try {
      const payload = { ...form, duration: Number(form.duration) };
      const res = editId
        ? await customViews.scenarioEditorUpdate(editId, payload)
        : await customViews.scenarioEditorCreate(payload);
      if (res.status === 422) setIssues(res.data.issues || []);
      else { reset(); load(); }
    } catch (err) {
      if (err.response?.status === 422) setIssues(err.response.data.issues || []);
      else setError(err.response?.data?.error || err.message);
    }
  };

  const startEdit = (item) => {
    setEditId(item.id);
    setForm({
      name: item.name || '',
      category: item.category || 'general',
      weatherCondition: item.weatherCondition || 'clear',
      trafficDensity: item.trafficDensity || 'medium',
      roadType: item.roadType || 'urban',
      duration: item.duration || 120,
      description: item.description || '',
    });
  };

  const remove = async (id) => {
    if (!window.confirm('Delete scenario #' + id + '?')) return;
    try {
      await customViews.scenarioEditorDelete(id);
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const inputStyle = { width: '100%', padding: 8, background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 6, marginTop: 4 };
  const labelStyle = { color: '#cbd5e1', fontSize: 12, fontWeight: 600 };
  const row = { marginBottom: 10 };

  return (
    <div className="custom-view-card" style={{ background: '#0f172a', borderRadius: 12, padding: 18 }} data-testid="scenario-editor">
      <h3 style={{ color: '#e2e8f0', marginTop: 0 }}>Scenario Editor (CRUD)</h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        {/* Form */}
        <div style={{ background: '#0b1220', padding: 14, borderRadius: 8 }}>
          <div style={{ color: '#fbbf24', fontWeight: 600, marginBottom: 8 }}>
            {editId ? `Editing #${editId}` : 'Create new scenario'}
          </div>

          <div style={row}>
            <div style={labelStyle}>Name *</div>
            <input style={inputStyle} value={form.name} onChange={(e) => update('name', e.target.value)} data-testid="editor-name" />
          </div>
          <div style={row}>
            <div style={labelStyle}>Weather</div>
            <select style={inputStyle} value={form.weatherCondition} onChange={(e) => update('weatherCondition', e.target.value)} data-testid="editor-weather">
              {(enums.weather || []).map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div style={row}>
            <div style={labelStyle}>Traffic Density</div>
            <select style={inputStyle} value={form.trafficDensity} onChange={(e) => update('trafficDensity', e.target.value)} data-testid="editor-traffic">
              {(enums.traffic || []).map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div style={row}>
            <div style={labelStyle}>Road Type</div>
            <select style={inputStyle} value={form.roadType} onChange={(e) => update('roadType', e.target.value)} data-testid="editor-road">
              {(enums.road || []).map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div style={row}>
            <div style={labelStyle}>Duration (s)</div>
            <input type="number" style={inputStyle} value={form.duration} onChange={(e) => update('duration', e.target.value)} />
          </div>
          <div style={row}>
            <div style={labelStyle}>Description</div>
            <textarea rows={3} style={{ ...inputStyle, resize: 'vertical' }} value={form.description} onChange={(e) => update('description', e.target.value)} />
          </div>

          {issues.length > 0 && (
            <div style={{ background: '#7f1d1d', padding: 8, borderRadius: 6, marginBottom: 8 }}>
              {issues.map((i, idx) => <div key={idx} style={{ color: '#fecaca', fontSize: 12 }}>• {i}</div>)}
            </div>
          )}
          {error && <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 8 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={submit}
              data-testid="editor-submit"
              style={{ background: editId ? '#3b82f6' : '#22c55e', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
            >
              {editId ? 'Save Changes' : 'Create Scenario'}
            </button>
            {editId && (
              <button onClick={reset} style={{ background: '#334155', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 6, cursor: 'pointer' }}>
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div style={{ background: '#0b1220', padding: 14, borderRadius: 8, maxHeight: 460, overflow: 'auto' }}>
          <div style={{ color: '#cbd5e1', fontWeight: 600, marginBottom: 8 }}>Scenarios ({items.length})</div>
          {loading && <div style={{ color: '#94a3b8' }}>Loading…</div>}
          {!loading && items.length === 0 && <div style={{ color: '#94a3b8' }}>No scenarios yet.</div>}
          {items.map((it) => (
            <div key={it.id} style={{
              background: '#1e293b', padding: 10, borderRadius: 6, marginBottom: 6,
              display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#f8fafc', fontWeight: 600, fontSize: 13 }}>
                  #{it.id} {it.name}
                </div>
                <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>
                  road: <b style={{ color: '#60a5fa' }}>{it.roadType}</b> · weather: <b style={{ color: '#22d3ee' }}>{it.weatherCondition}</b> · traffic: <b style={{ color: '#fbbf24' }}>{it.trafficDensity}</b> · {it.duration ?? '—'}s
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <button onClick={() => startEdit(it)} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>Edit</button>
                <button onClick={() => remove(it.id)} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ScenarioEditor;
