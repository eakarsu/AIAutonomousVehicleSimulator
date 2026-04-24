const sequelize = require('../config/database');
const { DataTypes } = require('sequelize');

// User Model
const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  email: { type: DataTypes.STRING, unique: true, allowNull: false },
  password: { type: DataTypes.STRING, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.STRING, defaultValue: 'user' }
}, { tableName: 'users', timestamps: true });

// Vehicle Models
const VehicleModel = sequelize.define('VehicleModel', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  manufacturer: { type: DataTypes.STRING, allowNull: false },
  type: { type: DataTypes.STRING, allowNull: false },
  autonomyLevel: { type: DataTypes.INTEGER, allowNull: false },
  maxSpeed: { type: DataTypes.FLOAT },
  sensorCount: { type: DataTypes.INTEGER },
  status: { type: DataTypes.STRING, defaultValue: 'active' },
  description: { type: DataTypes.TEXT },
  specs: { type: DataTypes.JSONB, defaultValue: {} }
}, { tableName: 'vehicle_models', timestamps: true });

// Sensor Configurations
const SensorConfig = sequelize.define('SensorConfig', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  type: { type: DataTypes.STRING, allowNull: false },
  manufacturer: { type: DataTypes.STRING },
  range: { type: DataTypes.FLOAT },
  accuracy: { type: DataTypes.FLOAT },
  fieldOfView: { type: DataTypes.FLOAT },
  resolution: { type: DataTypes.STRING },
  refreshRate: { type: DataTypes.FLOAT },
  status: { type: DataTypes.STRING, defaultValue: 'active' },
  description: { type: DataTypes.TEXT },
  specs: { type: DataTypes.JSONB, defaultValue: {} }
}, { tableName: 'sensor_configs', timestamps: true });

// Driving Scenarios
const DrivingScenario = sequelize.define('DrivingScenario', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  category: { type: DataTypes.STRING, allowNull: false },
  difficulty: { type: DataTypes.STRING },
  weatherCondition: { type: DataTypes.STRING },
  trafficDensity: { type: DataTypes.STRING },
  roadType: { type: DataTypes.STRING },
  duration: { type: DataTypes.INTEGER },
  status: { type: DataTypes.STRING, defaultValue: 'active' },
  description: { type: DataTypes.TEXT },
  parameters: { type: DataTypes.JSONB, defaultValue: {} }
}, { tableName: 'driving_scenarios', timestamps: true });

// Training Sessions
const TrainingSession = sequelize.define('TrainingSession', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  modelName: { type: DataTypes.STRING, allowNull: false },
  algorithm: { type: DataTypes.STRING },
  epochs: { type: DataTypes.INTEGER },
  learningRate: { type: DataTypes.FLOAT },
  accuracy: { type: DataTypes.FLOAT },
  loss: { type: DataTypes.FLOAT },
  status: { type: DataTypes.STRING, defaultValue: 'pending' },
  startedAt: { type: DataTypes.DATE },
  completedAt: { type: DataTypes.DATE },
  description: { type: DataTypes.TEXT },
  metrics: { type: DataTypes.JSONB, defaultValue: {} }
}, { tableName: 'training_sessions', timestamps: true });

// Simulation Results
const SimulationResult = sequelize.define('SimulationResult', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  scenarioName: { type: DataTypes.STRING },
  vehicleName: { type: DataTypes.STRING },
  successRate: { type: DataTypes.FLOAT },
  collisions: { type: DataTypes.INTEGER, defaultValue: 0 },
  nearMisses: { type: DataTypes.INTEGER, defaultValue: 0 },
  avgSpeed: { type: DataTypes.FLOAT },
  totalDistance: { type: DataTypes.FLOAT },
  duration: { type: DataTypes.INTEGER },
  grade: { type: DataTypes.STRING },
  status: { type: DataTypes.STRING, defaultValue: 'completed' },
  description: { type: DataTypes.TEXT },
  details: { type: DataTypes.JSONB, defaultValue: {} }
}, { tableName: 'simulation_results', timestamps: true });

// Route Planning
const RoutePlan = sequelize.define('RoutePlan', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  origin: { type: DataTypes.STRING, allowNull: false },
  destination: { type: DataTypes.STRING, allowNull: false },
  distance: { type: DataTypes.FLOAT },
  estimatedTime: { type: DataTypes.INTEGER },
  algorithm: { type: DataTypes.STRING },
  waypoints: { type: DataTypes.INTEGER, defaultValue: 0 },
  optimizationType: { type: DataTypes.STRING },
  status: { type: DataTypes.STRING, defaultValue: 'planned' },
  description: { type: DataTypes.TEXT },
  routeData: { type: DataTypes.JSONB, defaultValue: {} }
}, { tableName: 'route_plans', timestamps: true });

// Object Detection
const ObjectDetection = sequelize.define('ObjectDetection', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  objectType: { type: DataTypes.STRING, allowNull: false },
  detectionModel: { type: DataTypes.STRING },
  confidence: { type: DataTypes.FLOAT },
  precision: { type: DataTypes.FLOAT },
  recall: { type: DataTypes.FLOAT },
  f1Score: { type: DataTypes.FLOAT },
  inferenceTime: { type: DataTypes.FLOAT },
  status: { type: DataTypes.STRING, defaultValue: 'active' },
  description: { type: DataTypes.TEXT },
  parameters: { type: DataTypes.JSONB, defaultValue: {} }
}, { tableName: 'object_detections', timestamps: true });

// Traffic Simulation
const TrafficSimulation = sequelize.define('TrafficSimulation', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  scenarioType: { type: DataTypes.STRING, allowNull: false },
  vehicleCount: { type: DataTypes.INTEGER },
  pedestrianCount: { type: DataTypes.INTEGER },
  avgFlowRate: { type: DataTypes.FLOAT },
  congestionLevel: { type: DataTypes.STRING },
  intersections: { type: DataTypes.INTEGER },
  duration: { type: DataTypes.INTEGER },
  status: { type: DataTypes.STRING, defaultValue: 'active' },
  description: { type: DataTypes.TEXT },
  config: { type: DataTypes.JSONB, defaultValue: {} }
}, { tableName: 'traffic_simulations', timestamps: true });

// Weather Simulation
const WeatherSimulation = sequelize.define('WeatherSimulation', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  weatherType: { type: DataTypes.STRING, allowNull: false },
  intensity: { type: DataTypes.STRING },
  visibility: { type: DataTypes.FLOAT },
  windSpeed: { type: DataTypes.FLOAT },
  precipitation: { type: DataTypes.FLOAT },
  temperature: { type: DataTypes.FLOAT },
  roadCondition: { type: DataTypes.STRING },
  status: { type: DataTypes.STRING, defaultValue: 'active' },
  description: { type: DataTypes.TEXT },
  parameters: { type: DataTypes.JSONB, defaultValue: {} }
}, { tableName: 'weather_simulations', timestamps: true });

// Safety Metrics
const SafetyMetric = sequelize.define('SafetyMetric', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  category: { type: DataTypes.STRING, allowNull: false },
  score: { type: DataTypes.FLOAT },
  maxScore: { type: DataTypes.FLOAT, defaultValue: 100 },
  testCount: { type: DataTypes.INTEGER },
  passRate: { type: DataTypes.FLOAT },
  riskLevel: { type: DataTypes.STRING },
  standard: { type: DataTypes.STRING },
  status: { type: DataTypes.STRING, defaultValue: 'active' },
  description: { type: DataTypes.TEXT },
  details: { type: DataTypes.JSONB, defaultValue: {} }
}, { tableName: 'safety_metrics', timestamps: true });

// Fleet Management
const FleetVehicle = sequelize.define('FleetVehicle', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  vehicleId: { type: DataTypes.STRING, unique: true },
  model: { type: DataTypes.STRING },
  location: { type: DataTypes.STRING },
  mileage: { type: DataTypes.FLOAT },
  batteryLevel: { type: DataTypes.FLOAT },
  lastMaintenance: { type: DataTypes.DATE },
  nextMaintenance: { type: DataTypes.DATE },
  operationalStatus: { type: DataTypes.STRING, defaultValue: 'operational' },
  status: { type: DataTypes.STRING, defaultValue: 'active' },
  description: { type: DataTypes.TEXT },
  telemetry: { type: DataTypes.JSONB, defaultValue: {} }
}, { tableName: 'fleet_vehicles', timestamps: true });

// Map Environments
const MapEnvironment = sequelize.define('MapEnvironment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  environmentType: { type: DataTypes.STRING, allowNull: false },
  size: { type: DataTypes.FLOAT },
  complexity: { type: DataTypes.STRING },
  laneCount: { type: DataTypes.INTEGER },
  hasIntersections: { type: DataTypes.BOOLEAN, defaultValue: true },
  hasPedestrians: { type: DataTypes.BOOLEAN, defaultValue: true },
  region: { type: DataTypes.STRING },
  status: { type: DataTypes.STRING, defaultValue: 'active' },
  description: { type: DataTypes.TEXT },
  features: { type: DataTypes.JSONB, defaultValue: {} }
}, { tableName: 'map_environments', timestamps: true });

// AI Models
const AIModel = sequelize.define('AIModel', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  version: { type: DataTypes.STRING },
  framework: { type: DataTypes.STRING },
  architecture: { type: DataTypes.STRING },
  parameters: { type: DataTypes.STRING },
  accuracy: { type: DataTypes.FLOAT },
  inferenceSpeed: { type: DataTypes.FLOAT },
  trainedOn: { type: DataTypes.STRING },
  status: { type: DataTypes.STRING, defaultValue: 'active' },
  description: { type: DataTypes.TEXT },
  config: { type: DataTypes.JSONB, defaultValue: {} }
}, { tableName: 'ai_models', timestamps: true });

// Collision Analysis
const CollisionAnalysis = sequelize.define('CollisionAnalysis', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  collisionType: { type: DataTypes.STRING, allowNull: false },
  severity: { type: DataTypes.STRING },
  speed: { type: DataTypes.FLOAT },
  cause: { type: DataTypes.STRING },
  avoidable: { type: DataTypes.BOOLEAN },
  vehicleInvolved: { type: DataTypes.STRING },
  location: { type: DataTypes.STRING },
  recommendations: { type: DataTypes.TEXT },
  status: { type: DataTypes.STRING, defaultValue: 'analyzed' },
  description: { type: DataTypes.TEXT },
  data: { type: DataTypes.JSONB, defaultValue: {} }
}, { tableName: 'collision_analyses', timestamps: true });

// Regulatory Compliance
const RegulatoryCompliance = sequelize.define('RegulatoryCompliance', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  regulation: { type: DataTypes.STRING, allowNull: false },
  jurisdiction: { type: DataTypes.STRING },
  saeLevel: { type: DataTypes.STRING },
  complianceStatus: { type: DataTypes.STRING },
  lastAudit: { type: DataTypes.DATE },
  nextAudit: { type: DataTypes.DATE },
  certificationBody: { type: DataTypes.STRING },
  status: { type: DataTypes.STRING, defaultValue: 'active' },
  description: { type: DataTypes.TEXT },
  requirements: { type: DataTypes.JSONB, defaultValue: {} }
}, { tableName: 'regulatory_compliances', timestamps: true });

// Audit Log
const AuditLog = sequelize.define('AuditLog', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER },
  userName: { type: DataTypes.STRING },
  action: { type: DataTypes.STRING, allowNull: false },
  entityType: { type: DataTypes.STRING },
  entityId: { type: DataTypes.INTEGER },
  entityName: { type: DataTypes.STRING },
  details: { type: DataTypes.JSONB, defaultValue: {} },
  ipAddress: { type: DataTypes.STRING }
}, { tableName: 'audit_logs', timestamps: true, updatedAt: false });

// Favorites
const Favorite = sequelize.define('Favorite', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  entityType: { type: DataTypes.STRING, allowNull: false },
  entityId: { type: DataTypes.INTEGER, allowNull: false },
  entityName: { type: DataTypes.STRING },
  notes: { type: DataTypes.TEXT }
}, { tableName: 'favorites', timestamps: true });

module.exports = {
  sequelize,
  User,
  VehicleModel,
  SensorConfig,
  DrivingScenario,
  TrainingSession,
  SimulationResult,
  RoutePlan,
  ObjectDetection,
  TrafficSimulation,
  WeatherSimulation,
  SafetyMetric,
  FleetVehicle,
  MapEnvironment,
  AIModel,
  CollisionAnalysis,
  RegulatoryCompliance,
  AuditLog,
  Favorite
};
