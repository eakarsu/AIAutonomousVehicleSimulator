const express = require('express');
const authMiddleware = require('../middleware/auth');
const { AuditLog } = require('../models');
const router = express.Router();

// Get audit logs with pagination
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 25, action, entityType } = req.query;
    const where = {};
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await AuditLog.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.json({
      data: rows,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / parseInt(limit))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create audit log entry
router.post('/', authMiddleware, async (req, res) => {
  try {
    const log = await AuditLog.create({
      ...req.body,
      userId: req.user.id,
      userName: req.user.name
    });
    res.status(201).json(log);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
