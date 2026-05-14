const express = require('express');
const { query, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const { AIResult } = require('../models');

const router = express.Router();

// GET /api/ai-results — paginated list of persisted AI analyses
router.get(
  '/',
  authMiddleware,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be 1-100'),
    query('analysisType').optional().trim(),
    query('entityType').optional().trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    try {
      const page = parseInt(req.query.page || '1', 10);
      const limit = parseInt(req.query.limit || '20', 10);
      const offset = (page - 1) * limit;
      const where = {};
      if (req.query.analysisType) where.analysisType = req.query.analysisType;
      if (req.query.entityType) where.entityType = req.query.entityType;

      const { count, rows } = await AIResult.findAndCountAll({
        where,
        order: [['createdAt', 'DESC']],
        limit,
        offset,
        attributes: { exclude: ['prompt'] } // omit large prompt text from list view
      });

      res.json({
        data: rows,
        pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) }
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// GET /api/ai-results/:id — single AI result with full prompt
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await AIResult.findByPk(req.params.id);
    if (!result) return res.status(404).json({ error: 'AI result not found' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
