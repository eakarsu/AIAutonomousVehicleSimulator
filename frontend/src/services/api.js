import axios from 'axios';

const API = axios.create({ baseURL: 'http://localhost:3501/api' });

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

// ── Simulation runs (live monitoring + history) ──────────────────────────
export const simulationRuns = {
  list: (params) => API.get('/simulation-runs', { params }),
  get: (id) => API.get(`/simulation-runs/${id}`),
  create: (data) => API.post('/simulation-runs', data),
  complete: (id, data) => API.patch(`/simulation-runs/${id}/complete`, data),
  pdfReport: (id) => `${API.defaults.baseURL}/simulations/${id}/report/pdf`,
};

// ── Analytics: safety metrics dashboard ──────────────────────────────────
export const analytics = {
  safetyMetrics: () => API.get('/analytics/safety-metrics'),
};

// ── AI extended endpoints ────────────────────────────────────────────────
export const aiExtended = {
  compareScenarios: (scenario_ids) => API.post('/ai/compare-scenarios', { scenario_ids }),
  complianceCheck: (data) => API.post('/ai/compliance-check', data),
  sensorFusionRecommendation: (data) => API.post('/ai/sensor-fusion-recommendation', data),
  scoreScenario: (scenario_id) => API.post('/ai/score-scenario', { scenario_id }),
  fleetMaintenanceDue: () => API.get('/ai/fleet-maintenance-due'),
  scenarioGenerate: (data) => API.post('/ai/scenario-generate', data),
  safetyAssessment: (data) => API.post('/ai/safety-assessment', data),
  // SSE stream URL helper (token must be appended via fetch with Authorization header)
  analyzeSimulationStreamUrl: (runId) => `${API.defaults.baseURL}/ai/analyze-simulation/stream?runId=${runId}`,
};

// ── AI Results history ────────────────────────────────────────────────────
export const aiResults = {
  getAll: (params) => API.get('/ai-results', { params }),
  getOne: (id) => API.get(`/ai-results/${id}`),
};

// ── Training session progress simulator ──────────────────────────────────
export const trainingSessions = {
  simulateProgress: (id, data) => API.post(`/training-sessions/${id}/simulate-progress`, data),
};

// ── Dashboard risk score ──────────────────────────────────────────────────
export const dashboardRisk = {
  getRiskScore: () => API.get('/dashboard/risk-score'),
};

// ── Custom Views (4 endpoints: coverage matrix, sensor-fusion heatmap, scenario PDF, scenario editor CRUD)
export const customViews = {
  // VIZ
  scenarioCoverage: () => API.get('/custom-views/scenario-coverage'),
  sensorFusionAccuracy: () => API.get('/custom-views/sensor-fusion-accuracy'),
  // NON-VIZ
  scenarioSpecPdfUrl: (id) => `${API.defaults.baseURL}/custom-views/scenario-spec/pdf${id ? '/' + id : ''}`,
  scenarioEditorList: () => API.get('/custom-views/scenario-editor'),
  scenarioEditorCreate: (data) => API.post('/custom-views/scenario-editor', data),
  scenarioEditorUpdate: (id, data) => API.put(`/custom-views/scenario-editor/${id}`, data),
  scenarioEditorDelete: (id) => API.delete(`/custom-views/scenario-editor/${id}`),
};

export default API;
