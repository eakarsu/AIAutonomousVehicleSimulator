const express = require('express');
const authMiddleware = require('../middleware/auth');
const { Favorite } = require('../models');
const router = express.Router();

// Get user's favorites
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { entityType } = req.query;
    const where = { userId: req.user.id };
    if (entityType) where.entityType = entityType;
    const favorites = await Favorite.findAll({ where, order: [['createdAt', 'DESC']] });
    res.json(favorites);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle favorite
router.post('/toggle', authMiddleware, async (req, res) => {
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
});

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
