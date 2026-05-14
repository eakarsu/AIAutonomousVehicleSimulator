const express = require('express');
const { Op } = require('sequelize');
const authMiddleware = require('../middleware/auth');
const { callOpenRouter, parseAIJson } = require('../middleware/openrouter');

/**
 * Persist an AI result to the ai_results table.
 */
async function persistAIResult({ userId, analysisType, entityType, entityId, entityName, prompt, result }) {
  try {
    const { AIResult } = require('../models');
    await AIResult.create({
      userId,
      analysisType,
      entityType,
      entityId,
      entityName,
      prompt,
      content: result.content || null,
      parsed: result.parsed || null,
      model: result.model || null,
      promptTokens: result.usage?.prompt_tokens || null,
      completionTokens: result.usage?.completion_tokens || null,
      success: result.success !== false
    });
  } catch (e) {
    // Non-fatal: log but don't break the response
    console.error('Failed to persist AI result:', e.message);
  }
}

function createCrudRouter(ModelClass, modelName, aiPromptFn) {
  const router = express.Router();

  // Get all with search, filter, sort, pagination
  router.get('/', authMiddleware, async (req, res) => {
    try {
      const { search, sortBy, sortOrder, page, limit, ...filters } = req.query;
      const where = {};

      // Search
      if (search) {
        where[Op.or] = [
          { name: { [Op.iLike]: `%${search}%` } },
          { description: { [Op.iLike]: `%${search}%` } }
        ];
      }

      // Filters (exclude pagination/sort params)
      const excludeParams = ['search', 'sortBy', 'sortOrder', 'page', 'limit', 'format'];
      Object.keys(filters).forEach(key => {
        if (!excludeParams.includes(key) && filters[key]) {
          where[key] = filters[key];
        }
      });

      // Sort
      const order = [[sortBy || 'id', (sortOrder || 'ASC').toUpperCase()]];

      // Pagination
      const pg = parseInt(page || '1', 10);
      const lm = parseInt(limit || '20', 10);
      const offset = (pg - 1) * lm;

      const { count, rows } = await ModelClass.findAndCountAll({ where, order, offset, limit: lm });
      return res.json({
        data: rows,
        total: count,
        page: pg,
        limit: lm,
        totalPages: Math.ceil(count / lm)
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Export
  router.get('/export', authMiddleware, async (req, res) => {
    try {
      const { format } = req.query;
      const items = await ModelClass.findAll({ order: [['id', 'ASC']] });
      const data = items.map(i => i.toJSON());

      if (format === 'csv') {
        if (data.length === 0) return res.status(200).send('');
        const headers = Object.keys(data[0]);
        const csvRows = [headers.join(',')];
        data.forEach(row => {
          csvRows.push(headers.map(h => {
            let val = row[h];
            if (val === null || val === undefined) val = '';
            if (typeof val === 'object') val = JSON.stringify(val);
            val = String(val).replace(/"/g, '""');
            return `"${val}"`;
          }).join(','));
        });
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${modelName.replace(/\s+/g, '_')}_export.csv`);
        return res.send(csvRows.join('\n'));
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=${modelName.replace(/\s+/g, '_')}_export.json`);
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get one
  router.get('/:id', authMiddleware, async (req, res) => {
    try {
      const item = await ModelClass.findByPk(req.params.id);
      if (!item) return res.status(404).json({ error: `${modelName} not found` });
      res.json(item);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Create
  router.post('/', authMiddleware, async (req, res) => {
    try {
      const item = await ModelClass.create(req.body);
      res.status(201).json(item);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Bulk delete
  router.post('/bulk-delete', authMiddleware, async (req, res) => {
    try {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'No IDs provided' });
      }
      const deleted = await ModelClass.destroy({ where: { id: { [Op.in]: ids } } });
      res.json({ message: `${deleted} items deleted`, deleted });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Bulk import
  router.post('/import', authMiddleware, async (req, res) => {
    try {
      const { data } = req.body;
      if (!data || !Array.isArray(data) || data.length === 0) {
        return res.status(400).json({ error: 'No data provided' });
      }
      const cleaned = data.map(item => {
        const { id, createdAt, updatedAt, ...rest } = item;
        return rest;
      });
      const items = await ModelClass.bulkCreate(cleaned);
      res.status(201).json({ message: `${items.length} items imported`, count: items.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Duplicate
  router.post('/:id/duplicate', authMiddleware, async (req, res) => {
    try {
      const item = await ModelClass.findByPk(req.params.id);
      if (!item) return res.status(404).json({ error: `${modelName} not found` });
      const data = item.toJSON();
      delete data.id;
      delete data.createdAt;
      delete data.updatedAt;
      data.name = `${data.name} (Copy)`;
      const newItem = await ModelClass.create(data);
      res.status(201).json(newItem);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update
  router.put('/:id', authMiddleware, async (req, res) => {
    try {
      const item = await ModelClass.findByPk(req.params.id);
      if (!item) return res.status(404).json({ error: `${modelName} not found` });
      await item.update(req.body);
      res.json(item);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete
  router.delete('/:id', authMiddleware, async (req, res) => {
    try {
      const item = await ModelClass.findByPk(req.params.id);
      if (!item) return res.status(404).json({ error: `${modelName} not found` });
      await item.destroy();
      res.json({ message: `${modelName} deleted successfully` });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // AI Analysis — structured JSON output + persist
  if (aiPromptFn) {
    router.post('/:id/ai-analyze', authMiddleware, async (req, res) => {
      try {
        const item = await ModelClass.findByPk(req.params.id);
        if (!item) return res.status(404).json({ error: `${modelName} not found` });
        const entityData = item.toJSON();
        const prompt = aiPromptFn(entityData);
        const systemPrompt = `You are an AI expert in autonomous vehicle technology. Respond ONLY with a valid JSON object (no markdown fences) with keys: technical_assessment (string), safety_rating (string), recommendations (array of strings), risks (array of strings), summary (string).`;
        const result = await callOpenRouter(prompt, systemPrompt, true);

        await persistAIResult({
          userId: req.user?.id,
          analysisType: 'analyze',
          entityType: ModelClass.tableName,
          entityId: item.id,
          entityName: entityData.name,
          prompt,
          result
        });

        res.json({ item: entityData, aiAnalysis: result });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
  }

  // AI Generate — structured JSON output + persist
  router.post('/ai-generate', authMiddleware, async (req, res) => {
    try {
      const { prompt: userPrompt } = req.body;
      const prompt = `Based on this request: "${userPrompt || `Generate a new ${modelName} configuration`}", suggest a detailed ${modelName} configuration for an autonomous vehicle simulator. Provide specific technical details, parameters, and recommendations.`;
      const systemPrompt = `You are an AI expert in autonomous vehicle technology. Respond ONLY with a valid JSON object (no markdown fences) with keys: name (string), description (string), key_parameters (object), recommendations (array of strings), technical_notes (string).`;
      const result = await callOpenRouter(prompt, systemPrompt, true);

      await persistAIResult({
        userId: req.user?.id,
        analysisType: 'generate',
        entityType: ModelClass.tableName,
        entityId: null,
        entityName: userPrompt || `${modelName} generation`,
        prompt,
        result
      });

      res.json({ aiResult: result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

// AI prompt functions for each model
const aiPrompts = {
  vehicleModel: (item) => `Analyze this autonomous vehicle model and provide detailed technical assessment, safety recommendations, and optimization suggestions:\n\nVehicle: ${item.name}\nManufacturer: ${item.manufacturer}\nType: ${item.type}\nAutonomy Level: ${item.autonomyLevel}\nMax Speed: ${item.maxSpeed} km/h\nSensor Count: ${item.sensorCount}\nSpecs: ${JSON.stringify(item.specs)}\n\nFocus on: Technical Assessment, Safety Rating, Sensor Recommendations, Performance Optimization, Regulatory Considerations`,

  sensorConfig: (item) => `Analyze this sensor configuration for autonomous vehicle use:\n\nSensor: ${item.name}\nType: ${item.type}\nManufacturer: ${item.manufacturer}\nRange: ${item.range}m\nAccuracy: ${item.accuracy}%\nField of View: ${item.fieldOfView}°\nResolution: ${item.resolution}\nRefresh Rate: ${item.refreshRate}Hz\n\nFocus on: Performance Assessment, Integration Recommendations, Complementary Sensors, Limitations, Cost-Benefit`,

  drivingScenario: (item) => `Analyze this autonomous driving test scenario:\n\nScenario: ${item.name}\nCategory: ${item.category}\nDifficulty: ${item.difficulty}\nWeather: ${item.weatherCondition}\nTraffic: ${item.trafficDensity}\nRoad Type: ${item.roadType}\nDuration: ${item.duration}s\n\nFocus on: Risk Assessment, Required Sensor Suite, Algorithm Requirements, Expected Challenges, Success Criteria`,

  trainingSession: (item) => `Analyze this AI training session for autonomous driving:\n\nSession: ${item.name}\nModel: ${item.modelName}\nAlgorithm: ${item.algorithm}\nEpochs: ${item.epochs}\nLearning Rate: ${item.learningRate}\nAccuracy: ${item.accuracy}%\nLoss: ${item.loss}\nStatus: ${item.status}\n\nFocus on: Training Quality Assessment, Hyperparameter Recommendations, Data Augmentation, Model Architecture Improvements, Deployment Readiness`,

  simulationResult: (item) => `Analyze this autonomous vehicle simulation result:\n\nTest: ${item.name}\nScenario: ${item.scenarioName}\nVehicle: ${item.vehicleName}\nSuccess Rate: ${item.successRate}%\nCollisions: ${item.collisions}\nNear Misses: ${item.nearMisses}\nAvg Speed: ${item.avgSpeed} km/h\nDistance: ${item.totalDistance} km\nGrade: ${item.grade}\n\nFocus on: Performance Analysis, Safety Assessment, Areas for Improvement, Comparison Benchmarks, Next Test Recommendations`,

  routePlan: (item) => `Analyze this autonomous vehicle route plan:\n\nRoute: ${item.name}\nOrigin: ${item.origin}\nDestination: ${item.destination}\nDistance: ${item.distance} km\nEstimated Time: ${item.estimatedTime} min\nAlgorithm: ${item.algorithm}\nWaypoints: ${item.waypoints}\nOptimization: ${item.optimizationType}\n\nFocus on: Route Efficiency, Safety Considerations, Alternative Routes, Algorithm Optimization, Real-time Adaptation`,

  objectDetection: (item) => `Analyze this object detection system for autonomous vehicles:\n\nSystem: ${item.name}\nObject Type: ${item.objectType}\nModel: ${item.detectionModel}\nConfidence: ${item.confidence}%\nPrecision: ${item.precision}%\nRecall: ${item.recall}%\nF1 Score: ${item.f1Score}\nInference Time: ${item.inferenceTime}ms\n\nFocus on: Detection Performance, Real-time Capability, Edge Cases & Limitations, Model Improvements, System Integration`,

  trafficSimulation: (item) => `Analyze this traffic simulation for autonomous vehicle testing:\n\nSimulation: ${item.name}\nType: ${item.scenarioType}\nVehicles: ${item.vehicleCount}\nPedestrians: ${item.pedestrianCount}\nFlow Rate: ${item.avgFlowRate} veh/hr\nCongestion: ${item.congestionLevel}\nIntersections: ${item.intersections}\n\nFocus on: Traffic Flow Analysis, AV Navigation Challenges, Optimization Opportunities, Safety Hotspots, Recommended Test Parameters`,

  weatherSimulation: (item) => `Analyze this weather simulation for autonomous vehicle testing:\n\nCondition: ${item.name}\nWeather: ${item.weatherType}\nIntensity: ${item.intensity}\nVisibility: ${item.visibility}m\nWind: ${item.windSpeed} km/h\nPrecipitation: ${item.precipitation} mm/hr\nTemperature: ${item.temperature}°C\nRoad: ${item.roadCondition}\n\nFocus on: Driving Safety Impact, Sensor Performance Effects, Required Adaptations, Risk Mitigation, Recommended Speed Adjustments`,

  safetyMetric: (item) => `Analyze this safety metric for autonomous vehicles:\n\nMetric: ${item.name}\nCategory: ${item.category}\nScore: ${item.score}/${item.maxScore}\nTests: ${item.testCount}\nPass Rate: ${item.passRate}%\nRisk Level: ${item.riskLevel}\nStandard: ${item.standard}\n\nFocus on: Safety Score Assessment, Industry Benchmark Comparison, Improvement Priorities, Regulatory Implications, Action Items`,

  fleetVehicle: (item) => `Analyze this fleet vehicle and provide maintenance/operational recommendations:\n\nVehicle: ${item.name} (${item.vehicleId})\nModel: ${item.model}\nLocation: ${item.location}\nMileage: ${item.mileage} km\nBattery: ${item.batteryLevel}%\nStatus: ${item.operationalStatus}\n\nFocus on: Vehicle Health Assessment, Maintenance Recommendations, Operational Efficiency, Battery Management, Fleet Optimization`,

  mapEnvironment: (item) => `Analyze this simulation map environment:\n\nMap: ${item.name}\nType: ${item.environmentType}\nSize: ${item.size} km²\nComplexity: ${item.complexity}\nLanes: ${item.laneCount}\nRegion: ${item.region}\n\nFocus on: Environment Complexity Analysis, AV Testing Suitability, Scenario Suggestions, Infrastructure Requirements, Realism Assessment`,

  aiModel: (item) => `Analyze this AI model for autonomous driving:\n\nModel: ${item.name} v${item.version}\nFramework: ${item.framework}\nArchitecture: ${item.architecture}\nParameters: ${item.parameters}\nAccuracy: ${item.accuracy}%\nInference: ${item.inferenceSpeed}ms\nTrained On: ${item.trainedOn}\n\nFocus on: Model Performance Assessment, Architecture Review, Optimization Opportunities, Deployment Recommendations, State-of-the-Art Comparison`,

  collisionAnalysis: (item) => `Analyze this collision/near-miss incident and provide prevention recommendations:\n\nIncident: ${item.name}\nType: ${item.collisionType}\nSeverity: ${item.severity}\nSpeed: ${item.speed} km/h\nCause: ${item.cause}\nAvoidable: ${item.avoidable}\nVehicle: ${item.vehicleInvolved}\nLocation: ${item.location}\n\nFocus on: Root Cause Analysis, Prevention Strategies, System Improvements, Similar Incident Patterns, Algorithm Updates Needed`,

  regulatoryCompliance: (item) => `Analyze this regulatory compliance status for autonomous vehicles:\n\nRegulation: ${item.name}\nStandard: ${item.regulation}\nJurisdiction: ${item.jurisdiction}\nSAE Level: ${item.saeLevel}\nCompliance: ${item.complianceStatus}\nCertification: ${item.certificationBody}\n\nFocus on: Compliance Gap Analysis, Required Actions, Timeline Recommendations, Cross-jurisdictional Impact, Risk of Non-Compliance`
};

module.exports = { createCrudRouter, aiPrompts };
