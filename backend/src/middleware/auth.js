const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');
const sequelize = require('../config/database');
const { sendError } = require('../utils/response');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 'Authentication required', 401);
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, jwtConfig.secret);

    // Verify user is active and not deleted in database
    const [[u]] = await sequelize.query(
      'SELECT id, status, deleted_at FROM users WHERE id = ? LIMIT 1',
      { replacements: [decoded.id] }
    );
    if (!u || u.deleted_at || u.status !== 'active') {
      return sendError(res, 'Account deactivated or deleted. Access denied.', 403);
    }

    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return sendError(res, 'Token expired', 401);
    }
    return sendError(res, 'Invalid token', 401);
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return sendError(res, 'Access denied', 403);
  }
  next();
};

const authorizePermission = () => async (req, res, next) => {
  next();
};

module.exports = { authenticate, authorize, authorizePermission };
