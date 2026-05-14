const express = require('express');
const { body, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const { Favorite } = require('../models');
const router = express.Router();

// Get user's favorites with pagination
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { entityType, page = 1, limit = 20 } = req.query;
    const where = { userId: req.user.id };
    if (entityType) where.entityType = entityType;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await Favorite.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });
    res.json({
      data: rows,
      pagination: { total: count, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(count / parseInt(limit)) }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle favorite
router.post(
  '/toggle',
  authMiddleware,
  [
    body('entityType').trim().notEmpty().withMessage('entityType is required'),
    body('entityId').isInt({ min: 1 }).withMessage('entityId must be a positive integer'),
    body('entityName').optional().trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    try {
      const { entityType, entityId, entityName } = req.body;
      const existing = await Favorite.findOne({
        where: { userId: req.user.id, entityType, entityId }
      });
      if (existing) {
        await existing.destroy();
        res.json({ favorited: false, message: 'Removed from favorites' });
      } else {
        const fav = await Favorite.create({
          userId: req.user.id,
          entityType,
          entityId,
          entityName
        });
        res.json({ favorited: true, favorite: fav, message: 'Added to favorites' });
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Delete favorite
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const fav = await Favorite.findOne({
      where: { id: req.params.id, userId: req.user.id }
    });
    if (!fav) return res.status(404).json({ error: 'Favorite not found' });
    await fav.destroy();
    res.json({ message: 'Favorite removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
