const express = require('express');
const authMiddleware = require('../middleware/auth');
const { VehicleModel, SensorConfig, DrivingScenario, TrainingSession,
  SimulationResult, RoutePlan, ObjectDetection, TrafficSimulation,
  WeatherSimulation, SafetyMetric, FleetVehicle, MapEnvironment,
  AIModel, CollisionAnalysis, RegulatoryCompliance } = require('../models');

const router = express.Router();

router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const [vehicles, sensors, scenarios, trainings, results, routes, detections,
      traffic, weather, safety, fleet, maps, aiModels, collisions, compliance] = await Promise.all([
      VehicleModel.count(), SensorConfig.count(), DrivingScenario.count(),
      TrainingSession.count(), SimulationResult.count(), RoutePlan.count(),
      ObjectDetection.count(), TrafficSimulation.count(), WeatherSimulation.count(),
      SafetyMetric.count(), FleetVehicle.count(), MapEnvironment.count(),
      AIModel.count(), CollisionAnalysis.count(), RegulatoryCompliance.count()
    ]);

    res.json({
      vehicleModels: vehicles, sensorConfigs: sensors, drivingScenarios: scenarios,
      trainingSessions: trainings, simulationResults: results, routePlans: routes,
      objectDetections: detections, trafficSimulations: traffic, weatherSimulations: weather,
      safetyMetrics: safety, fleetVehicles: fleet, mapEnvironments: maps,
      aiModels: aiModels, collisionAnalyses: collisions, regulatoryCompliances: compliance
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/analytics', authMiddleware, async (req, res) => {
  try {
    // Status distribution across all models
    const statusCounts = {};
    const models = [
      { name: 'vehicleModels', model: VehicleModel },
      { name: 'sensorConfigs', model: SensorConfig },
      { name: 'drivingScenarios', model: DrivingScenario },
      { name: 'trainingSessions', model: TrainingSession },
      { name: 'simulationResults', model: SimulationResult },
    ];

    for (const m of models) {
      const items = await m.model.findAll({ attributes: ['status'] });
      statusCounts[m.name] = {};
      items.forEach(item => {
        const s = item.status || 'unknown';
        statusCounts[m.name][s] = (statusCounts[m.name][s] || 0) + 1;
      });
    }

    // Training accuracy over time
    const trainingSessions = await TrainingSession.findAll({
      attributes: ['name', 'accuracy', 'loss', 'algorithm', 'status', 'createdAt'],
      order: [['createdAt', 'ASC']]
    });

    // Simulation grades distribution
    const simResults = await SimulationResult.findAll({
      attributes: ['grade', 'successRate', 'collisions', 'createdAt']
    });
    const gradeDistribution = {};
    simResults.forEach(r => {
      const g = r.grade || 'Ungraded';
      gradeDistribution[g] = (gradeDistribution[g] || 0) + 1;
    });

    // Safety risk levels
    const safetyMetrics = await SafetyMetric.findAll({
      attributes: ['riskLevel', 'score', 'passRate', 'category']
    });
    const riskDistribution = {};
    safetyMetrics.forEach(m => {
      const r = m.riskLevel || 'Unknown';
      riskDistribution[r] = (riskDistribution[r] || 0) + 1;
    });

    // Fleet battery levels
    const fleetVehicles = await FleetVehicle.findAll({
      attributes: ['name', 'batteryLevel', 'mileage', 'operationalStatus']
    });

    // Recent activity (last 10 items across all tables)
    const recentItems = [];
    const allModels = [VehicleModel, SensorConfig, DrivingScenario, TrainingSession, SimulationResult,
      RoutePlan, ObjectDetection, TrafficSimulation, WeatherSimulation, SafetyMetric,
      FleetVehicle, MapEnvironment, AIModel, CollisionAnalysis, RegulatoryCompliance];
    const modelNames = ['Vehicle Model', 'Sensor Config', 'Driving Scenario', 'Training Session', 'Simulation Result',
      'Route Plan', 'Object Detection', 'Traffic Simulation', 'Weather Simulation', 'Safety Metric',
      'Fleet Vehicle', 'Map Environment', 'AI Model', 'Collision Analysis', 'Regulatory Compliance'];

    for (let i = 0; i < allModels.length; i++) {
      const latest = await allModels[i].findAll({ order: [['updatedAt', 'DESC']], limit: 2 });
      latest.forEach(item => {
        recentItems.push({
          type: modelNames[i],
          name: item.name,
          status: item.status || item.operationalStatus || item.complianceStatus,
          updatedAt: item.updatedAt
        });
      });
    }
    recentItems.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    res.json({
      statusCounts,
      trainingSessions: trainingSessions.map(t => t.toJSON()),
      gradeDistribution,
      riskDistribution,
      fleetVehicles: fleetVehicles.map(f => f.toJSON()),
      recentActivity: recentItems.slice(0, 15)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
