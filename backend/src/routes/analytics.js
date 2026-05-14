const express = require('express');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

function getDb() {
  return require('../config/database');
}

// GET /api/analytics/safety-metrics - Safety metrics dashboard
router.get('/safety-metrics', authMiddleware, async (req, res) => {
  try {
    const db = getDb();

    // Ensure simulation_runs table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS simulation_runs (
        id                SERIAL PRIMARY KEY,
        user_id           INTEGER,
        vehicle_id        INTEGER,
        scenario_id       INTEGER,
        started_at        TIMESTAMPTZ,
        completed_at      TIMESTAMPTZ,
        duration_seconds  INTEGER,
        results           JSONB,
        ai_analysis       JSONB,
        status            VARCHAR(50) DEFAULT 'pending',
        "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Total simulations and pass/fail rate
    const [runStats] = await db.query(
      `SELECT
         COUNT(*) AS total_simulations,
         COUNT(*) FILTER (WHERE status = 'completed') AS completed,
         COUNT(*) FILTER (WHERE status = 'failed') AS failed,
         ROUND(
           (COUNT(*) FILTER (WHERE status = 'completed')::FLOAT /
            NULLIF(COUNT(*), 0) * 100)::NUMERIC, 2
         ) AS pass_rate_pct
       FROM simulation_runs`,
      { type: db.QueryTypes.SELECT }
    );

    // Average safety score by scenario type (from safety_metrics table)
    const [safetyByScenario] = await db.query(
      `SELECT category, ROUND(AVG(score)::NUMERIC, 2) AS avg_score, COUNT(*) AS metric_count
       FROM safety_metrics
       GROUP BY category
       ORDER BY avg_score ASC`,
      { type: db.QueryTypes.SELECT }
    ).catch(() => [[]]);

    // Most failed test scenarios (from simulation_results)
    const [mostFailed] = await db.query(
      `SELECT "scenarioName", COUNT(*) AS total_runs,
              SUM(collisions) AS total_collisions,
              AVG("successRate") AS avg_success_rate
       FROM simulation_results
       GROUP BY "scenarioName"
       ORDER BY total_collisions DESC
       LIMIT 10`,
      { type: db.QueryTypes.SELECT }
    ).catch(() => [[]]);

    // Collision frequency by speed range
    const [collisionsBySpeed] = await db.query(
      `SELECT
         CASE
           WHEN speed < 30 THEN '0-30 km/h'
           WHEN speed < 60 THEN '30-60 km/h'
           WHEN speed < 100 THEN '60-100 km/h'
           WHEN speed < 150 THEN '100-150 km/h'
           ELSE '150+ km/h'
         END AS speed_range,
         COUNT(*) AS collision_count,
         ROUND(AVG(speed)::NUMERIC, 2) AS avg_speed
       FROM collision_analyses
       GROUP BY speed_range
       ORDER BY MIN(speed)`,
      { type: db.QueryTypes.SELECT }
    ).catch(() => [[]]);

    res.json({
      run_summary: runStats || {},
      safety_by_scenario: safetyByScenario || [],
      most_failed_scenarios: mostFailed || [],
      collision_frequency_by_speed: collisionsBySpeed || [],
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
