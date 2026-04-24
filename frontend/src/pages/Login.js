import React, { useState } from 'react';
import { auth } from '../services/api';
import { toast } from 'react-toastify';

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await auth.login({ email, password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      toast.success('Welcome to AV Simulator!');
      onLogin();
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = () => {
    setEmail('admin@avsimulator.com');
    setPassword('admin123');
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-logo">
          <span className="logo-icon">🚗</span>
          <h1>AI Autonomous Vehicle Simulator</h1>
          <p>Training & Testing Self-Driving Algorithms</p>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          {error && <div className="login-error">{error}</div>}
          <div className="form-group">
            <label>Email Address</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required />
          </div>
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
          <button type="button" className="demo-btn" onClick={fillDemo}>
            Fill Demo Credentials
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
