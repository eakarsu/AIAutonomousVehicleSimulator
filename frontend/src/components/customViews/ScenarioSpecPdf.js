import React, { useState } from 'react';
import { customViews } from '../../services/api';

/**
 * NON-VIZ: Download a scenario specification PDF. Either the most-recent
 * 10 scenarios (default) or a specific scenario ID.
 */
function ScenarioSpecPdf() {
  const [id, setId] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [status, setStatus] = useState(null);

  const download = async () => {
    setDownloading(true);
    setStatus(null);
    try {
      const url = customViews.scenarioSpecPdfUrl(id ? Number(id) : undefined);
      const token = localStorage.getItem('token');
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = window.URL.createObjectURL(blob);
      a.download = id ? `scenario-spec-${id}.pdf` : 'scenario-specs.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setStatus({ ok: true, msg: 'PDF downloaded.' });
    } catch (err) {
      setStatus({ ok: false, msg: err.message || 'Download failed' });
    } finally {
      setDownloading(false);
    }
  };

  const inputStyle = {
    padding: 8, background: '#1e293b', color: '#e2e8f0',
    border: '1px solid #334155', borderRadius: 6, width: 120,
  };

  return (
    <div className="custom-view-card" style={{ background: '#0f172a', borderRadius: 12, padding: 18 }} data-testid="scenario-spec-pdf">
      <h3 style={{ color: '#e2e8f0', marginTop: 0 }}>Scenario Specification PDF</h3>
      <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 0 }}>
        Generate a formal scenario-spec PDF for documentation, audits, or hand-off to test engineers.
        Leave the ID blank to render the 10 most recent scenarios.
      </p>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>
          Scenario ID
          <input
            style={{ ...inputStyle, marginLeft: 8 }}
            type="number"
            value={id}
            placeholder="optional"
            onChange={(e) => setId(e.target.value)}
          />
        </label>
        <button
          onClick={download}
          disabled={downloading}
          data-testid="download-scenario-pdf"
          style={{
            background: '#ef4444', color: '#fff', border: 'none',
            padding: '10px 18px', borderRadius: 6, cursor: 'pointer', fontWeight: 600,
          }}
        >
          {downloading ? 'Generating…' : '⬇ Download Spec PDF'}
        </button>
      </div>
      {status && (
        <div style={{ marginTop: 12, color: status.ok ? '#22c55e' : '#ef4444', fontSize: 13 }}>
          {status.msg}
        </div>
      )}
    </div>
  );
}

export default ScenarioSpecPdf;
