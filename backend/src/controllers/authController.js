const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const jwtConfig = require('../config/jwt');
const sequelize = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');
const { log } = require('../utils/audit');

const generateTokens = (user) => {
  const payload = { id: user.id, uuid: user.uuid, email: user.email, role: user.role_name };
  const accessToken = jwt.sign(payload, jwtConfig.secret, { expiresIn: jwtConfig.expiresIn });
  const refreshToken = jwt.sign(payload, jwtConfig.refreshSecret, { expiresIn: jwtConfig.refreshExpiresIn });
  return { accessToken, refreshToken };
};

const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return sendError(res, 'Email and password required');

  try {
    const [users] = await sequelize.query(
      `SELECT u.*, r.name as role_name FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.email = ? AND u.deleted_at IS NULL LIMIT 1`,
      { replacements: [email] }
    );

    const user = users[0];
    if (!user) return sendError(res, 'Invalid credentials', 401);
    if (user.status !== 'active') return sendError(res, 'Account deactivated. Contact admin.', 403);

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return sendError(res, 'Invalid credentials', 401);

    const { accessToken, refreshToken } = generateTokens(user);

    await sequelize.query(
      'UPDATE users SET refresh_token = ?, last_login = NOW() WHERE id = ?',
      { replacements: [refreshToken, user.id] }
    );

    await log({ action: 'LOGIN', module: 'auth', recordId: user.id, performedBy: user.id, req });

    return sendSuccess(res, 'Login successful', {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        uuid: user.uuid,
        full_name: user.full_name,
        email: user.email,
        mobile: user.mobile,
        role: user.role_name,
      },
    });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const refreshToken = async (req, res) => {
  const { refreshToken: token } = req.body;
  if (!token) return sendError(res, 'Refresh token required');

  try {
    const decoded = jwt.verify(token, jwtConfig.refreshSecret);
    const [users] = await sequelize.query(
      `SELECT u.*, r.name as role_name FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = ? AND u.refresh_token = ? AND u.deleted_at IS NULL LIMIT 1`,
      { replacements: [decoded.id, token] }
    );

    if (!users[0]) return sendError(res, 'Invalid refresh token', 401);

    const { accessToken, refreshToken: newRefresh } = generateTokens(users[0]);
    await sequelize.query('UPDATE users SET refresh_token = ? WHERE id = ?', {
      replacements: [newRefresh, users[0].id],
    });

    return sendSuccess(res, 'Token refreshed', { accessToken, refreshToken: newRefresh });
  } catch {
    return sendError(res, 'Invalid or expired refresh token', 401);
  }
};

const logout = async (req, res) => {
  try {
    await sequelize.query('UPDATE users SET refresh_token = NULL WHERE id = ?', {
      replacements: [req.user.id],
    });
    await log({ action: 'LOGOUT', module: 'auth', recordId: req.user.id, performedBy: req.user.id, req });
    return sendSuccess(res, 'Logged out successfully');
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return sendError(res, 'Email required');

  try {
    const [users] = await sequelize.query(
      'SELECT id FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1',
      { replacements: [email] }
    );
    if (!users[0]) return sendSuccess(res, 'If this email exists, a reset link has been sent.');

    const token = uuidv4();
    const expires = new Date(Date.now() + 60 * 60 * 1000);
    await sequelize.query(
      'UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE id = ?',
      { replacements: [token, expires, users[0].id] }
    );

    // In production, send email here with reset link
    return sendSuccess(res, 'Password reset link sent if email exists.');
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const resetPassword = async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return sendError(res, 'Token and new password required');

  try {
    const [users] = await sequelize.query(
      `SELECT id FROM users WHERE password_reset_token = ?
       AND password_reset_expires > NOW() AND deleted_at IS NULL LIMIT 1`,
      { replacements: [token] }
    );
    if (!users[0]) return sendError(res, 'Invalid or expired reset token');

    const hash = await bcrypt.hash(password, 12);
    await sequelize.query(
      'UPDATE users SET password_hash = ?, password_reset_token = NULL, password_reset_expires = NULL WHERE id = ?',
      { replacements: [hash, users[0].id] }
    );

    return sendSuccess(res, 'Password reset successful');
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const getMe = async (req, res) => {
  try {
    const [users] = await sequelize.query(
      `SELECT u.id, u.uuid, u.full_name, u.email, u.mobile, u.department, u.status, u.last_login,
              r.name as role, r.display_name as role_display,
              m.full_name as manager_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN users m ON u.manager_id = m.id
       WHERE u.id = ? AND u.deleted_at IS NULL LIMIT 1`,
      { replacements: [req.user.id] }
    );
    if (!users[0]) return sendError(res, 'User not found', 404);
    return sendSuccess(res, 'Profile fetched', users[0]);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

module.exports = { login, refreshToken, logout, forgotPassword, resetPassword, getMe };
