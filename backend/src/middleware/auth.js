const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');
const { sendError } = require('../utils/response');

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 'Authentication required', 401);
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, jwtConfig.secret);
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

const authorizePermission = (module, action) => async (req, res, next) => {
  const { role } = req.user;
  if (role === 'super_admin') return next();

  try {
    const sequelize = require('../config/database');
    const [rows] = await sequelize.query(
      `SELECT p.id FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permission_id
       JOIN roles r ON rp.role_id = r.id
       WHERE r.name = ? AND p.module = ? AND p.action = ?`,
      { replacements: [role, module, action] }
    );
    if (rows.length > 0) return next();
    return sendError(res, 'Insufficient permissions', 403);
  } catch {
    return sendError(res, 'Permission check failed', 500);
  }
};

module.exports = { authenticate, authorize, authorizePermission };
