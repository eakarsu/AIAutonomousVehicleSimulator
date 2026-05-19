/**
 * Custom Views for AV Simulation Testing — 4 endpoints
 *
 *  VIZ
 *    1) GET  /scenario-coverage          Coverage matrix (road x weather/traffic)
 *    2) GET  /sensor-fusion-accuracy     Sensor x condition accuracy heatmap
 *  NON-VIZ
 *    3) GET  /scenario-spec/pdf/:id?     Scenario specification PDF
 *    4) /scenario-editor                  CRUD scenario editor (parameters: weather, traffic, road)
 */

const express = require('express');
const PDFDocument = require('pdfkit');
const authMiddleware = require('../middleware/auth');
const { DrivingScenario } = require('../models');

const router = express.Router();

function getDb() {
  return require('../config/database');
}

async function safeSelect(db, sql, fallback = []) {
  try {
    const rows = await db.query(sql, { type: db.QueryTypes.SELECT });
    return Array.isArray(rows) ? rows : fallback;
  } catch (_err) {
    return fallback;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 1) Scenario Coverage Matrix (VIZ)
//    A 2-D matrix counting scenarios grouped by road_type x weather and
//    road_type x traffic_density, giving testers a view of which regions
//    of the operational design domain are well-covered vs. sparse.
// ───────────────────────────────────────────────────────────────────────────
router.get('/scenario-coverage', authMiddleware, async (req, res) => {
  try {
    const db = getDb();

    const rows = await safeSelect(
      db,
      `SELECT
         COALESCE("roadType", 'unknown')         AS road,
         COALESCE("weatherCondition", 'unknown') AS weather,
         COALESCE("trafficDensity", 'unknown')   AS traffic,
         COUNT(*)::INTEGER                       AS n
       FROM driving_scenarios
       GROUP BY 1, 2, 3
       ORDER BY 1, 2, 3`
    );

    // Stable axis sets so the heatmap always has anchor cells even when empty
    const ROADS    = ['urban', 'highway', 'suburban', 'rural', 'parking', 'intersection'];
    const WEATHER  = ['clear', 'rain', 'snow', 'fog', 'storm'];
    const TRAFFIC  = ['low', 'medium', 'high', 'extreme'];

    const rwMap = {}; // road -> weather -> count
    const rtMap = {}; // road -> traffic -> count

    ROADS.forEach((r) => {
      rwMap[r] = {}; WEATHER.forEach((w) => (rwMap[r][w] = 0));
      rtMap[r] = {}; TRAFFIC.forEach((t) => (rtMap[r][t] = 0));
    });

    rows.forEach((row) => {
      const r = ROADS.includes(row.road) ? row.road : 'unknown';
      const w = WEATHER.includes(row.weather) ? row.weather : 'unknown';
      const t = TRAFFIC.includes(row.traffic) ? row.traffic : 'unknown';
      if (!rwMap[r]) { rwMap[r] = {}; WEATHER.forEach((x) => (rwMap[r][x] = 0)); rwMap[r].unknown = 0; }
      if (!rtMap[r]) { rtMap[r] = {}; TRAFFIC.forEach((x) => (rtMap[r][x] = 0)); rtMap[r].unknown = 0; }
      rwMap[r][w] = (rwMap[r][w] || 0) + Number(row.n || 0);
      rtMap[r][t] = (rtMap[r][t] || 0) + Number(row.n || 0);
    });

    const total = rows.reduce((s, r) => s + Number(r.n || 0), 0);
    const distinctCells = rows.length;
    const maxCellCount = rows.reduce((m, r) => Math.max(m, Number(r.n || 0)), 0);

    res.json({
      axes: { roads: ROADS, weather: WEATHER, traffic: TRAFFIC },
      matrix_road_weather: rwMap,
      matrix_road_traffic: rtMap,
      summary: {
        total_scenarios: total,
        distinct_cells_with_data: distinctCells,
        max_cell_count: maxCellCount,
        coverage_pct: Math.round(
          (distinctCells / (ROADS.length * (WEATHER.length + TRAFFIC.length))) * 1000
        ) / 10,
      },
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// 2) Sensor-Fusion Accuracy Heatmap (VIZ)
//    Synthesises an accuracy heatmap with axes = sensor type x environmental
//    condition, computed by combining sensor_configs.accuracy with a
//    deterministic condition-modifier table. This is a synthetic but
//    repeatable view useful for fusion stack regression triage.
// ───────────────────────────────────────────────────────────────────────────
router.get('/sensor-fusion-accuracy', authMiddleware, async (req, res) => {
  try {
    const db = getDb();

    const sensors = await safeSelect(
      db,
      `SELECT type,
              ROUND(AVG(accuracy)::NUMERIC, 2) AS base_accuracy,
              COUNT(*)::INTEGER                AS n
       FROM sensor_configs
       WHERE accuracy IS NOT NULL
       GROUP BY type
       ORDER BY type`
    );

    const CONDITIONS = ['clear', 'rain', 'fog', 'snow', 'night', 'glare'];
    // Per-sensor multipliers vs. each condition (deterministic, domain-realistic)
    const MULTI = {
      camera:     { clear: 1.00, rain: 0.78, fog: 0.55, snow: 0.65, night: 0.62, glare: 0.50 },
      lidar:      { clear: 0.97, rain: 0.85, fog: 0.60, snow: 0.62, night: 0.94, glare: 0.96 },
      radar:      { clear: 0.92, rain: 0.93, fog: 0.95, snow: 0.90, night: 0.92, glare: 0.91 },
      ultrasonic: { clear: 0.88, rain: 0.85, fog: 0.86, snow: 0.84, night: 0.88, glare: 0.88 },
      gps:        { clear: 0.95, rain: 0.92, fog: 0.94, snow: 0.91, night: 0.95, glare: 0.95 },
      imu:        { clear: 0.99, rain: 0.99, fog: 0.99, snow: 0.99, night: 0.99, glare: 0.99 },
    };

    const sensorTypes = sensors.length
      ? sensors.map((s) => String(s.type).toLowerCase())
      : Object.keys(MULTI);

    const baseMap = {};
    sensors.forEach((s) => {
      baseMap[String(s.type).toLowerCase()] = Math.max(60, Math.min(99, Number(s.base_accuracy) || 85));
    });

    const cells = []; // {sensor, condition, accuracy}
    const matrix = {};

    sensorTypes.forEach((s) => {
      const baseline = baseMap[s] || 85;
      const row = {};
      CONDITIONS.forEach((c) => {
        const mult = (MULTI[s] && MULTI[s][c]) || 0.85;
        const acc = Math.round(baseline * mult * 10) / 10;
        row[c] = acc;
        cells.push({ sensor: s, condition: c, accuracy: acc });
      });
      matrix[s] = row;
    });

    // Fusion benefit: assume fusion across all sensors of a condition gets the
    // best individual sensor + small synergy bump (capped at 99).
    const fusion_by_condition = {};
    CONDITIONS.forEach((c) => {
      const best = Math.max(...sensorTypes.map((s) => matrix[s][c] || 0));
      fusion_by_condition[c] = Math.min(99, Math.round((best + 4) * 10) / 10);
    });

    res.json({
      axes: { sensors: sensorTypes, conditions: CONDITIONS },
      matrix,
      cells,
      fusion_by_condition,
      summary: {
        sensor_types_used: sensorTypes.length,
        avg_accuracy: Math.round(
          (cells.reduce((s, c) => s + c.accuracy, 0) / Math.max(1, cells.length)) * 10
        ) / 10,
        worst_cell: cells.sort((a, b) => a.accuracy - b.accuracy)[0] || null,
        best_cell: cells.sort((a, b) => b.accuracy - a.accuracy)[0] || null,
      },
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// 3) Scenario Specification PDF (NON-VIZ)
//    Generates a PDF describing one (or all recent) driving scenario(s),
//    including weather, traffic, road, duration and parameter JSON.
// ───────────────────────────────────────────────────────────────────────────
router.get('/scenario-spec/pdf/:id?', authMiddleware, async (req, res) => {
  try {
    const db = getDb();
    let scenarios;

    if (req.params.id) {
      scenarios = await safeSelect(
        db,
        `SELECT id, name, category, difficulty, "weatherCondition", "trafficDensity",
                "roadType", duration, status, description, parameters, "createdAt"
         FROM driving_scenarios
         WHERE id = ${parseInt(req.params.id, 10) || 0}
         LIMIT 1`
      );
    } else {
      scenarios = await safeSelect(
        db,
        `SELECT id, name, category, difficulty, "weatherCondition", "trafficDensity",
                "roadType", duration, status, description, parameters, "createdAt"
         FROM driving_scenarios
         ORDER BY "createdAt" DESC
         LIMIT 10`
      );
    }

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="scenario-spec${req.params.id ? '-' + req.params.id : 's'}.pdf"`
    );
    doc.pipe(res);

    doc.fontSize(20).fillColor('#1e293b').text('AV Simulator — Scenario Specification', { align: 'left' });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#64748b').text(`Generated: ${new Date().toISOString()}`);
    doc.moveDown(1);

    if (!scenarios.length) {
      doc.fontSize(12).fillColor('#94a3b8').text('No scenario records available to render.');
    } else {
      scenarios.forEach((s, idx) => {
        if (idx > 0) doc.addPage();
        doc.fontSize(14).fillColor('#0f172a').text(`Scenario #${s.id}: ${s.name || 'Unnamed'}`, { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(11).fillColor('#1e293b');
        doc.text(`Category:     ${s.category || 'n/a'}`);
        doc.text(`Difficulty:   ${s.difficulty || 'n/a'}`);
        doc.text(`Road Type:    ${s.roadType || 'n/a'}`);
        doc.text(`Weather:      ${s.weatherCondition || 'n/a'}`);
        doc.text(`Traffic:      ${s.trafficDensity || 'n/a'}`);
        doc.text(`Duration:     ${s.duration ?? 'n/a'} s`);
        doc.text(`Status:       ${s.status || 'n/a'}`);
        doc.text(`Created:      ${s.createdAt ? new Date(s.createdAt).toISOString() : 'n/a'}`);
        doc.moveDown(0.6);

        doc.fontSize(12).fillColor('#0f172a').text('Description', { underline: true });
        doc.fontSize(10).fillColor('#334155').text(s.description || '(no description)');
        doc.moveDown(0.5);

        doc.fontSize(12).fillColor('#0f172a').text('Parameters', { underline: true });
        doc.fontSize(9).fillColor('#1e293b').text(JSON.stringify(s.parameters || {}, null, 2));
      });
    }

    doc.moveDown(1);
    doc.fontSize(9).fillColor('#94a3b8').text(
      'AI Autonomous Vehicle Simulator — Scenario Specification report (Custom Views).',
      { align: 'center' }
    );

    doc.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// 4) Scenario Editor CRUD (NON-VIZ)
//    Lightweight, validated CRUD limited to scenario-editor concerns
//    (parameters: weather, traffic, road). Writes to driving_scenarios.
// ───────────────────────────────────────────────────────────────────────────

const ALLOWED_ROAD     = ['urban', 'highway', 'suburban', 'rural', 'parking', 'intersection'];
const ALLOWED_WEATHER  = ['clear', 'rain', 'snow', 'fog', 'storm'];
const ALLOWED_TRAFFIC  = ['low', 'medium', 'high', 'extreme'];

function validateEditorPayload(body) {
  const issues = [];
  if (!body.name || typeof body.name !== 'string') issues.push('name is required');
  if (body.weatherCondition && !ALLOWED_WEATHER.includes(body.weatherCondition)) {
    issues.push(`weatherCondition must be one of ${ALLOWED_WEATHER.join('|')}`);
  }
  if (body.trafficDensity && !ALLOWED_TRAFFIC.includes(body.trafficDensity)) {
    issues.push(`trafficDensity must be one of ${ALLOWED_TRAFFIC.join('|')}`);
  }
  if (body.roadType && !ALLOWED_ROAD.includes(body.roadType)) {
    issues.push(`roadType must be one of ${ALLOWED_ROAD.join('|')}`);
  }
  if (body.duration != null) {
    const d = Number(body.duration);
    if (!Number.isFinite(d) || d < 1 || d > 7200) issues.push('duration must be 1-7200 seconds');
  }
  return issues;
}

// LIST
router.get('/scenario-editor', authMiddleware, async (req, res) => {
  try {
    const rows = await DrivingScenario.findAll({
      order: [['createdAt', 'DESC']],
      limit: 50,
    });
    res.json({
      items: rows,
      count: rows.length,
      enums: { road: ALLOWED_ROAD, weather: ALLOWED_WEATHER, traffic: ALLOWED_TRAFFIC },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE
router.post('/scenario-editor', authMiddleware, async (req, res) => {
  try {
    const issues = validateEditorPayload(req.body || {});
    if (issues.length) return res.status(422).json({ issues });

    const created = await DrivingScenario.create({
      name: req.body.name,
      category: req.body.category || 'general',
      difficulty: req.body.difficulty || 'medium',
      weatherCondition: req.body.weatherCondition || 'clear',
      trafficDensity: req.body.trafficDensity || 'medium',
      roadType: req.body.roadType || 'urban',
      duration: Number(req.body.duration) || 120,
      status: 'active',
      description: req.body.description || '',
      parameters: req.body.parameters || {},
    });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// READ ONE
router.get('/scenario-editor/:id', authMiddleware, async (req, res) => {
  try {
    const row = await DrivingScenario.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: 'not found' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE
router.put('/scenario-editor/:id', authMiddleware, async (req, res) => {
  try {
    const issues = validateEditorPayload(req.body || {});
    if (issues.length) return res.status(422).json({ issues });
    const row = await DrivingScenario.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: 'not found' });
    await row.update({
      name: req.body.name ?? row.name,
      category: req.body.category ?? row.category,
      difficulty: req.body.difficulty ?? row.difficulty,
      weatherCondition: req.body.weatherCondition ?? row.weatherCondition,
      trafficDensity: req.body.trafficDensity ?? row.trafficDensity,
      roadType: req.body.roadType ?? row.roadType,
      duration: req.body.duration != null ? Number(req.body.duration) : row.duration,
      description: req.body.description ?? row.description,
      parameters: req.body.parameters ?? row.parameters,
    });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE
router.delete('/scenario-editor/:id', authMiddleware, async (req, res) => {
  try {
    const row = await DrivingScenario.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: 'not found' });
    await row.destroy();
    res.json({ deleted: true, id: Number(req.params.id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
