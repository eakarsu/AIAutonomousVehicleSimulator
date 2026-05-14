import React, { useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { aiExtended } from '../services/api';

/**
 * SSE-streamed AI analysis of a single simulation run.
 */
function AIStreamAnalysisPage({ onLogout }) {
  const navigate = useNavigate();
  const { runId } = useParams();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [status, setStatus] = useState([]);
  const [output, setOutput] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const start = async () => {
    setError(null); setStatus([]); setOutput(''); setRunning(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(aiExtended.analyzeSimulationStreamUrl(runId), {
        headers: { Authorization: `Bearer ${token}` },
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const blocks = buf.split('\n\n');
        buf = blocks.pop();
        for (const block of blocks) {
          const evMatch = block.match(/^event: (\w+)/m);
          const dataMatch = block.match(/^data: (.+)$/m);
          if (!dataMatch) continue;
          let data;
          try { data = JSON.parse(dataMatch[1]); } catch { continue; }
          const ev = evMatch ? evMatch[1] : 'message';
          if (ev === 'status') setStatus((s) => [...s, data]);
          else if (ev === 'chunk') setOutput((o) => o + data.text);
          else if (ev === 'error') setError(data.message);
          else if (ev === 'done') setStatus((s) => [...s, { step: 'done', message: 'Analysis complete' }]);
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  const stop = () => { if (abortRef.current) abortRef.current.abort(); setRunning(false); };

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
            <button className="back-btn" onClick={() => navigate('/simulation-runs')}>← Back</button>
            <h1>🤖 AI Stream Analysis · Run #{runId}</h1>
          </div>
          {!running ? <button className="add-btn" onClick={start}>▶ Stream Analysis</button>
                    : <button className="add-btn" style={{ background: '#dc2626' }} onClick={stop}>■ Stop</button>}
        </div>

        {error && <div style={{ padding: 12, background: 'rgba(248, 113, 113, 0.12)', color: '#f87171', borderRadius: 8, marginBottom: 16 }}>{error}</div>}

        <div className="analytics-grid">
          <div className="analytics-card">
            <h3>Pipeline Status</h3>
            {status.length === 0 && <div style={{ color: '#94a3b8' }}>Waiting…</div>}
            {status.map((s, i) => (
              <div key={i} style={{ padding: 8, marginBottom: 6, background: 'rgba(34, 197, 94, 0.08)', borderRadius: 6, fontSize: 13 }}>
                ● Step {s.step} · {s.message}
              </div>
            ))}
          </div>
          <div className="analytics-card wide">
            <h3>Live AI Output</h3>
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 1.6, minHeight: 320 }}>
              {output || 'AI tokens will stream here…'}
            </pre>
          </div>
        </div>
      </div>
    </>
  );
}

export default AIStreamAnalysisPage;
