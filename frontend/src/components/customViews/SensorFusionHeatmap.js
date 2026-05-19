import React, { useEffect, useState } from 'react';
import { customViews } from '../../services/api';

/**
 * VIZ: Sensor-fusion accuracy heatmap with axes
 *   X = environmental condition (clear, rain, fog, snow, night, glare)
 *   Y = sensor type
 * Plus a "fusion" row showing the synergy-boosted accuracy per condition.
 */
function SensorFusionHeatmap() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    customViews
      .sensorFusionAccuracy()
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.error || err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 16, color: '#94a3b8' }}>Loading sensor-fusion heatmap…</div>;
  if (error)   return <div style={{ padding: 16, color: '#ef4444' }}>Error: {error}</div>;
  if (!data)   return <div style={{ padding: 16, color: '#94a3b8' }}>No sensor data.</div>;

  const { axes, matrix, fusion_by_condition, summary } = data;

  const colorFor = (acc) => {
    const v = Math.max(0, Math.min(100, Number(acc) || 0));
    // map 50-100 → red→amber→green
    if (v >= 90) return '#16a34a';
    if (v >= 80) return '#22c55e';
    if (v >= 70) return '#facc15';
    if (v >= 60) return '#f97316';
    return '#dc2626';
  };

  return (
    <div className="custom-view-card" style={{ background: '#0f172a', borderRadius: 12, padding: 18 }} data-testid="sensor-fusion-heatmap">
      <h3 style={{ color: '#e2e8f0', marginTop: 0 }}>Sensor-Fusion Accuracy Heatmap</h3>
      <div style={{ display: 'flex', gap: 18, marginBottom: 12, fontSize: 12, color: '#94a3b8', flexWrap: 'wrap' }}>
        <span>Sensors: <b style={{ color: '#e2e8f0' }}>{summary?.sensor_types_used ?? 0}</b></span>
        <span>Avg accuracy: <b style={{ color: '#22c55e' }}>{summary?.avg_accuracy ?? 0}%</b></span>
        {summary?.best_cell && <span>Best: <b style={{ color: '#22c55e' }}>{summary.best_cell.sensor} / {summary.best_cell.condition} ({summary.best_cell.accuracy}%)</b></span>}
        {summary?.worst_cell && <span>Worst: <b style={{ color: '#ef4444' }}>{summary.worst_cell.sensor} / {summary.worst_cell.condition} ({summary.worst_cell.accuracy}%)</b></span>}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 3, fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ padding: 6, color: '#94a3b8', textAlign: 'left' }}>sensor \ condition</th>
              {axes.conditions.map((c) => (
                <th key={c} style={{ padding: 6, color: '#94a3b8', textAlign: 'center', textTransform: 'capitalize' }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {axes.sensors.map((s) => (
              <tr key={s}>
                <td style={{ padding: 6, color: '#cbd5e1', fontWeight: 500, textTransform: 'capitalize' }}>{s}</td>
                {axes.conditions.map((c) => {
                  const v = (matrix[s] && matrix[s][c]) || 0;
                  return (
                    <td
                      key={c}
                      title={`${s} × ${c} → ${v}% accuracy`}
                      style={{
                        padding: '10px 14px',
                        background: colorFor(v),
                        color: '#0b1220',
                        fontWeight: 700,
                        textAlign: 'center',
                        borderRadius: 4,
                        minWidth: 56,
                      }}
                    >
                      {v}%
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <td style={{ padding: 6, color: '#fbbf24', fontWeight: 700 }}>FUSION</td>
              {axes.conditions.map((c) => {
                const v = fusion_by_condition?.[c] || 0;
                return (
                  <td
                    key={c}
                    title={`fusion × ${c} → ${v}% accuracy`}
                    style={{
                      padding: '10px 14px',
                      background: colorFor(v),
                      color: '#0b1220',
                      fontWeight: 900,
                      textAlign: 'center',
                      borderRadius: 4,
                      border: '2px solid #fbbf24',
                    }}
                  >
                    {v}%
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default SensorFusionHeatmap;
