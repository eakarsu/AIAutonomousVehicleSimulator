import React, { useEffect, useState } from 'react';
import { customViews } from '../../services/api';

/**
 * VIZ: Scenario Coverage Matrix — heatmap of test scenarios grouped by
 * road type vs. weather, and road type vs. traffic density. Helps QA
 * spot under-covered cells in the operational design domain.
 */
function ScenarioCoverageMatrix() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    customViews
      .scenarioCoverage()
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.error || err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 16, color: '#94a3b8' }}>Loading coverage matrix…</div>;
  if (error)   return <div style={{ padding: 16, color: '#ef4444' }}>Error: {error}</div>;
  if (!data)   return <div style={{ padding: 16, color: '#94a3b8' }}>No coverage data.</div>;

  const { axes, matrix_road_weather, matrix_road_traffic, summary } = data;
  const maxVal = Math.max(1, summary?.max_cell_count || 1);

  const cellColor = (n) => {
    if (!n) return '#0b1220';
    const intensity = Math.min(1, n / maxVal);
    const r = Math.round(15 + (59 - 15) * intensity);
    const g = Math.round(23 + (130 - 23) * intensity);
    const b = Math.round(42 + (246 - 42) * intensity);
    return `rgb(${r},${g},${b})`;
  };

  const renderGrid = (title, cols, matrix) => (
    <div style={{ marginBottom: 18 }}>
      <div style={{ color: '#cbd5e1', fontWeight: 600, marginBottom: 6 }}>{title}</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 2, fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ padding: 6, color: '#94a3b8', textAlign: 'left' }}>road \ {title.includes('Weather') ? 'weather' : 'traffic'}</th>
              {cols.map((c) => (
                <th key={c} style={{ padding: 6, color: '#94a3b8' }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {axes.roads.map((road) => (
              <tr key={road}>
                <td style={{ padding: 6, color: '#cbd5e1', fontWeight: 500 }}>{road}</td>
                {cols.map((c) => {
                  const v = (matrix[road] && matrix[road][c]) || 0;
                  return (
                    <td
                      key={c}
                      title={`${road} × ${c} → ${v} scenarios`}
                      style={{
                        padding: '10px 14px',
                        background: cellColor(v),
                        color: v > 0 ? '#f8fafc' : '#475569',
                        textAlign: 'center',
                        borderRadius: 4,
                        minWidth: 38,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {v}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="custom-view-card" style={{ background: '#0f172a', borderRadius: 12, padding: 18 }} data-testid="scenario-coverage-matrix">
      <h3 style={{ color: '#e2e8f0', marginTop: 0 }}>Scenario Coverage Matrix</h3>
      <div style={{ display: 'flex', gap: 18, marginBottom: 14, fontSize: 12, color: '#94a3b8', flexWrap: 'wrap' }}>
        <span>Total scenarios: <b style={{ color: '#e2e8f0' }}>{summary?.total_scenarios ?? 0}</b></span>
        <span>Distinct cells: <b style={{ color: '#e2e8f0' }}>{summary?.distinct_cells_with_data ?? 0}</b></span>
        <span>Max cell: <b style={{ color: '#e2e8f0' }}>{summary?.max_cell_count ?? 0}</b></span>
        <span>Coverage: <b style={{ color: '#22c55e' }}>{summary?.coverage_pct ?? 0}%</b></span>
      </div>
      {renderGrid('Road × Weather', axes.weather, matrix_road_weather)}
      {renderGrid('Road × Traffic', axes.traffic, matrix_road_traffic)}
    </div>
  );
}

export default ScenarioCoverageMatrix;
