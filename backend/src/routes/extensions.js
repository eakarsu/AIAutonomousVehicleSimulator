// Apply pass 5 — Backlog implementation for AIAutonomousVehicleSimulator
//
// Implements remaining backlog items from _AUDIT_NOTE.md:
//   1. AI vehicle behavior modeling      (TOO-RISKY)             — text-grounded over scenario+sim history
//   2. Environment randomization         (NEEDS-PRODUCT-DECISION) — bounded RNG per documented defaults
//   3. CARLA / Apollo / Baidu integration (NEEDS-CREDS)            — 503 missing CARLA_API_URL/CARLA_API_KEY
//   4. Lidar/radar simulation            (TOO-RISKY)             — in-memory point/return stub
//   5. AV platform integrations          (NEEDS-CREDS)           — 503 missing AV_PLATFORM_API_KEY
//
// Env vars consumed by NEEDS-CREDS endpoints (return 503 + missing if unset):
//   CARLA_API_URL, CARLA_API_KEY               -> /api/ai/carla/*
//   AV_PLATFORM_API_KEY, AV_PLATFORM           -> /api/ai/av-platform/*
//
// Style: matches existing aiExtended.js (express-validator, authMiddleware, callOpenRouter, persistAIResult).

const express = require('express');
const { body, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const { callOpenRouter } = require('../middleware/openrouter');

const router = express.Router();

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
      success: data.result?.success !== false,
    });
  } catch (e) {
    console.error('persistAIResult (extensions) failed:', e.message);
  }
}

function validateOrReturn(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ errors: errors.array() });
    return false;
  }
  return true;
}

// Ensure pass-5 helper tables exist (additive only).
async function ensureTables() {
  try {
    const { sequelize } = require('../models');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS env_randomization_runs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        seed INTEGER,
        params JSONB,
        result JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS lidar_radar_runs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        sensor_type VARCHAR(20),
        params JSONB,
        result JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS av_platform_handshakes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        platform VARCHAR(40),
        status VARCHAR(20),
        detail JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS carla_handshakes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        endpoint VARCHAR(60),
        status VARCHAR(20),
        detail JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
  } catch (e) {
    console.error('extensions ensureTables failed (non-fatal):', e.message);
  }
}
ensureTables();

// ───────────────────────────────────────────────────────────────────────────
// 1. AI vehicle behavior modeling (TOO-RISKY → text-grounded)
// POST /api/ai/behavior-model
// Body: { scenario_id?: int, simulation_result_ids?: int[], driver_profile?: string }
// ───────────────────────────────────────────────────────────────────────────
router.post(
  '/behavior-model',
  authMiddleware,
  [
    body('scenario_id').optional().isInt({ min: 1 }),
    body('simulation_result_ids').optional().isArray({ max: 20 }),
    body('driver_profile').optional().isString().isLength({ max: 200 }),
  ],
  async (req, res) => {
    if (!validateOrReturn(req, res)) return;
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey || apiKey === 'your_openrouter_api_key_here') {
      return res.status(503).json({ error: 'AI service unavailable', missing: 'OPENROUTER_API_KEY' });
    }
    try {
      const { DrivingScenario, SimulationResult } = require('../models');
      const { scenario_id, simulation_result_ids, driver_profile } = req.body;
      const scenario = scenario_id ? await DrivingScenario.findByPk(scenario_id).catch(() => null) : null;
      let runs = [];
      if (Array.isArray(simulation_result_ids) && simulation_result_ids.length) {
        runs = await SimulationResult.findAll({ where: { id: simulation_result_ids } }).catch(() => []);
      }
      const prompt = `Model the expected vehicle behavior (lane keeping, gap acceptance, decision latency, edge-case responses) for the following test setup. Be quantitative where possible.\n\nScenario: ${scenario ? JSON.stringify({ name: scenario.name, category: scenario.category, difficulty: scenario.difficulty, weatherCondition: scenario.weatherCondition, trafficDensity: scenario.trafficDensity }) : 'unspecified'}\nDriver/Stack profile: ${driver_profile || 'baseline-L4'}\nRecent runs (count=${runs.length}): ${runs.slice(0, 5).map(r => `id=${r.id} success=${r.successRate} collisions=${r.collisions}`).join('; ') || 'none'}`;
      const systemPrompt = 'You are an expert in autonomous vehicle behavioural modelling. Reply ONLY with JSON: { behavior_profile: object, expected_metrics: object, edge_case_responses: array, confidence: number, caveats: string[] }';
      const result = await callOpenRouter(prompt, systemPrompt, true);
      await persistAIResult({ userId: req.user?.id, analysisType: 'behavior-model', entityType: 'driving_scenario', entityId: scenario_id || null, prompt, result });
      res.json({ behavior_model: result, scenario: scenario ? { id: scenario.id, name: scenario.name } : null, run_count: runs.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ───────────────────────────────────────────────────────────────────────────
// 2. Environment randomization (NEEDS-PRODUCT-DECISION)
//
// PRODUCT-DECISION: Defaults below define a bounded, deterministic-by-seed
//   randomization domain. Editable by client per request, but each parameter
//   has a fixed [min,max] envelope to keep results comparable across runs.
//   Defaults: weather ∈ {clear, rain, snow, fog}, traffic_density ∈ [0,1],
//   pedestrians ∈ [0,30], time_of_day_hours ∈ [0,24).
// POST /api/ai/env-randomize
// ───────────────────────────────────────────────────────────────────────────
const ENV_RAND_DEFAULTS = {
  weather: ['clear', 'rain', 'snow', 'fog'],
  traffic_density_range: [0, 1],
  pedestrian_count_range: [0, 30],
  time_of_day_range: [0, 24],
};

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

router.post(
  '/env-randomize',
  authMiddleware,
  [
    body('seed').optional().isInt(),
    body('count').optional().isInt({ min: 1, max: 50 }),
    body('overrides').optional().isObject(),
  ],
  async (req, res) => {
    if (!validateOrReturn(req, res)) return;
    try {
      const { sequelize } = require('../models');
      const seed = Number.isInteger(req.body.seed) ? req.body.seed : Math.floor(Math.random() * 1e9);
      const count = req.body.count || 5;
      const merged = Object.assign({}, ENV_RAND_DEFAULTS, req.body.overrides || {});
      const rnd = mulberry32(seed);
      const samples = [];
      for (let i = 0; i < count; i++) {
        const weather = merged.weather[Math.floor(rnd() * merged.weather.length)];
        const td = merged.traffic_density_range;
        const pc = merged.pedestrian_count_range;
        const tod = merged.time_of_day_range;
        samples.push({
          weather,
          traffic_density: +(td[0] + rnd() * (td[1] - td[0])).toFixed(3),
          pedestrian_count: Math.floor(pc[0] + rnd() * (pc[1] - pc[0] + 1)),
          time_of_day_hour: +(tod[0] + rnd() * (tod[1] - tod[0])).toFixed(2),
        });
      }
      try {
        await sequelize.query(
          'INSERT INTO env_randomization_runs (user_id, seed, params, result) VALUES (:u, :s, :p, :r)',
          { replacements: { u: req.user?.id || null, s: seed, p: JSON.stringify(merged), r: JSON.stringify(samples) } }
        );
      } catch (_) { /* non-fatal */ }
      res.json({ seed, count, defaults: ENV_RAND_DEFAULTS, samples });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ───────────────────────────────────────────────────────────────────────────
// 3. CARLA / Apollo / Baidu integration (NEEDS-CREDS)
// GET  /api/ai/carla/status
// POST /api/ai/carla/dispatch  { scenario_id, simulator? }
// ───────────────────────────────────────────────────────────────────────────
function carlaCreds() {
  const missing = [];
  if (!process.env.CARLA_API_URL) missing.push('CARLA_API_URL');
  if (!process.env.CARLA_API_KEY) missing.push('CARLA_API_KEY');
  return missing;
}

router.get('/carla/status', authMiddleware, async (req, res) => {
  const missing = carlaCreds();
  if (missing.length) return res.status(503).json({ error: 'External simulator credentials missing', missing });
  res.json({ connected: false, ready: true, simulator: process.env.CARLA_SIMULATOR || 'carla', note: 'Stub: credentials present; live socket not implemented in pass 5.' });
});

router.post(
  '/carla/dispatch',
  authMiddleware,
  [
    body('scenario_id').isInt({ min: 1 }),
    body('simulator').optional().isIn(['carla', 'apollo', 'baidu']),
  ],
  async (req, res) => {
    if (!validateOrReturn(req, res)) return;
    const missing = carlaCreds();
    if (missing.length) return res.status(503).json({ error: 'External simulator credentials missing', missing });
    try {
      const { sequelize } = require('../models');
      const detail = { scenario_id: req.body.scenario_id, simulator: req.body.simulator || 'carla', dispatched_at: new Date().toISOString() };
      try {
        await sequelize.query(
          'INSERT INTO carla_handshakes (user_id, endpoint, status, detail) VALUES (:u, :e, :s, :d)',
          { replacements: { u: req.user?.id || null, e: 'dispatch', s: 'queued', d: JSON.stringify(detail) } }
        );
      } catch (_) {}
      res.json({ status: 'queued', detail, note: 'Pass-5 stub: queued only; live SDK call not invoked.' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ───────────────────────────────────────────────────────────────────────────
// 4. Lidar/radar simulation (TOO-RISKY → in-memory stub)
// POST /api/ai/lidar-simulate { range_m?, beam_count?, seed? }
// POST /api/ai/radar-simulate { range_m?, target_count?, seed? }
// ───────────────────────────────────────────────────────────────────────────
router.post(
  '/lidar-simulate',
  authMiddleware,
  [
    body('range_m').optional().isFloat({ min: 1, max: 500 }),
    body('beam_count').optional().isInt({ min: 8, max: 4096 }),
    body('seed').optional().isInt(),
  ],
  async (req, res) => {
    if (!validateOrReturn(req, res)) return;
    try {
      const { sequelize } = require('../models');
      const range = req.body.range_m || 80;
      const beams = req.body.beam_count || 64;
      const seed = Number.isInteger(req.body.seed) ? req.body.seed : Math.floor(Math.random() * 1e9);
      const rnd = mulberry32(seed);
      // Limit returned points for safety; full point cloud not retained.
      const returnLen = Math.min(beams, 256);
      const points = [];
      for (let i = 0; i < returnLen; i++) {
        const az = (i / returnLen) * 2 * Math.PI;
        const r = rnd() * range;
        points.push({ az: +az.toFixed(3), r: +r.toFixed(2), intensity: +rnd().toFixed(2) });
      }
      const summary = { beam_count: beams, range_m: range, points_returned: points.length, seed };
      try {
        await sequelize.query(
          'INSERT INTO lidar_radar_runs (user_id, sensor_type, params, result) VALUES (:u, :t, :p, :r)',
          { replacements: { u: req.user?.id || null, t: 'lidar', p: JSON.stringify({ range, beams, seed }), r: JSON.stringify(summary) } }
        );
      } catch (_) {}
      res.json({ summary, points });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.post(
  '/radar-simulate',
  authMiddleware,
  [
    body('range_m').optional().isFloat({ min: 1, max: 500 }),
    body('target_count').optional().isInt({ min: 0, max: 100 }),
    body('seed').optional().isInt(),
  ],
  async (req, res) => {
    if (!validateOrReturn(req, res)) return;
    try {
      const { sequelize } = require('../models');
      const range = req.body.range_m || 150;
      const tc = req.body.target_count != null ? req.body.target_count : 6;
      const seed = Number.isInteger(req.body.seed) ? req.body.seed : Math.floor(Math.random() * 1e9);
      const rnd = mulberry32(seed);
      const targets = [];
      for (let i = 0; i < tc; i++) {
        targets.push({
          range_m: +(rnd() * range).toFixed(2),
          velocity_mps: +(((rnd() - 0.5) * 50)).toFixed(2),
          rcs_dbsm: +(((rnd() - 0.5) * 30)).toFixed(2),
          azimuth_deg: +(((rnd() - 0.5) * 90)).toFixed(2),
        });
      }
      const summary = { target_count: targets.length, range_m: range, seed };
      try {
        await sequelize.query(
          'INSERT INTO lidar_radar_runs (user_id, sensor_type, params, result) VALUES (:u, :t, :p, :r)',
          { replacements: { u: req.user?.id || null, t: 'radar', p: JSON.stringify({ range, tc, seed }), r: JSON.stringify(summary) } }
        );
      } catch (_) {}
      res.json({ summary, targets });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ───────────────────────────────────────────────────────────────────────────
// 5. AV platform integrations — Waymo, Cruise, Tesla (NEEDS-CREDS)
// GET  /api/ai/av-platform/status?platform=waymo|cruise|tesla
// POST /api/ai/av-platform/handshake { platform }
// ───────────────────────────────────────────────────────────────────────────
function avPlatformCreds() {
  const missing = [];
  if (!process.env.AV_PLATFORM_API_KEY) missing.push('AV_PLATFORM_API_KEY');
  return missing;
}

router.get('/av-platform/status', authMiddleware, async (req, res) => {
  const missing = avPlatformCreds();
  if (missing.length) return res.status(503).json({ error: 'AV platform credentials missing', missing });
  const platform = (req.query.platform || process.env.AV_PLATFORM || 'waymo').toString().toLowerCase();
  res.json({ platform, supported: ['waymo', 'cruise', 'tesla'].includes(platform), connected: false, note: 'Pass-5 stub.' });
});

router.post(
  '/av-platform/handshake',
  authMiddleware,
  [body('platform').optional().isIn(['waymo', 'cruise', 'tesla'])],
  async (req, res) => {
    if (!validateOrReturn(req, res)) return;
    const missing = avPlatformCreds();
    if (missing.length) return res.status(503).json({ error: 'AV platform credentials missing', missing });
    try {
      const { sequelize } = require('../models');
      const platform = (req.body.platform || process.env.AV_PLATFORM || 'waymo').toLowerCase();
      const detail = { platform, attempted_at: new Date().toISOString() };
      try {
        await sequelize.query(
          'INSERT INTO av_platform_handshakes (user_id, platform, status, detail) VALUES (:u, :p, :s, :d)',
          { replacements: { u: req.user?.id || null, p: platform, s: 'recorded', d: JSON.stringify(detail) } }
        );
      } catch (_) {}
      res.json({ platform, status: 'recorded', detail, note: 'Pass-5 stub: handshake recorded; vendor SDK call not implemented.' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
