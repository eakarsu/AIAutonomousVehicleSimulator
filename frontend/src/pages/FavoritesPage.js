import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { favorites } from '../services/api';
import { toast } from 'react-toastify';

function FavoritesPage({ onLogout }) {
  const [favs, setFavs] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => { loadFavorites(); }, []);

  const loadFavorites = async () => {
    try {
      const res = await favorites.getAll();
      setFavs(res.data);
    } catch (err) {
      toast.error('Failed to load favorites');
    } finally {
      setLoading(false);
    }
  };

  const removeFavorite = async (id) => {
    try {
      await favorites.delete(id);
      setFavs(favs.filter(f => f.id !== id));
      toast.success('Removed from favorites');
    } catch (err) {
      toast.error('Failed to remove favorite');
    }
  };

  const entityPathMap = {
    'vehicle-models': '/vehicle-models',
    'sensor-configs': '/sensor-configs',
    'driving-scenarios': '/driving-scenarios',
    'training-sessions': '/training-sessions',
    'simulation-results': '/simulation-results',
    'route-plans': '/route-plans',
    'object-detections': '/object-detections',
    'traffic-simulations': '/traffic-simulations',
    'weather-simulations': '/weather-simulations',
    'safety-metrics': '/safety-metrics',
    'fleet-vehicles': '/fleet-vehicles',
    'map-environments': '/map-environments',
    'ai-models': '/ai-models',
    'collision-analyses': '/collision-analyses',
    'regulatory-compliances': '/regulatory-compliances',
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
            <h1>Favorites</h1>
          </div>
        </div>

        {loading ? (
          <div className="loading-container"><div className="loading-spinner"></div></div>
        ) : favs.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">⭐</span>
            <h3>No Favorites Yet</h3>
            <p>Star items from any feature page to add them here</p>
          </div>
        ) : (
          <div className="favorites-grid">
            {favs.map(fav => (
              <div key={fav.id} className="favorite-card">
                <div className="favorite-card-header">
                  <h4>{fav.entityName || `Item #${fav.entityId}`}</h4>
                  <button className="favorite-remove" onClick={() => removeFavorite(fav.id)}>✕</button>
                </div>
                <div className="favorite-card-body">
                  <span className="audit-tag">{fav.entityType}</span>
                  <span className="activity-time">{new Date(fav.createdAt).toLocaleDateString()}</span>
                </div>
                <button className="btn-edit" style={{marginTop: 10, width: '100%'}} onClick={() => navigate(entityPathMap[fav.entityType] || '/dashboard')}>
                  View
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default FavoritesPage;
