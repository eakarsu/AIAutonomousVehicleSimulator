const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { sequelize, VehicleModel, SensorConfig, DrivingScenario, TrainingSession,
  SimulationResult, RoutePlan, ObjectDetection, TrafficSimulation,
  WeatherSimulation, SafetyMetric, FleetVehicle, MapEnvironment,
  AIModel, CollisionAnalysis, RegulatoryCompliance, AuditLog, Favorite } = require('./models');
const authRoutes = require('./routes/auth');
const { createCrudRouter, aiPrompts } = require('./routes/crud');

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Auth routes
app.use('/api/auth', authRoutes);

// Feature CRUD routes with AI
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

// Dashboard stats
app.use('/api/dashboard', require('./routes/dashboard'));

// Profile, Audit, Favorites
app.use('/api/profile', require('./routes/profile'));
app.use('/api/audit-logs', require('./routes/audit'));
app.use('/api/favorites', require('./routes/favorites'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function start() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');
    await sequelize.sync();
    app.listen(PORT, () => {
      console.log(`🚗 AV Simulator Backend running on port ${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

start();
