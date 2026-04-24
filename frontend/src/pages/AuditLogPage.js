import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auditLogs } from '../services/api';
import { toast } from 'react-toastify';

function AuditLogPage({ onLogout }) {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    loadLogs();
  }, [page, filterAction, filterEntity]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (filterAction) params.action = filterAction;
      if (filterEntity) params.entityType = filterEntity;
      const res = await auditLogs.getAll(params);
      setLogs(res.data.data);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    } catch (err) {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'CREATE': return '#34d399';
      case 'UPDATE': return '#fbbf24';
      case 'DELETE': return '#f87171';
      case 'EXPORT': return '#60a5fa';
      case 'IMPORT': return '#a78bfa';
      default: return '#94a3b8';
    }
  };

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
      <div className="feature-page">
        <div className="feature-header">
          <div className="feature-header-left">
            <button className="back-btn" onClick={() => navigate('/dashboard')}>← Back</button>
            <h1>Audit Log</h1>
          </div>
          <div className="feature-header-right">
            <select className="filter-select" value={filterAction} onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}>
              <option value="">All Actions</option>
              <option value="CREATE">Create</option>
              <option value="UPDATE">Update</option>
              <option value="DELETE">Delete</option>
              <option value="EXPORT">Export</option>
              <option value="IMPORT">Import</option>
            </select>
            <select className="filter-select" value={filterEntity} onChange={(e) => { setFilterEntity(e.target.value); setPage(1); }}>
              <option value="">All Types</option>
              <option value="vehicle-models">Vehicle Models</option>
              <option value="sensor-configs">Sensor Configs</option>
              <option value="driving-scenarios">Driving Scenarios</option>
              <option value="training-sessions">Training Sessions</option>
              <option value="simulation-results">Simulation Results</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="loading-container"><div className="loading-spinner"></div></div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📋</span>
            <h3>No Audit Logs Found</h3>
            <p>Activity will appear here as you use the platform</p>
          </div>
        ) : (
          <>
            <div className="audit-log-list">
              {logs.map(log => (
                <div key={log.id} className="audit-log-item">
                  <div className="audit-action" style={{ backgroundColor: getActionColor(log.action) + '22', color: getActionColor(log.action), borderColor: getActionColor(log.action) + '44' }}>
                    {log.action}
                  </div>
                  <div className="audit-details">
                    <div className="audit-main">
                      <strong>{log.userName || 'System'}</strong> {log.action?.toLowerCase()}d <em>{log.entityName || log.entityType}</em>
                    </div>
                    <div className="audit-meta">
                      {log.entityType && <span className="audit-tag">{log.entityType}</span>}
                      <span className="audit-time">{new Date(log.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button className="page-btn" onClick={() => setPage(1)} disabled={page === 1}>First</button>
                <button className="page-btn" onClick={() => setPage(p => p - 1)} disabled={page === 1}>Prev</button>
                <span className="page-info">Page {page} of {totalPages} ({total} total)</span>
                <button className="page-btn" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>Next</button>
                <button className="page-btn" onClick={() => setPage(totalPages)} disabled={page === totalPages}>Last</button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

export default AuditLogPage;
