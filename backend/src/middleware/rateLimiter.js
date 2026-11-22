const rateLimit = require('express-rate-limit');

const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return String(forwarded).split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
};

const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 10000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip health checks and CORS preflights
    if (req.method === 'OPTIONS' || req.path === '/health') return true;
    // Authenticated company staff (ASM, Technical Executive, Admin) should never be blocked by rate limiting
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) return true;
    return false;
  },
  keyGenerator: getClientIp,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX) || 100,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
  keyGenerator: getClientIp,
  message: { success: false, message: 'Too many login attempts, please try again later.' },
});

module.exports = { apiLimiter, loginLimiter };
