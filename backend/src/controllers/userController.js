const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const sequelize = require('../config/database');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const { getPagination, buildMeta } = require('../utils/pagination');
const { log } = require('../utils/audit');

const listUsers = async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const { role, status, manager_id, search } = req.query;

  let where = 'u.deleted_at IS NULL';
  const replacements = [];

  if (role) { where += ' AND r.name = ?'; replacements.push(role); }
  if (status) { where += ' AND u.status = ?'; replacements.push(status); }
  if (manager_id) { where += ' AND u.manager_id = ?'; replacements.push(manager_id); }
  if (search) {
    where += ' AND (u.full_name LIKE ? OR u.email LIKE ? OR u.mobile LIKE ?)';
    replacements.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  try {
    const [[{ total }]] = await sequelize.query(
      `SELECT COUNT(*) as total FROM users u JOIN roles r ON u.role_id = r.id WHERE ${where}`,
      { replacements }
    );

    const [users] = await sequelize.query(
      `SELECT u.id, u.uuid, u.full_name, u.email, u.mobile, u.department, u.status,
              u.joining_date, u.last_login, u.created_at,
              r.name as role, r.display_name as role_display,
              m.full_name as manager_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN users m ON u.manager_id = m.id
       WHERE ${where}
       ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
      { replacements: [...replacements, limit, offset] }
    );

    return sendPaginated(res, 'Users fetched', users, buildMeta(total, page, limit));
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const createUser = async (req, res) => {
  const { full_name, email, mobile, role_id, manager_id, department, joining_date, password } = req.body;

  try {
    const [existing] = await sequelize.query(
      'SELECT id FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1',
      { replacements: [email] }
    );
    if (existing[0]) return sendError(res, 'Email already registered', 409);

    const hash = await bcrypt.hash(password || 'Welcome@123', 12);
    const uuid = uuidv4();

    await sequelize.query(
      `INSERT INTO users (uuid, full_name, email, mobile, password_hash, role_id, manager_id, department, joining_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      { replacements: [uuid, full_name, email, mobile, hash, role_id, manager_id || null, department || null, joining_date || null, req.user.id] }
    );

    const [[user]] = await sequelize.query(
      `SELECT u.id, u.uuid, u.full_name, u.email, r.name as role FROM users u
       JOIN roles r ON u.role_id = r.id WHERE u.uuid = ? LIMIT 1`,
      { replacements: [uuid] }
    );

    await log({ action: 'USER_CREATED', module: 'users', recordId: user.id, newValue: { email }, performedBy: req.user.id, req });

    return sendSuccess(res, 'User created successfully', user, 201);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const getUser = async (req, res) => {
  try {
    const [users] = await sequelize.query(
      `SELECT u.id, u.uuid, u.full_name, u.email, u.mobile, u.department, u.status,
              u.joining_date, u.last_login, u.created_at, u.updated_at,
              r.id as role_id, r.name as role, r.display_name as role_display,
              m.id as manager_id, m.full_name as manager_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN users m ON u.manager_id = m.id
       WHERE u.id = ? AND u.deleted_at IS NULL LIMIT 1`,
      { replacements: [req.params.id] }
    );
    if (!users[0]) return sendError(res, 'User not found', 404);
    return sendSuccess(res, 'User fetched', users[0]);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const updateUser = async (req, res) => {
  const { full_name, mobile, role_id, manager_id, department, status, joining_date } = req.body;
  try {
    const [users] = await sequelize.query(
      'SELECT id FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      { replacements: [req.params.id] }
    );
    if (!users[0]) return sendError(res, 'User not found', 404);

    await sequelize.query(
      `UPDATE users SET full_name = ?, mobile = ?, role_id = ?, manager_id = ?,
       department = ?, status = ?, joining_date = ?, updated_at = NOW() WHERE id = ?`,
      { replacements: [full_name, mobile, role_id, manager_id || null, department || null, status, joining_date || null, req.params.id] }
    );

    await log({ action: 'USER_UPDATED', module: 'users', recordId: req.params.id, performedBy: req.user.id, req });
    return sendSuccess(res, 'User updated successfully');
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const deleteUser = async (req, res) => {
  try {
    await sequelize.query(
      'UPDATE users SET deleted_at = NOW(), status = ? WHERE id = ?',
      { replacements: ['inactive', req.params.id] }
    );
    await log({ action: 'USER_DEACTIVATED', module: 'users', recordId: req.params.id, performedBy: req.user.id, req });
    return sendSuccess(res, 'User deactivated successfully');
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const resetUserPassword = async (req, res) => {
  const { password } = req.body;
  if (!password) return sendError(res, 'New password required');

  try {
    const hash = await bcrypt.hash(password, 12);
    await sequelize.query('UPDATE users SET password_hash = ? WHERE id = ?', {
      replacements: [hash, req.params.id],
    });
    await log({ action: 'PASSWORD_RESET', module: 'users', recordId: req.params.id, performedBy: req.user.id, req });
    return sendSuccess(res, 'Password reset successfully');
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const getRoles = async (req, res) => {
  try {
    const [roles] = await sequelize.query('SELECT * FROM roles ORDER BY id');
    return sendSuccess(res, 'Roles fetched', roles);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

module.exports = { listUsers, createUser, getUser, updateUser, deleteUser, resetUserPassword, getRoles };
