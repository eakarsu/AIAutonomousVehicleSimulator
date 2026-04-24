const express = require('express');
const { Op } = require('sequelize');
const authMiddleware = require('../middleware/auth');
const { callOpenRouter } = require('../middleware/openrouter');

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
      const queryOptions = { where, order };
      if (page && limit) {
        const offset = (parseInt(page) - 1) * parseInt(limit);
        queryOptions.offset = offset;
        queryOptions.limit = parseInt(limit);

        const { count, rows } = await ModelClass.findAndCountAll(queryOptions);
        return res.json({
          data: rows,
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        });
      }

      const items = await ModelClass.findAll(queryOptions);
      res.json(items);
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

  // AI Analysis
  if (aiPromptFn) {
    router.post('/:id/ai-analyze', authMiddleware, async (req, res) => {
      try {
        const item = await ModelClass.findByPk(req.params.id);
        if (!item) return res.status(404).json({ error: `${modelName} not found` });
        const prompt = aiPromptFn(item.toJSON());
        const result = await callOpenRouter(prompt);
        res.json({ item, aiAnalysis: result });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
  }

  // AI Generate
  router.post('/ai-generate', authMiddleware, async (req, res) => {
    try {
      const { prompt: userPrompt } = req.body;
      const prompt = `Based on this request: "${userPrompt || `Generate a new ${modelName} configuration`}", suggest a detailed ${modelName} configuration for an autonomous vehicle simulator. Provide specific technical details, parameters, and recommendations. Format your response in clear sections with headers.`;
      const result = await callOpenRouter(prompt);
      res.json({ aiResult: result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

// AI prompt functions for each model
const aiPrompts = {
  vehicleModel: (item) => `Analyze this autonomous vehicle model and provide detailed technical assessment, safety recommendations, and optimization suggestions:\n\nVehicle: ${item.name}\nManufacturer: ${item.manufacturer}\nType: ${item.type}\nAutonomy Level: ${item.autonomyLevel}\nMax Speed: ${item.maxSpeed} km/h\nSensor Count: ${item.sensorCount}\nSpecs: ${JSON.stringify(item.specs)}\n\nProvide: 1) Technical Assessment 2) Safety Rating 3) Sensor Recommendations 4) Performance Optimization 5) Regulatory Considerations`,

  sensorConfig: (item) => `Analyze this sensor configuration for autonomous vehicle use and provide detailed technical assessment:\n\nSensor: ${item.name}\nType: ${item.type}\nManufacturer: ${item.manufacturer}\nRange: ${item.range}m\nAccuracy: ${item.accuracy}%\nField of View: ${item.fieldOfView}°\nResolution: ${item.resolution}\nRefresh Rate: ${item.refreshRate}Hz\n\nProvide: 1) Performance Assessment 2) Integration Recommendations 3) Complementary Sensors 4) Limitations & Mitigations 5) Cost-Benefit Analysis`,

  drivingScenario: (item) => `Analyze this autonomous driving test scenario and provide detailed assessment:\n\nScenario: ${item.name}\nCategory: ${item.category}\nDifficulty: ${item.difficulty}\nWeather: ${item.weatherCondition}\nTraffic: ${item.trafficDensity}\nRoad Type: ${item.roadType}\nDuration: ${item.duration}s\n\nProvide: 1) Risk Assessment 2) Required Sensor Suite 3) Algorithm Requirements 4) Expected Challenges 5) Success Criteria`,

  trainingSession: (item) => `Analyze this AI training session for autonomous driving and provide recommendations:\n\nSession: ${item.name}\nModel: ${item.modelName}\nAlgorithm: ${item.algorithm}\nEpochs: ${item.epochs}\nLearning Rate: ${item.learningRate}\nAccuracy: ${item.accuracy}%\nLoss: ${item.loss}\nStatus: ${item.status}\n\nProvide: 1) Training Quality Assessment 2) Hyperparameter Recommendations 3) Data Augmentation Suggestions 4) Model Architecture Improvements 5) Deployment Readiness`,

  simulationResult: (item) => `Analyze this autonomous vehicle simulation result:\n\nTest: ${item.name}\nScenario: ${item.scenarioName}\nVehicle: ${item.vehicleName}\nSuccess Rate: ${item.successRate}%\nCollisions: ${item.collisions}\nNear Misses: ${item.nearMisses}\nAvg Speed: ${item.avgSpeed} km/h\nDistance: ${item.totalDistance} km\nGrade: ${item.grade}\n\nProvide: 1) Performance Analysis 2) Safety Assessment 3) Areas for Improvement 4) Comparison Benchmarks 5) Recommendations for Next Test`,

  routePlan: (item) => `Analyze this autonomous vehicle route plan:\n\nRoute: ${item.name}\nOrigin: ${item.origin}\nDestination: ${item.destination}\nDistance: ${item.distance} km\nEstimated Time: ${item.estimatedTime} min\nAlgorithm: ${item.algorithm}\nWaypoints: ${item.waypoints}\nOptimization: ${item.optimizationType}\n\nProvide: 1) Route Efficiency Analysis 2) Safety Considerations 3) Alternative Routes 4) Algorithm Optimization 5) Real-time Adaptation Strategies`,

  objectDetection: (item) => `Analyze this object detection system for autonomous vehicles:\n\nSystem: ${item.name}\nObject Type: ${item.objectType}\nModel: ${item.detectionModel}\nConfidence: ${item.confidence}%\nPrecision: ${item.precision}%\nRecall: ${item.recall}%\nF1 Score: ${item.f1Score}\nInference Time: ${item.inferenceTime}ms\n\nProvide: 1) Detection Performance Analysis 2) Real-time Capability Assessment 3) Edge Cases & Limitations 4) Model Improvement Suggestions 5) Integration with Other Systems`,

  trafficSimulation: (item) => `Analyze this traffic simulation for autonomous vehicle testing:\n\nSimulation: ${item.name}\nType: ${item.scenarioType}\nVehicles: ${item.vehicleCount}\nPedestrians: ${item.pedestrianCount}\nFlow Rate: ${item.avgFlowRate} veh/hr\nCongestion: ${item.congestionLevel}\nIntersections: ${item.intersections}\n\nProvide: 1) Traffic Flow Analysis 2) AV Navigation Challenges 3) Optimization Opportunities 4) Safety Hotspots 5) Recommended Test Parameters`,

  weatherSimulation: (item) => `Analyze this weather simulation for autonomous vehicle testing:\n\nCondition: ${item.name}\nWeather: ${item.weatherType}\nIntensity: ${item.intensity}\nVisibility: ${item.visibility}m\nWind: ${item.windSpeed} km/h\nPrecipitation: ${item.precipitation} mm/hr\nTemperature: ${item.temperature}°C\nRoad: ${item.roadCondition}\n\nProvide: 1) Driving Safety Impact 2) Sensor Performance Effects 3) Required Adaptations 4) Risk Mitigation Strategies 5) Recommended Speed Adjustments`,

  safetyMetric: (item) => `Analyze this safety metric for autonomous vehicles:\n\nMetric: ${item.name}\nCategory: ${item.category}\nScore: ${item.score}/${item.maxScore}\nTests: ${item.testCount}\nPass Rate: ${item.passRate}%\nRisk Level: ${item.riskLevel}\nStandard: ${item.standard}\n\nProvide: 1) Safety Score Assessment 2) Industry Benchmark Comparison 3) Improvement Priorities 4) Regulatory Implications 5) Action Items for Better Safety`,

  fleetVehicle: (item) => `Analyze this fleet vehicle status and provide maintenance/operational recommendations:\n\nVehicle: ${item.name} (${item.vehicleId})\nModel: ${item.model}\nLocation: ${item.location}\nMileage: ${item.mileage} km\nBattery: ${item.batteryLevel}%\nStatus: ${item.operationalStatus}\n\nProvide: 1) Vehicle Health Assessment 2) Maintenance Recommendations 3) Operational Efficiency 4) Battery Management 5) Fleet Optimization Suggestions`,

  mapEnvironment: (item) => `Analyze this simulation map environment:\n\nMap: ${item.name}\nType: ${item.environmentType}\nSize: ${item.size} km²\nComplexity: ${item.complexity}\nLanes: ${item.laneCount}\nRegion: ${item.region}\n\nProvide: 1) Environment Complexity Analysis 2) AV Testing Suitability 3) Scenario Suggestions 4) Infrastructure Requirements 5) Realism Assessment`,

  aiModel: (item) => `Analyze this AI model for autonomous driving:\n\nModel: ${item.name} v${item.version}\nFramework: ${item.framework}\nArchitecture: ${item.architecture}\nParameters: ${item.parameters}\nAccuracy: ${item.accuracy}%\nInference: ${item.inferenceSpeed}ms\nTrained On: ${item.trainedOn}\n\nProvide: 1) Model Performance Assessment 2) Architecture Review 3) Optimization Opportunities 4) Deployment Recommendations 5) Comparison with State-of-the-Art`,

  collisionAnalysis: (item) => `Analyze this collision/near-miss incident and provide prevention recommendations:\n\nIncident: ${item.name}\nType: ${item.collisionType}\nSeverity: ${item.severity}\nSpeed: ${item.speed} km/h\nCause: ${item.cause}\nAvoidable: ${item.avoidable}\nVehicle: ${item.vehicleInvolved}\nLocation: ${item.location}\n\nProvide: 1) Root Cause Analysis 2) Prevention Strategies 3) System Improvements 4) Similar Incident Patterns 5) Algorithm Updates Needed`,

  regulatoryCompliance: (item) => `Analyze this regulatory compliance status for autonomous vehicles:\n\nRegulation: ${item.name}\nStandard: ${item.regulation}\nJurisdiction: ${item.jurisdiction}\nSAE Level: ${item.saeLevel}\nCompliance: ${item.complianceStatus}\nCertification: ${item.certificationBody}\n\nProvide: 1) Compliance Gap Analysis 2) Required Actions 3) Timeline Recommendations 4) Cross-jurisdictional Impact 5) Risk of Non-Compliance`
};

module.exports = { createCrudRouter, aiPrompts };
