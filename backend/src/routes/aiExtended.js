const express = require('express');
const { body, query, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const { callOpenRouter, parseAIJson } = require('../middleware/openrouter');

const router = express.Router();

/**
 * Persist an AI result to the ai_results table (non-fatal).
 */
async function persistAIResult(data) {
  try {
    const { AIResult } = require('../models');
    await AIResult.create({
      userId: data.userId,
      analysisType: data.analysisType,
      entityType: data.entityType || null,
      entityId: data.entityId || null,
      entityName: data.entityName || null,
      prompt: data.prompt || null,
      content: data.result?.content || null,
      parsed: data.result?.parsed || null,
      model: data.result?.model || null,
      promptTokens: data.result?.usage?.prompt_tokens || null,
      completionTokens: data.result?.usage?.completion_tokens || null,
      success: data.result?.success !== false
    });
  } catch (e) {
    console.error('Failed to persist AI result:', e.message);
  }
}

// ── POST /api/ai/compare-scenarios ──────────────────────────────────────────
router.post(
  '/compare-scenarios',
  authMiddleware,
  [
    body('scenario_ids')
      .isArray({ min: 2, max: 2 })
      .withMessage('scenario_ids must be an array of exactly 2 IDs'),
    body('scenario_ids.*').isInt().withMessage('Each scenario ID must be an integer'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    const { scenario_ids } = req.body;
    const { DrivingScenario, SimulationResult } = require('../models');

    try {
      const [scenarioA, scenarioB] = await Promise.all(
        scenario_ids.map((id) => DrivingScenario.findByPk(id))
      );

      if (!scenarioA || !scenarioB) {
        return res.status(404).json({ error: 'One or both scenarios not found' });
      }

      const [runsA, runsB] = await Promise.all([
        SimulationResult.findAll({ where: { scenarioName: scenarioA.name }, order: [['createdAt', 'DESC']], limit: 20 }),
        SimulationResult.findAll({ where: { scenarioName: scenarioB.name }, order: [['createdAt', 'DESC']], limit: 20 }),
      ]);

      const prompt = `Compare these two autonomous driving test scenarios based on their definitions and simulation run history.

Scenario A: ${scenarioA.name}
Category: ${scenarioA.category}, Difficulty: ${scenarioA.difficulty}, Weather: ${scenarioA.weatherCondition}, Traffic: ${scenarioA.trafficDensity}
Run History (${runsA.length} runs): Avg Success Rate: ${runsA.length ? (runsA.reduce((s, r) => s + (r.successRate || 0), 0) / runsA.length).toFixed(2) : 'N/A'}%, Total Collisions: ${runsA.reduce((s, r) => s + (r.collisions || 0), 0)}

Scenario B: ${scenarioB.name}
Category: ${scenarioB.category}, Difficulty: ${scenarioB.difficulty}, Weather: ${scenarioB.weatherCondition}, Traffic: ${scenarioB.trafficDensity}
Run History (${runsB.length} runs): Avg Success Rate: ${runsB.length ? (runsB.reduce((s, r) => s + (r.successRate || 0), 0) / runsB.length).toFixed(2) : 'N/A'}%, Total Collisions: ${runsB.reduce((s, r) => s + (r.collisions || 0), 0)}`;

      const systemPrompt = `You are an expert in autonomous vehicle simulation analysis. Respond ONLY with valid JSON (no markdown fences) with keys: overall_comparison (string), scenario_a_strengths (array), scenario_a_weaknesses (array), scenario_b_strengths (array), scenario_b_weaknesses (array), recommendations (array), better_for_safety (string with explanation).`;

      const result = await callOpenRouter(prompt, systemPrompt, true);

      await persistAIResult({
        userId: req.user?.id,
        analysisType: 'compare-scenarios',
        entityType: 'driving_scenarios',
        entityName: `${scenarioA.name} vs ${scenarioB.name}`,
        prompt,
        result
      });

      res.json({
        scenario_a: scenarioA,
        scenario_b: scenarioB,
        run_history_a: { count: runsA.length, runs: runsA },
        run_history_b: { count: runsB.length, runs: runsB },
        comparison: result,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// ── POST /api/ai/compliance-check ───────────────────────────────────────────
router.post(
  '/compliance-check',
  authMiddleware,
  [
    body('vehicle_id').isInt().withMessage('vehicle_id must be an integer'),
    body('jurisdiction')
      .isIn(['US', 'EU', 'UK', 'CN', 'JP', 'AU', 'CA'])
      .withMessage('jurisdiction must be one of: US, EU, UK, CN, JP, AU, CA'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    const { vehicle_id, jurisdiction } = req.body;
    const { VehicleModel, SimulationResult, RegulatoryCompliance } = require('../models');

    try {
      const vehicle = await VehicleModel.findByPk(vehicle_id);
      if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

      const [simResults, complianceRecords] = await Promise.all([
        SimulationResult.findAll({ where: { vehicleName: vehicle.name }, order: [['createdAt', 'DESC']], limit: 20 }),
        RegulatoryCompliance.findAll({ where: { jurisdiction } }),
      ]);

      const avgSuccessRate = simResults.length
        ? (simResults.reduce((s, r) => s + (r.successRate || 0), 0) / simResults.length).toFixed(2)
        : 'N/A';
      const totalCollisions = simResults.reduce((s, r) => s + (r.collisions || 0), 0);
      const grades = simResults.map((r) => r.grade).filter(Boolean);

      const jurisdictionInfo = {
        US: 'NHTSA AV regulations, FMVSS standards, SAE J3016',
        EU: 'EU 2019/2144 regulation, UNECE WP.29, Euro NCAP',
        UK: 'UK Centre for Connected and Autonomous Vehicles (CCAV) regulations',
        CN: 'China GB standards, MIIT autonomous driving regulations',
        JP: 'Japan Ministry of Land, Infrastructure, Transport and Tourism (MLIT)',
        AU: 'National Transport Commission (NTC) Australia AV regulations',
        CA: 'Transport Canada AV framework, provincial regulations',
      };

      const prompt = `Evaluate whether this autonomous vehicle meets ${jurisdiction} regulations.

Vehicle: ${vehicle.name} | Manufacturer: ${vehicle.manufacturer} | Type: ${vehicle.type}
Autonomy Level: SAE L${vehicle.autonomyLevel} | Max Speed: ${vehicle.maxSpeed} km/h | Sensors: ${vehicle.sensorCount}

Jurisdiction: ${jurisdiction} | Standards: ${jurisdictionInfo[jurisdiction] || 'General AV standards'}

Simulation Performance: ${simResults.length} runs, Avg Success ${avgSuccessRate}%, ${totalCollisions} collisions, Grades: ${grades.join(', ') || 'None'}
Existing Compliance Records: ${complianceRecords.length} for this jurisdiction`;

      const systemPrompt = `You are an expert in AV regulatory compliance. Respond ONLY with valid JSON (no markdown fences) with keys: compliance_status (one of: PASS|FAIL|CONDITIONAL|INSUFFICIENT_DATA), requirements_met (array), requirements_not_met (array), required_actions (array), timeline_estimate (string), risk_assessment (string), next_steps (array).`;

      const result = await callOpenRouter(prompt, systemPrompt, true);

      await persistAIResult({
        userId: req.user?.id,
        analysisType: 'compliance-check',
        entityType: 'vehicle_models',
        entityId: vehicle.id,
        entityName: vehicle.name,
        prompt,
        result
      });

      res.json({
        vehicle,
        jurisdiction,
        simulation_summary: { count: simResults.length, avg_success_rate: avgSuccessRate, total_collisions: totalCollisions },
        existing_compliance_records: complianceRecords,
        compliance_analysis: result,
        checked_at: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// ── POST /api/ai/sensor-fusion-recommendation ────────────────────────────────
router.post(
  '/sensor-fusion-recommendation',
  authMiddleware,
  [
    body('vehicle_id').isInt().withMessage('vehicle_id must be an integer'),
    body('scenario_id').isInt().withMessage('scenario_id must be an integer'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { vehicle_id, scenario_id } = req.body;
    const { VehicleModel, DrivingScenario, SensorConfig } = require('../models');

    try {
      const [vehicle, scenario] = await Promise.all([
        VehicleModel.findByPk(vehicle_id),
        DrivingScenario.findByPk(scenario_id),
      ]);
      if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
      if (!scenario) return res.status(404).json({ error: 'Scenario not found' });

      // Fetch available sensors for context
      const sensors = await SensorConfig.findAll({ limit: 20 });

      const prompt = `Recommend an optimal sensor fusion configuration for this vehicle-scenario combination.

Vehicle: ${vehicle.name} (SAE L${vehicle.autonomyLevel}, ${vehicle.type}, max ${vehicle.maxSpeed} km/h)
Scenario: ${scenario.name} (${scenario.category}, ${scenario.difficulty} difficulty, ${scenario.weatherCondition} weather, ${scenario.trafficDensity} traffic, ${scenario.roadType})

Available sensor types in fleet: ${sensors.map(s => `${s.type} (range: ${s.range}m, FOV: ${s.fieldOfView}°)`).join('; ')}`;

      const systemPrompt = `You are an expert in AV sensor fusion architecture. Respond ONLY with valid JSON (no markdown fences) with keys: recommended_sensors (array of objects with fields: type, count, placement, purpose), fusion_strategy (string), confidence_score (number 0-100), rationale (string), limitations (array), estimated_coverage_pct (number).`;

      const result = await callOpenRouter(prompt, systemPrompt, true);

      await persistAIResult({
        userId: req.user?.id,
        analysisType: 'sensor-fusion',
        entityType: 'vehicle_models',
        entityId: vehicle.id,
        entityName: `${vehicle.name} + ${scenario.name}`,
        prompt,
        result
      });

      res.json({ vehicle, scenario, sensor_fusion: result });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// ── POST /api/ai/score-scenario ──────────────────────────────────────────────
router.post(
  '/score-scenario',
  authMiddleware,
  [
    body('scenario_id').isInt().withMessage('scenario_id must be an integer'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { scenario_id } = req.body;
    const { DrivingScenario, SimulationResult } = require('../models');

    try {
      const scenario = await DrivingScenario.findByPk(scenario_id);
      if (!scenario) return res.status(404).json({ error: 'Scenario not found' });

      // Fetch run history for context
      const runs = await SimulationResult.findAll({
        where: { scenarioName: scenario.name },
        order: [['createdAt', 'DESC']],
        limit: 30
      });

      const avgSuccess = runs.length
        ? (runs.reduce((s, r) => s + (r.successRate || 0), 0) / runs.length).toFixed(1)
        : null;

      const prompt = `Auto-score the difficulty of this autonomous vehicle test scenario.

Scenario: ${scenario.name}
Category: ${scenario.category}
Current difficulty tag: ${scenario.difficulty || 'Not set'}
Weather: ${scenario.weatherCondition}
Traffic density: ${scenario.trafficDensity}
Road type: ${scenario.roadType}
Duration: ${scenario.duration}s
Description: ${scenario.description || 'N/A'}
Parameters: ${JSON.stringify(scenario.parameters || {})}

Historical run data: ${runs.length} runs, average success rate: ${avgSuccess || 'no data'}%`;

      const systemPrompt = `You are an expert in AV scenario difficulty calibration. Respond ONLY with valid JSON (no markdown fences) with keys: difficulty_score (integer 1-10), difficulty_label (one of: Easy|Medium|Hard|Extreme), recommended_autonomy_level (integer 1-5), risk_factors (array of strings), reasoning (string), suggested_improvements (array of strings).`;

      const result = await callOpenRouter(prompt, systemPrompt, true);

      // Update scenario difficulty if we got a valid parsed result
      if (result.success && result.parsed?.difficulty_label) {
        await scenario.update({ difficulty: result.parsed.difficulty_label });
      }

      await persistAIResult({
        userId: req.user?.id,
        analysisType: 'score-scenario',
        entityType: 'driving_scenarios',
        entityId: scenario.id,
        entityName: scenario.name,
        prompt,
        result
      });

      res.json({ scenario, ai_score: result });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// ── GET /api/ai/fleet-maintenance-due ───────────────────────────────────────
router.get('/fleet-maintenance-due', authMiddleware, async (req, res) => {
  try {
    const { FleetVehicle } = require('../models');
    const { Op } = require('sequelize');

    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const dueSoon = await FleetVehicle.findAll({
      where: {
        [Op.or]: [
          { nextMaintenance: { [Op.lte]: sevenDaysFromNow } },
          { batteryLevel: { [Op.lt]: 20 } }
        ]
      },
      order: [['nextMaintenance', 'ASC']]
    });

    if (dueSoon.length === 0) {
      return res.json({ vehicles: [], ai_recommendations: null, message: 'No vehicles due for maintenance in the next 7 days.' });
    }

    const prompt = `These fleet vehicles are due for maintenance or have low battery. Provide prioritized recommendations.

Vehicles:
${dueSoon.map(v => `- ${v.name} (ID: ${v.vehicleId}): battery ${v.batteryLevel}%, mileage ${v.mileage} km, next maintenance: ${v.nextMaintenance ? new Date(v.nextMaintenance).toDateString() : 'overdue'}, status: ${v.operationalStatus}`).join('\n')}`;

    const systemPrompt = `You are a fleet maintenance expert. Respond ONLY with valid JSON (no markdown fences) with keys: priority_order (array of vehicle names from highest to lowest priority), recommendations (array of objects with fields: vehicle_name, priority (High|Medium|Low), action, estimated_downtime_hours), overall_fleet_risk (string: Low|Medium|High|Critical).`;

    const result = await callOpenRouter(prompt, systemPrompt, true);

    await persistAIResult({
      userId: req.user?.id,
      analysisType: 'fleet-maintenance',
      entityType: 'fleet_vehicles',
      entityName: 'maintenance-due batch',
      prompt,
      result
    });

    res.json({ vehicles: dueSoon, ai_recommendations: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /api/ai/analyze-simulation/stream?runId=X ───────────────────────────
router.get('/analyze-simulation/stream', authMiddleware, async (req, res) => {
  const { runId } = req.query;

  if (!runId) {
    return res.status(400).json({ error: 'runId query parameter is required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022';

  try {
    send('status', { step: 1, message: 'Fetching simulation run data...' });

    const db = require('../config/database');
    const [rows] = await db.query('SELECT * FROM simulation_runs WHERE id = $1', {
      bind: [runId],
      type: db.QueryTypes.SELECT,
    }).catch(() => [[]]);

    if (!rows || rows.length === 0) {
      send('error', { message: `Simulation run ${runId} not found` });
      return res.end();
    }

    const run = rows[0];
    send('status', { step: 2, message: 'Fetching related scenario and vehicle data...' });

    const { VehicleModel, DrivingScenario } = require('../models');
    const [vehicle, scenario] = await Promise.all([
      run.vehicle_id ? VehicleModel.findByPk(run.vehicle_id) : null,
      run.scenario_id ? DrivingScenario.findByPk(run.scenario_id) : null,
    ]);

    send('status', { step: 3, message: 'Preparing AI analysis...' });

    const systemPrompt = 'You are an expert autonomous vehicle simulation analyst. Provide a detailed analysis of this simulation run with sections: 1) Executive Summary 2) Performance Analysis 3) Safety Assessment 4) Key Findings 5) Recommendations 6) Pass/Fail Determination. Use markdown.';
    const userPrompt = `Analyze this simulation run:\n${JSON.stringify({ run, vehicle: vehicle?.toJSON(), scenario: scenario?.toJSON() }, null, 2)}`;

    send('status', { step: 4, message: 'Calling AI model (streaming)...' });

    if (!OPENROUTER_API_KEY) {
      send('error', { message: 'OpenRouter API key not configured' });
      return res.end();
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.CLIENT_URL || 'http://localhost:3000',
        'X-Title': 'AV Simulator',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      send('error', { message: `AI API error: ${response.status}` });
      return res.end();
    }

    send('status', { step: 5, message: 'Streaming analysis...' });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let assembledText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (trimmed.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(trimmed.slice(6));
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assembledText += delta;
              send('chunk', { text: delta });
            }
          } catch (_) {}
        }
      }
    }

    // Persist assembled analysis back to simulation_runs
    if (assembledText) {
      try {
        await db.query(
          `UPDATE simulation_runs SET ai_analysis = $1, "updatedAt" = NOW() WHERE id = $2`,
          {
            bind: [JSON.stringify({ report: assembledText, model: OPENROUTER_MODEL, analyzed_at: new Date().toISOString() }), runId],
            type: db.QueryTypes.UPDATE
          }
        );
      } catch (e) {
        console.error('Failed to persist stream analysis:', e.message);
      }

      // Also persist to ai_results table
      try {
        const { AIResult } = require('../models');
        await AIResult.create({
          userId: req.user?.id,
          analysisType: 'stream-analyze',
          entityType: 'simulation_runs',
          entityId: parseInt(runId, 10),
          entityName: `Simulation Run #${runId}`,
          prompt: userPrompt,
          content: assembledText,
          model: OPENROUTER_MODEL,
          success: true
        });
      } catch (e) {
        console.error('Failed to persist stream analysis to ai_results:', e.message);
      }
    }

    send('done', { message: 'Analysis complete', runId });
  } catch (error) {
    send('error', { message: error.message });
  } finally {
    res.end();
  }
});

// ── POST /api/ai/scenario-generate — procedural edge-case scenario generator ──
router.post(
  '/scenario-generate',
  authMiddleware,
  [
    body('domain').optional().isString(),
    body('difficulty').optional().isIn(['easy', 'medium', 'hard', 'edge_case']),
    body('count').optional().isInt({ min: 1, max: 10 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
    try {
      const { domain = 'urban_driving', difficulty = 'edge_case', count = 3, seed_scenarios = [], constraints = null } = req.body;

      const systemPrompt = `You are an AV scenario generator that creates diverse, realistic test scenarios for autonomous vehicle simulation, including rare edge cases. Respond ONLY with valid JSON: {"scenarios":[{"name":"<short>","description":"<text>","environment":{"weather":"<string>","time_of_day":"<string>","road_type":"<string>","traffic_density":"low|medium|high"},"actors":[{"type":"vehicle|pedestrian|cyclist|animal|debris","behavior":"<text>"}],"trigger_event":"<text>","expected_av_response":"<text>","safety_metrics_to_track":["..."],"difficulty":"easy|medium|hard|edge_case"}],"summary":"<text>"}`;
      const prompt = `Generate ${count} ${difficulty} scenarios for ${domain}.
Constraints: ${JSON.stringify(constraints || {})}
Seed scenarios (avoid duplicating but extend): ${JSON.stringify(seed_scenarios)}`;

      const result = await callOpenRouter(prompt, systemPrompt, true);
      await persistAIResult({
        userId: req.user?.id,
        analysisType: 'scenario-generate',
        entityType: 'driving_scenarios',
        entityName: `Generated ${count} ${difficulty} scenarios`,
        prompt,
        result,
      });
      res.json({ generated: result, requested: { domain, difficulty, count } });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ── POST /api/ai/safety-assessment — assess severity / criticality of failures ──
router.post(
  '/safety-assessment',
  authMiddleware,
  [
    body('failure_events').isArray({ min: 1 }).withMessage('failure_events must be a non-empty array'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
    try {
      const { failure_events, vehicle_context, sae_level } = req.body;
      const systemPrompt = `You are an AV safety case auditor (ISO 21448 SOTIF / ISO 26262 ASIL / SAE J3016). Assess each failure event and return ONLY valid JSON: {"assessments":[{"event_ref":"<id|index>","severity":"S0|S1|S2|S3","exposure":"E1|E2|E3|E4","controllability":"C0|C1|C2|C3","asil":"QM|A|B|C|D","sotif_relevant":true|false,"mitigation":"<text>","root_cause_hypothesis":"<text>"}],"overall_safety_grade":"A|B|C|D|F","summary":"<text>"}`;
      const prompt = `Vehicle context: ${JSON.stringify(vehicle_context || {})}
SAE Autonomy Level: ${sae_level || 'unknown'}
Failure events:
${JSON.stringify(failure_events, null, 2)}`;
      const result = await callOpenRouter(prompt, systemPrompt, true);
      await persistAIResult({
        userId: req.user?.id,
        analysisType: 'safety-assessment',
        entityType: 'simulation_results',
        entityName: `Safety assessment of ${failure_events.length} events`,
        prompt,
        result,
      });
      res.json({ safety_assessment: result, event_count: failure_events.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
