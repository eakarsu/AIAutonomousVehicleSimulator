const express = require('express');
const { body, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const { TrainingSession } = require('../models');

const router = express.Router();

/**
 * POST /api/training-sessions/:id/simulate-progress
 * Simulates epoch-by-epoch training progress for a session.
 * Updates accuracy, loss, and status in the DB.
 */
router.post(
  '/:id/simulate-progress',
  authMiddleware,
  [
    body('epochs').optional().isInt({ min: 1, max: 200 }).withMessage('epochs must be 1-200'),
    body('learning_rate').optional().isFloat({ min: 0.0001, max: 1 }).withMessage('learning_rate must be 0.0001-1'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    try {
      const session = await TrainingSession.findByPk(req.params.id);
      if (!session) return res.status(404).json({ error: 'Training session not found' });

      const targetEpochs = parseInt(req.body.epochs || session.epochs || 50, 10);
      const lr = parseFloat(req.body.learning_rate || session.learningRate || 0.001);

      // Simulate epoch progression
      const progress = [];
      let currentAccuracy = Math.random() * 30 + 40; // start between 40-70%
      let currentLoss = 1.5 + Math.random() * 0.5; // start loss 1.5-2.0

      for (let epoch = 1; epoch <= targetEpochs; epoch++) {
        // Simulate learning curve: diminishing returns
        const improvement = (lr * 100) * Math.exp(-epoch / (targetEpochs * 0.3)) * (0.8 + Math.random() * 0.4);
        const lossReduction = (lr * 2) * Math.exp(-epoch / (targetEpochs * 0.4)) * (0.8 + Math.random() * 0.4);

        currentAccuracy = Math.min(99.5, currentAccuracy + improvement);
        currentLoss = Math.max(0.001, currentLoss - lossReduction);

        progress.push({
          epoch,
          accuracy: parseFloat(currentAccuracy.toFixed(4)),
          loss: parseFloat(currentLoss.toFixed(4)),
          val_accuracy: parseFloat((currentAccuracy * (0.9 + Math.random() * 0.1)).toFixed(4)),
          val_loss: parseFloat((currentLoss * (1.0 + Math.random() * 0.2)).toFixed(4)),
        });
      }

      const finalEpoch = progress[progress.length - 1];

      // Update the session in DB
      await session.update({
        epochs: targetEpochs,
        learningRate: lr,
        accuracy: finalEpoch.accuracy,
        loss: finalEpoch.loss,
        status: 'completed',
        startedAt: session.startedAt || new Date(),
        completedAt: new Date(),
        metrics: {
          progress,
          final_accuracy: finalEpoch.accuracy,
          final_loss: finalEpoch.loss,
          final_val_accuracy: finalEpoch.val_accuracy,
          final_val_loss: finalEpoch.val_loss,
          simulated: true
        }
      });

      res.json({
        session: await TrainingSession.findByPk(req.params.id),
        progress,
        summary: {
          epochs_completed: targetEpochs,
          final_accuracy: finalEpoch.accuracy,
          final_loss: finalEpoch.loss,
          learning_rate: lr
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

module.exports = router;
