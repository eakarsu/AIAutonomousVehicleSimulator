const express = require('express');
const { body, query, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

function getDb() {
  return require('../config/database');
}

async function ensureTable() {
  const db = getDb();
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
}

// POST /api/simulation-runs - Create a simulation run
router.post(
  '/',
  authMiddleware,
  [
    body('vehicle_id').isInt().withMessage('vehicle_id must be an integer'),
    body('scenario_id').isInt().withMessage('scenario_id must be an integer'),
    body('vehicle_speed')
      .optional()
      .isFloat({ min: 0, max: 300 })
      .withMessage('vehicle_speed must be 0-300 km/h'),
    body('sensor_range')
      .optional()
      .isFloat({ min: 1, max: 500 })
      .withMessage('sensor_range must be 1-500 meters'),
    body('simulation_duration')
      .optional()
      .isInt({ min: 1, max: 3600 })
      .withMessage('simulation_duration must be 1-3600 seconds'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    try {
      await ensureTable();
      const db = getDb();
      const userId = req.user?.id || null;
      const { vehicle_id, scenario_id, results, ai_analysis, status } = req.body;

      const [rows] = await db.query(
        `INSERT INTO simulation_runs (user_id, vehicle_id, scenario_id, started_at, results, ai_analysis, status, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, NOW(), $4, $5, $6, NOW(), NOW())
         RETURNING *`,
        {
          bind: [userId, vehicle_id, scenario_id, JSON.stringify(results || {}), JSON.stringify(ai_analysis || {}), status || 'running'],
          type: db.QueryTypes.INSERT,
        }
      );
      res.status(201).json(rows[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// PATCH /api/simulation-runs/:id/complete - Mark run as complete
router.patch(
  '/:id/complete',
  authMiddleware,
  [
    body('duration_seconds').optional().isInt({ min: 1, max: 3600 }).withMessage('duration_seconds must be 1-3600'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    try {
      await ensureTable();
      const db = getDb();
      const { duration_seconds, results, ai_analysis } = req.body;

      const [rows] = await db.query(
        `UPDATE simulation_runs
         SET completed_at = NOW(), duration_seconds = $1, results = $2, ai_analysis = $3, status = 'completed', "updatedAt" = NOW()
         WHERE id = $4
         RETURNING *`,
        {
          bind: [duration_seconds || null, JSON.stringify(results || {}), JSON.stringify(ai_analysis || {}), req.params.id],
          type: db.QueryTypes.UPDATE,
        }
      );
      if (!rows || rows.length === 0) return res.status(404).json({ error: 'Simulation run not found' });
      res.json(rows[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// GET /api/simulation-runs - List all runs with pagination
router.get(
  '/',
  authMiddleware,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be 1-100'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    try {
      await ensureTable();
      const db = getDb();
      const page = parseInt(req.query.page || '1', 10);
      const limit = parseInt(req.query.limit || '20', 10);
      const offset = (page - 1) * limit;

      const [countRows] = await db.query(
        'SELECT COUNT(*) AS total FROM simulation_runs',
        { type: db.QueryTypes.SELECT }
      );
      const total = parseInt(countRows.total || countRows[0]?.total || '0', 10);

      const [rows] = await db.query(
        `SELECT * FROM simulation_runs ORDER BY "createdAt" DESC LIMIT $1 OFFSET $2`,
        { bind: [limit, offset], type: db.QueryTypes.SELECT }
      );

      res.json({
        data: rows || [],
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// GET /api/simulation-runs/:id - Get single run
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    await ensureTable();
    const db = getDb();
    const [rows] = await db.query('SELECT * FROM simulation_runs WHERE id = $1', {
      bind: [req.params.id],
      type: db.QueryTypes.SELECT,
    });
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Simulation run not found' });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
