const express = require('express');
const authMiddleware = require('../middleware/auth');
const { callOpenRouter } = require('../middleware/openrouter');
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

// ── GET /api/dashboard/risk-score ─────────────────────────────────────────
router.get('/risk-score', authMiddleware, async (req, res) => {
  try {
    const [safetyMetrics, simResults, collisions, compliances] = await Promise.all([
      SafetyMetric.findAll({ attributes: ['score', 'maxScore', 'passRate', 'riskLevel', 'category'] }),
      SimulationResult.findAll({ attributes: ['grade', 'successRate', 'collisions'] }),
      CollisionAnalysis.findAll({ attributes: ['severity', 'avoidable'] }),
      RegulatoryCompliance.findAll({ attributes: ['complianceStatus'] }),
    ]);

    // Compute raw risk components
    const avgSafetyScore = safetyMetrics.length
      ? safetyMetrics.reduce((s, m) => s + ((m.score / (m.maxScore || 100)) * 100), 0) / safetyMetrics.length
      : 50;
    const avgSimSuccess = simResults.length
      ? simResults.reduce((s, r) => s + (r.successRate || 0), 0) / simResults.length
      : 50;
    const criticalCollisions = collisions.filter(c => c.severity === 'critical' || c.severity === 'high').length;
    const compliancePass = compliances.filter(c => c.complianceStatus === 'compliant' || c.complianceStatus === 'passed').length;
    const compliancePct = compliances.length ? (compliancePass / compliances.length) * 100 : 50;

    // Weighted risk index (lower = safer)
    const riskIndex = Math.max(0, Math.min(100,
      100
      - (avgSafetyScore * 0.35)
      - (avgSimSuccess * 0.30)
      - (compliancePct * 0.20)
      + (criticalCollisions * 2)
    ));

    const riskLabel = riskIndex < 20 ? 'Low' : riskIndex < 40 ? 'Moderate' : riskIndex < 65 ? 'High' : 'Critical';

    // AI narrative
    const prompt = `Generate a brief risk narrative for an AV simulator fleet with these metrics:
Risk Index: ${riskIndex.toFixed(1)}/100 (${riskLabel})
Average Safety Score: ${avgSafetyScore.toFixed(1)}%
Average Simulation Success: ${avgSimSuccess.toFixed(1)}%
Compliance Rate: ${compliancePct.toFixed(1)}%
Critical/High Collisions: ${criticalCollisions}`;

    const systemPrompt = `You are an AV safety expert. Respond ONLY with valid JSON with keys: narrative (string, 2-3 sentences), top_risks (array of strings, max 3), immediate_actions (array of strings, max 3).`;
    const aiResult = await callOpenRouter(prompt, systemPrompt, true);

    res.json({
      risk_index: parseFloat(riskIndex.toFixed(1)),
      risk_label: riskLabel,
      components: {
        avg_safety_score: parseFloat(avgSafetyScore.toFixed(1)),
        avg_sim_success: parseFloat(avgSimSuccess.toFixed(1)),
        compliance_pct: parseFloat(compliancePct.toFixed(1)),
        critical_collisions: criticalCollisions
      },
      ai_narrative: aiResult,
      computed_at: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
