import axios from 'axios';

const API = axios.create({ baseURL: 'http://localhost:3001/api' });

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export const auth = {
  login: (data) => API.post('/auth/login', data),
  register: (data) => API.post('/auth/register', data),
};

export const dashboard = {
  getStats: () => API.get('/dashboard/stats'),
  getAnalytics: () => API.get('/dashboard/analytics'),
};

export const profile = {
  get: () => API.get('/profile'),
  update: (data) => API.put('/profile', data),
  changePassword: (data) => API.put('/profile/password', data),
};

export const auditLogs = {
  getAll: (params) => API.get('/audit-logs', { params }),
  create: (data) => API.post('/audit-logs', data),
};

export const favorites = {
  getAll: (entityType) => API.get('/favorites', { params: entityType ? { entityType } : {} }),
  toggle: (data) => API.post('/favorites/toggle', data),
  delete: (id) => API.delete(`/favorites/${id}`),
};

export function createService(endpoint) {
  return {
    getAll: (params) => API.get(`/${endpoint}`, { params }),
    getOne: (id) => API.get(`/${endpoint}/${id}`),
    create: (data) => API.post(`/${endpoint}`, data),
    update: (id, data) => API.put(`/${endpoint}/${id}`, data),
    delete: (id) => API.delete(`/${endpoint}/${id}`),
    bulkDelete: (ids) => API.post(`/${endpoint}/bulk-delete`, { ids }),
    duplicate: (id) => API.post(`/${endpoint}/${id}/duplicate`),
    import: (data) => API.post(`/${endpoint}/import`, { data }),
    export: (format) => API.get(`/${endpoint}/export`, { params: { format }, responseType: format === 'csv' ? 'blob' : 'json' }),
    aiAnalyze: (id) => API.post(`/${endpoint}/${id}/ai-analyze`),
    aiGenerate: (prompt) => API.post(`/${endpoint}/ai-generate`, { prompt }),
  };
}

export const services = {
  vehicleModels: createService('vehicle-models'),
  sensorConfigs: createService('sensor-configs'),
  drivingScenarios: createService('driving-scenarios'),
  trainingSessions: createService('training-sessions'),
  simulationResults: createService('simulation-results'),
  routePlans: createService('route-plans'),
  objectDetections: createService('object-detections'),
  trafficSimulations: createService('traffic-simulations'),
  weatherSimulations: createService('weather-simulations'),
  safetyMetrics: createService('safety-metrics'),
  fleetVehicles: createService('fleet-vehicles'),
  mapEnvironments: createService('map-environments'),
  aiModels: createService('ai-models'),
  collisionAnalyses: createService('collision-analyses'),
  regulatoryCompliances: createService('regulatory-compliances'),
};

export default API;
