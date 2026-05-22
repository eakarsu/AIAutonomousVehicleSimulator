const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { body, validationResult } = require('express-validator');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { sequelize, VehicleModel, SensorConfig, DrivingScenario, TrainingSession,
  SimulationResult, RoutePlan, ObjectDetection, TrafficSimulation,
  WeatherSimulation, SafetyMetric, FleetVehicle, MapEnvironment,
  AIModel, CollisionAnalysis, RegulatoryCompliance, AuditLog, Favorite, AIResult } = require('./models');
const authRoutes = require('./routes/auth');
const { createCrudRouter, aiPrompts } = require('./routes/crud');
const { aiRateLimiter, generalLimiter } = require('./middleware/rateLimiter');
const authMiddleware = require('./middleware/auth');
const simulationRunsRouter = require('./routes/simulationRuns');
const analyticsRouter = require('./routes/analytics');
const aiExtendedRouter = require('./routes/aiExtended');
const pdfReportRouter = require('./routes/pdfReport');
const aiResultsRouter = require('./routes/aiResults');
const trainingSessionsRouter = require('./routes/trainingSessions');

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

// ── Security headers ───────────────────────────────────────────────────────
app.use(helmet());

// ── CORS restricted to CLIENT_URL ──────────────────────────────────────────
app.use(cors({
  origin: CLIENT_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));

// ── General rate limiter on all routes ────────────────────────────────────
app.use(generalLimiter);

// Auth routes (public)
app.use('/api/auth', authRoutes);

// Health check (public)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Rate limiter on all AI routes ─────────────────────────────────────────
app.use((req, res, next) => {
  if (req.path.includes('/ai-analyze') || req.path.includes('/ai-generate') ||
      req.path.startsWith('/api/ai')) {
    return aiRateLimiter(req, res, next);
  }
  next();
});

// ── Simulation parameter validation middleware ────────────────────────────
const simParamValidation = [
  body('vehicle_speed')
    .optional()
    .isFloat({ min: 0, max: 300 })
    .withMessage('vehicle_speed must be 0-300 km/h'),
  body('sensor_range')
    .optional()
    .isFloat({ min: 1, max: 500 })
    .withMessage('sensor_range must be 1-500 meters'),
  body('simulation_duration')
    .optional()
    .isInt({ min: 1, max: 3600 })
    .withMessage('simulation_duration must be 1-3600 seconds'),
];

const validateSimParams = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
};

// Apply sim param validation to driving scenario create/update
app.post('/api/driving-scenarios', simParamValidation, validateSimParams);
app.put('/api/driving-scenarios/:id', simParamValidation, validateSimParams);

// Apply sim param validation to simulation results
app.post('/api/simulation-results', simParamValidation, validateSimParams);
app.put('/api/simulation-results/:id', simParamValidation, validateSimParams);

// ── Feature CRUD routes with AI ───────────────────────────────────────────
app.use('/api/vehicle-models', createCrudRouter(VehicleModel, 'Vehicle Model', aiPrompts.vehicleModel));
app.use('/api/sensor-configs', createCrudRouter(SensorConfig, 'Sensor Configuration', aiPrompts.sensorConfig));
app.use('/api/driving-scenarios', createCrudRouter(DrivingScenario, 'Driving Scenario', aiPrompts.drivingScenario));
app.use('/api/training-sessions', createCrudRouter(TrainingSession, 'Training Session', aiPrompts.trainingSession));
app.use('/api/simulation-results', createCrudRouter(SimulationResult, 'Simulation Result', aiPrompts.simulationResult));
app.use('/api/route-plans', createCrudRouter(RoutePlan, 'Route Plan', aiPrompts.routePlan));
app.use('/api/object-detections', createCrudRouter(ObjectDetection, 'Object Detection', aiPrompts.objectDetection));
app.use('/api/traffic-simulations', createCrudRouter(TrafficSimulation, 'Traffic Simulation', aiPrompts.trafficSimulation));
app.use('/api/weather-simulations', createCrudRouter(WeatherSimulation, 'Weather Simulation', aiPrompts.weatherSimulation));
app.use('/api/safety-metrics', createCrudRouter(SafetyMetric, 'Safety Metric', aiPrompts.safetyMetric));
app.use('/api/fleet-vehicles', createCrudRouter(FleetVehicle, 'Fleet Vehicle', aiPrompts.fleetVehicle));
app.use('/api/map-environments', createCrudRouter(MapEnvironment, 'Map Environment', aiPrompts.mapEnvironment));
app.use('/api/ai-models', createCrudRouter(AIModel, 'AI Model', aiPrompts.aiModel));
app.use('/api/collision-analyses', createCrudRouter(CollisionAnalysis, 'Collision Analysis', aiPrompts.collisionAnalysis));
app.use('/api/regulatory-compliances', createCrudRouter(RegulatoryCompliance, 'Regulatory Compliance', aiPrompts.regulatoryCompliance));
app.use('/api/odd-coverage-matrix', require('./routes/oddCoverageMatrix'));

// ── Dashboard stats ───────────────────────────────────────────────────────
app.use('/api/dashboard', require('./routes/dashboard'));

// ── Profile, Audit, Favorites ─────────────────────────────────────────────
app.use('/api/profile', require('./routes/profile'));
app.use('/api/audit-logs', require('./routes/audit'));
app.use('/api/favorites', require('./routes/favorites'));

// ── Simulation runs (with param validation) ───────────────────────────────
app.use('/api/simulation-runs', simulationRunsRouter);

// ── Safety metrics dashboard ──────────────────────────────────────────────
app.use('/api/analytics', analyticsRouter);

// ── AI extended: compare-scenarios, compliance-check, SSE stream, new features
app.use('/api/ai', aiExtendedRouter);

// ── Apply pass 5 — backlog extensions (behavior model, env-randomize, carla, lidar/radar, AV platforms)
app.use('/api/ai', require('./routes/extensions'));

// ── AI Results history ────────────────────────────────────────────────────
app.use('/api/ai-results', aiResultsRouter);

// ── Training session progress simulator ─────────────────────────────────
app.use('/api/training-sessions', trainingSessionsRouter);

// ── PDF report generation ─────────────────────────────────────────────────
app.use('/api/simulations', pdfReportRouter);

async function start() {
  try {
    await sequelize.authenticate();
    console.log('Database connected');
    await sequelize.sync();
    app.listen(PORT, () => {
      console.log(`AV Simulator Backend running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();

// BATCH_00_AUDIT_MOUNTS
app.use('/api/scenario-gen', require('./routes/scenarioGen'));
app.use('/api/behavior-cloning', require('./routes/behaviorCloning'));
app.use('/api/safety-metric', require('./routes/safetyMetric'));
app.use('/api/sae-compliance', require('./routes/saeCompliance'));
app.use('/api/av-sim-bridge', require('./routes/avSimBridge'));

// === Batch 00 Gaps & Frontend Mounts ===
app.use('/api/gap-ai-scenario-generation-diverse-edge', require('./routes/gap_ai_scenario_generation_diverse_edge'));
app.use('/api/gap-ai-vehicle-behavior-modeling', require('./routes/gap_ai_vehicle_behavior_modeling'));
app.use('/api/gap-ai-safety-criticality-assessment-failures', require('./routes/gap_ai_safety_criticality_assessment_failures'));
app.use('/api/gap-ai-environment-randomization-stress-testing', require('./routes/gap_ai_environment_randomization_stress_testing'));
app.use('/api/gap-live-av-platform-integration-waymo', require('./routes/gap_live_av_platform_integration_waymo'));
app.use('/api/gap-physics-simulation-engine-bridge', require('./routes/gap_physics_simulation_engine_bridge'));
app.use('/api/gap-lidar-radar-simulation', require('./routes/gap_lidar_radar_simulation'));
app.use('/api/gap-traffic-surrounding-vehicle-modeling', require('./routes/gap_traffic_surrounding_vehicle_modeling'));
app.use('/api/gap-notifications-subsystem', require('./routes/gap_notifications_subsystem'));
app.use('/api/gap-outbound-webhooks', require('./routes/gap_outbound_webhooks'));

// ── Custom Views: 4 endpoints — coverage matrix, sensor-fusion heatmap, scenario PDF, scenario editor CRUD
//    Mounted BEFORE any 404/catch-all handler.
app.use('/api/custom-views', require('./routes/customViews'));
