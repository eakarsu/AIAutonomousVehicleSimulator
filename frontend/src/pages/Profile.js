import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { profile } from '../services/api';
import { toast } from 'react-toastify';

function Profile({ onLogout }) {
  const [userData, setUserData] = useState(null);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '' });
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await profile.get();
      setUserData(res.data);
      setFormData({ name: res.data.name, email: res.data.email });
    } catch (err) {
      toast.error('Failed to load profile');
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await profile.update(formData);
      setUserData({ ...userData, ...res.data });
      localStorage.setItem('user', JSON.stringify(res.data));
      setEditing(false);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      return toast.error('Passwords do not match');
    }
    setSaving(true);
    try {
      await profile.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      setShowPasswordForm(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Password changed successfully');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Password change failed');
    } finally {
      setSaving(false);
    }
  };

  const user = JSON.parse(localStorage.getItem('user') || '{}');

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
      <div className="profile-page">
        <div className="feature-header">
          <div className="feature-header-left">
            <button className="back-btn" onClick={() => navigate('/dashboard')}>← Back</button>
            <h1>User Profile</h1>
          </div>
        </div>

        {userData && (
          <div className="profile-content">
            <div className="profile-card">
              <div className="profile-avatar">
                {(userData.name || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="profile-info">
                {editing ? (
                  <form onSubmit={handleUpdateProfile}>
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Name</label>
                        <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
                      </div>
                      <div className="form-group">
                        <label>Email</label>
                        <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required />
                      </div>
                    </div>
                    <div className="form-actions">
                      <button type="button" className="btn-cancel" onClick={() => setEditing(false)}>Cancel</button>
                      <button type="submit" className="btn-save" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="profile-details">
                      <div className="detail-item">
                        <div className="detail-label">NAME</div>
                        <div className="detail-value">{userData.name}</div>
                      </div>
                      <div className="detail-item">
                        <div className="detail-label">EMAIL</div>
                        <div className="detail-value">{userData.email}</div>
                      </div>
                      <div className="detail-item">
                        <div className="detail-label">ROLE</div>
                        <div className="detail-value"><span className="status-badge status-active">{userData.role}</span></div>
                      </div>
                      <div className="detail-item">
                        <div className="detail-label">MEMBER SINCE</div>
                        <div className="detail-value">{new Date(userData.createdAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className="profile-actions">
                      <button className="btn-edit" onClick={() => setEditing(true)}>Edit Profile</button>
                      <button className="btn-edit" onClick={() => setShowPasswordForm(!showPasswordForm)}>
                        {showPasswordForm ? 'Cancel' : 'Change Password'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {showPasswordForm && (
              <div className="profile-card" style={{marginTop: 20}}>
                <h3 style={{marginBottom: 16}}>Change Password</h3>
                <form onSubmit={handleChangePassword}>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Current Password</label>
                      <input type="password" value={passwordData.currentPassword} onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})} required />
                    </div>
                    <div className="form-group">
                      <label>New Password</label>
                      <input type="password" value={passwordData.newPassword} onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})} required minLength={6} />
                    </div>
                    <div className="form-group">
                      <label>Confirm New Password</label>
                      <input type="password" value={passwordData.confirmPassword} onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})} required minLength={6} />
                    </div>
                  </div>
                  <div className="form-actions">
                    <button type="submit" className="btn-save" disabled={saving}>{saving ? 'Changing...' : 'Change Password'}</button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default Profile;
