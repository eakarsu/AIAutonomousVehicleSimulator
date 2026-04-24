import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

function Settings({ onLogout, theme, setTheme }) {
  const [pageSize, setPageSize] = useState(localStorage.getItem('pageSize') || '10');
  const [autoRefresh, setAutoRefresh] = useState(localStorage.getItem('autoRefresh') === 'true');
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const handleSave = () => {
    localStorage.setItem('pageSize', pageSize);
    localStorage.setItem('autoRefresh', autoRefresh);
    toast.success('Settings saved');
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
            <h1>Settings</h1>
          </div>
        </div>

        <div className="settings-grid">
          <div className="settings-card">
            <h3>Appearance</h3>
            <div className="settings-item">
              <label>Theme</label>
              <div className="theme-toggle-group">
                <button className={`theme-btn ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme('dark')}>Dark</button>
                <button className={`theme-btn ${theme === 'light' ? 'active' : ''}`} onClick={() => setTheme('light')}>Light</button>
              </div>
            </div>
          </div>

          <div className="settings-card">
            <h3>Data Display</h3>
            <div className="settings-item">
              <label>Default Page Size</label>
              <select className="filter-select" value={pageSize} onChange={(e) => setPageSize(e.target.value)}>
                <option value="10">10 items</option>
                <option value="25">25 items</option>
                <option value="50">50 items</option>
                <option value="100">100 items</option>
              </select>
            </div>
            <div className="settings-item">
              <label>Auto Refresh Dashboard</label>
              <div className="toggle-switch" onClick={() => setAutoRefresh(!autoRefresh)}>
                <div className={`toggle-track ${autoRefresh ? 'active' : ''}`}>
                  <div className="toggle-thumb"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="settings-card">
            <h3>Keyboard Shortcuts</h3>
            <div className="shortcuts-list">
              <div className="shortcut-item"><kbd>?</kbd><span>Show keyboard shortcuts</span></div>
              <div className="shortcut-item"><kbd>N</kbd><span>New item</span></div>
              <div className="shortcut-item"><kbd>/</kbd><span>Focus search</span></div>
              <div className="shortcut-item"><kbd>Esc</kbd><span>Close modal</span></div>
              <div className="shortcut-item"><kbd>G then D</kbd><span>Go to dashboard</span></div>
              <div className="shortcut-item"><kbd>G then P</kbd><span>Go to profile</span></div>
              <div className="shortcut-item"><kbd>G then S</kbd><span>Go to settings</span></div>
              <div className="shortcut-item"><kbd>G then A</kbd><span>Go to analytics</span></div>
            </div>
          </div>

          <div className="settings-card">
            <h3>About</h3>
            <div className="about-info">
              <p><strong>AI Autonomous Vehicle Simulator</strong></p>
              <p>Version 1.0.0</p>
              <p>Training & Testing Platform for autonomous vehicle algorithms</p>
            </div>
          </div>
        </div>

        <div className="form-actions" style={{marginTop: 20}}>
          <button className="btn-save" onClick={handleSave}>Save Settings</button>
        </div>
      </div>
    </>
  );
}

export default Settings;
