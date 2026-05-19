const rateLimit = require('express-rate-limit');
let ipKeyGenerator = (ip) => ip;
try { ({ ipKeyGenerator } = require('express-rate-limit')); } catch (_e) { /* older version */ }

// 20 AI requests per user per hour
const aiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  keyGenerator: (req) => {
    return (req.user && req.user.id) ? `user_${req.user.id}` : ipKeyGenerator(req.ip);
  },
  message: { error: 'Too many AI requests. Limit is 20 per hour per user. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 100 general requests per IP per 15 minutes
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  keyGenerator: (req) => {
    return (req.user && req.user.id) ? `user_${req.user.id}` : ipKeyGenerator(req.ip);
  },
  message: { error: 'Too many requests. Limit is 100 per 15 minutes. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { aiRateLimiter, generalLimiter };
