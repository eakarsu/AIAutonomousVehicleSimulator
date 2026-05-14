const express = require('express');
const PDFDocument = require('pdfkit');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

function getDb() {
  return require('../config/database');
}

// GET /api/simulations/:id/report/pdf
router.get('/:id/report/pdf', authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    const db = getDb();

    // Ensure table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS simulation_runs (
        id SERIAL PRIMARY KEY, user_id INTEGER, vehicle_id INTEGER,
        scenario_id INTEGER, started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
        duration_seconds INTEGER, results JSONB, ai_analysis JSONB,
        status VARCHAR(50) DEFAULT 'pending',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const [rows] = await db.query('SELECT * FROM simulation_runs WHERE id = $1', {
      bind: [id],
      type: db.QueryTypes.SELECT,
    });

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Simulation run not found' });
    }

    const run = rows[0];
    const { VehicleModel, DrivingScenario } = require('../models');

    const [vehicle, scenario] = await Promise.all([
      run.vehicle_id ? VehicleModel.findByPk(run.vehicle_id) : null,
      run.scenario_id ? DrivingScenario.findByPk(run.scenario_id) : null,
    ]);

    // Build PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=simulation-run-${id}-report.pdf`);
    doc.pipe(res);

    const PAGE_WIDTH = doc.page.width - 100; // accounting for margins
    const ACCENT = '#1a56db';
    const DARK = '#111827';
    const MUTED = '#6b7280';

    // ── Cover ────────────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 140).fill(ACCENT);
    doc.fillColor('white').font('Helvetica-Bold').fontSize(28)
      .text('Autonomous Vehicle', 50, 40)
      .text('Simulation Test Report', 50, 72);
    doc.font('Helvetica').fontSize(11)
      .text(`Report ID: SIM-${String(id).padStart(6, '0')}`, 50, 110)
      .text(`Generated: ${new Date().toLocaleString()}`, 300, 110);

    doc.moveDown(3);

    // ── Executive Summary ────────────────────────────────────────────────────
    doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(16)
      .text('1. Executive Summary', 50, 170);
    doc.moveTo(50, 190).lineTo(545, 190).strokeColor(ACCENT).lineWidth(1).stroke();

    doc.fillColor(DARK).font('Helvetica').fontSize(11).moveDown(0.5);

    const statusColor = run.status === 'completed' ? '#059669' : run.status === 'failed' ? '#dc2626' : '#d97706';
    const statusIcon = run.status === 'completed' ? 'PASS' : run.status === 'failed' ? 'FAIL' : 'PENDING';

    doc.text(`Status: `, { continued: true }).fillColor(statusColor).font('Helvetica-Bold')
      .text(statusIcon, { continued: false });
    doc.fillColor(DARK).font('Helvetica');
    doc.text(`Run ID: ${id}`);
    doc.text(`Duration: ${run.duration_seconds ? `${run.duration_seconds}s` : 'N/A'}`);
    doc.text(`Started: ${run.started_at ? new Date(run.started_at).toLocaleString() : 'N/A'}`);
    doc.text(`Completed: ${run.completed_at ? new Date(run.completed_at).toLocaleString() : 'N/A'}`);

    // ── Vehicle & Scenario ───────────────────────────────────────────────────
    doc.moveDown(1);
    doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(16).text('2. Test Configuration');
    doc.moveTo(50, doc.y + 4).lineTo(545, doc.y + 4).strokeColor(ACCENT).lineWidth(1).stroke();
    doc.moveDown(0.5);

    doc.fillColor(DARK).font('Helvetica-Bold').fontSize(12).text('Vehicle Details');
    doc.font('Helvetica').fontSize(11).fillColor(DARK);
    if (vehicle) {
      doc.text(`Name: ${vehicle.name}`);
      doc.text(`Manufacturer: ${vehicle.manufacturer}`);
      doc.text(`Type: ${vehicle.type}`);
      doc.text(`Autonomy Level: SAE L${vehicle.autonomyLevel}`);
      doc.text(`Max Speed: ${vehicle.maxSpeed || 'N/A'} km/h`);
      doc.text(`Sensor Count: ${vehicle.sensorCount || 'N/A'}`);
    } else {
      doc.text(`Vehicle ID: ${run.vehicle_id || 'N/A'}`);
    }

    doc.moveDown(0.5);
    doc.fillColor(DARK).font('Helvetica-Bold').fontSize(12).text('Test Scenario');
    doc.font('Helvetica').fontSize(11).fillColor(DARK);
    if (scenario) {
      doc.text(`Name: ${scenario.name}`);
      doc.text(`Category: ${scenario.category}`);
      doc.text(`Difficulty: ${scenario.difficulty || 'N/A'}`);
      doc.text(`Weather: ${scenario.weatherCondition || 'N/A'}`);
      doc.text(`Traffic Density: ${scenario.trafficDensity || 'N/A'}`);
      doc.text(`Road Type: ${scenario.roadType || 'N/A'}`);
    } else {
      doc.text(`Scenario ID: ${run.scenario_id || 'N/A'}`);
    }

    // ── Safety Metrics ───────────────────────────────────────────────────────
    doc.moveDown(1);
    doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(16).text('3. Safety Metrics');
    doc.moveTo(50, doc.y + 4).lineTo(545, doc.y + 4).strokeColor(ACCENT).lineWidth(1).stroke();
    doc.moveDown(0.5);

    const results = typeof run.results === 'object' ? run.results : {};
    doc.font('Helvetica').fontSize(11).fillColor(DARK);

    const metricPairs = [
      ['Success Rate', results.successRate != null ? `${results.successRate}%` : 'N/A'],
      ['Collisions', results.collisions != null ? results.collisions : 'N/A'],
      ['Near Misses', results.nearMisses != null ? results.nearMisses : 'N/A'],
      ['Average Speed', results.avgSpeed != null ? `${results.avgSpeed} km/h` : 'N/A'],
      ['Total Distance', results.totalDistance != null ? `${results.totalDistance} km` : 'N/A'],
      ['Grade', results.grade || 'N/A'],
    ];

    metricPairs.forEach(([label, value]) => {
      doc.fillColor(MUTED).text(`${label}: `, { continued: true }).fillColor(DARK).font('Helvetica-Bold').text(String(value));
      doc.font('Helvetica');
    });

    // ── AI Analysis ──────────────────────────────────────────────────────────
    doc.moveDown(1);
    doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(16).text('4. AI Analysis');
    doc.moveTo(50, doc.y + 4).lineTo(545, doc.y + 4).strokeColor(ACCENT).lineWidth(1).stroke();
    doc.moveDown(0.5);

    const aiAnalysis = typeof run.ai_analysis === 'object' ? run.ai_analysis : {};
    const aiText = aiAnalysis.report || aiAnalysis.content || JSON.stringify(aiAnalysis, null, 2);

    doc.font('Helvetica').fontSize(10).fillColor(DARK).text(
      aiText && aiText !== '{}' ? aiText : 'No AI analysis available for this run.',
      { width: PAGE_WIDTH, lineGap: 2 }
    );

    // ── Pass/Fail Conclusion ─────────────────────────────────────────────────
    doc.moveDown(1);
    if (doc.y > 680) doc.addPage();

    doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(16).text('5. Conclusion');
    doc.moveTo(50, doc.y + 4).lineTo(545, doc.y + 4).strokeColor(ACCENT).lineWidth(1).stroke();
    doc.moveDown(0.5);

    const conclusionColor = run.status === 'completed' ? '#059669' : run.status === 'failed' ? '#dc2626' : '#d97706';
    doc.rect(50, doc.y, PAGE_WIDTH, 60).fill(conclusionColor);
    doc.fillColor('white').font('Helvetica-Bold').fontSize(20)
      .text(statusIcon, 50, doc.y - 55, { width: PAGE_WIDTH, align: 'center' });
    doc.font('Helvetica').fontSize(11)
      .text(
        run.status === 'completed'
          ? 'The simulation run completed successfully and meets the test criteria.'
          : run.status === 'failed'
          ? 'The simulation run failed to meet required test criteria. Review findings above.'
          : 'The simulation run status is pending. Further analysis required.',
        50, doc.y - 30, { width: PAGE_WIDTH, align: 'center' }
      );

    doc.moveDown(4);
    doc.fillColor(MUTED).font('Helvetica').fontSize(9)
      .text(`This report was auto-generated by the AI Autonomous Vehicle Simulator. Report ID: SIM-${String(id).padStart(6, '0')}`, {
        align: 'center',
        width: PAGE_WIDTH,
      });

    doc.end();
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

module.exports = router;
