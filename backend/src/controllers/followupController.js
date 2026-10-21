const { v4: uuidv4 } = require('uuid');
const sequelize = require('../config/database');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const { getPagination, buildMeta } = require('../utils/pagination');
const { log } = require('../utils/audit');

const listFollowups = async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const { status, priority, from_date, to_date, client_id } = req.query;
  const { id: userId, role } = req.user;

  let where = 'f.deleted_at IS NULL';
  const replacements = [];

  if (role === 'sales_executive') {
    where += ' AND f.assigned_salesperson_id = ?'; replacements.push(userId);
  } else if (role === 'sales_manager') {
    where += ' AND (f.assigned_salesperson_id = ? OR f.assigned_salesperson_id IN (SELECT id FROM users WHERE manager_id = ?))';
    replacements.push(userId, userId);
  }

  if (status) { where += ' AND f.status = ?'; replacements.push(status); }
  if (priority) { where += ' AND f.priority = ?'; replacements.push(priority); }
  if (client_id) { where += ' AND f.client_id = ?'; replacements.push(client_id); }
  if (from_date) { where += ' AND f.followup_date >= ?'; replacements.push(from_date); }
  if (to_date) { where += ' AND f.followup_date <= ?'; replacements.push(to_date); }

  try {
    const [[{ total }]] = await sequelize.query(`SELECT COUNT(*) as total FROM followups f WHERE ${where}`, { replacements });

    const [followups] = await sequelize.query(
      `SELECT f.id, f.uuid, f.title, f.followup_date, f.followup_time, f.priority, f.status,
              f.remarks, f.created_at,
              c.company_name, c.city,
              sp.full_name as salesperson_name
       FROM followups f
       JOIN clients c ON f.client_id = c.id
       JOIN users sp ON f.assigned_salesperson_id = sp.id
       WHERE ${where}
       ORDER BY f.followup_date ASC, f.priority DESC LIMIT ? OFFSET ?`,
      { replacements: [...replacements, limit, offset] }
    );

    return sendPaginated(res, 'Follow-ups fetched', followups, buildMeta(total, page, limit));
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const createFollowup = async (req, res) => {
  if (!['super_admin', 'admin'].includes(req.user.role)) {
    return sendError(res, 'Access denied: Only administrators can create follow-ups', 403);
  }

  const { title, client_id, visit_id, opportunity_id, assigned_salesperson_id, followup_date, followup_time, priority, remarks } = req.body;

  try {
    const uuid = uuidv4();
    const salespersonId = assigned_salesperson_id || req.user.id;

    const [result] = await sequelize.query(
      `INSERT INTO followups (uuid, title, client_id, visit_id, opportunity_id, assigned_salesperson_id,
       followup_date, followup_time, priority, remarks, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      { replacements: [uuid, title, client_id, visit_id || null, opportunity_id || null, salespersonId, followup_date, followup_time || null, priority || 'medium', remarks || null, req.user.id] }
    );

    const followupId = typeof result === 'number' ? result : (result?.insertId || result);
    await log({ action: 'FOLLOWUP_CREATED', module: 'followups', recordId: followupId, performedBy: req.user.id, req });
    return sendSuccess(res, 'Follow-up created', { id: followupId, uuid }, 201);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const updateFollowup = async (req, res) => {
  const { title, followup_date, followup_time, priority, remarks, status, completion_notes } = req.body;

  try {
    const [existing] = await sequelize.query(
      'SELECT id, assigned_salesperson_id FROM followups WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      { replacements: [req.params.id] }
    );
    if (!existing[0]) return sendError(res, 'Follow-up not found', 404);

    if (req.user.role === 'sales_executive' && existing[0].assigned_salesperson_id !== req.user.id) {
      return sendError(res, 'Access denied: not your follow-up', 403);
    }

    const completed_date = status === 'completed' ? new Date() : null;

    await sequelize.query(
      `UPDATE followups SET title=?, followup_date=?, followup_time=?, priority=?, remarks=?,
       status=?, completion_notes=?, completed_date=?, updated_at=NOW() WHERE id=?`,
      { replacements: [title, followup_date, followup_time || null, priority, remarks || null, status, completion_notes || null, completed_date, req.params.id] }
    );

    await log({ action: 'FOLLOWUP_UPDATED', module: 'followups', recordId: req.params.id, performedBy: req.user.id, req });
    return sendSuccess(res, 'Follow-up updated');
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const completeFollowup = async (req, res) => {
  const { completion_notes } = req.body;
  try {
    const [existing] = await sequelize.query(
      'SELECT id, assigned_salesperson_id FROM followups WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      { replacements: [req.params.id] }
    );
    if (!existing[0]) return sendError(res, 'Follow-up not found', 404);

    if (req.user.role === 'sales_executive' && existing[0].assigned_salesperson_id !== req.user.id) {
      return sendError(res, 'Access denied: not your follow-up', 403);
    }

    await sequelize.query(
      `UPDATE followups SET status='completed', completion_notes=?, completed_date=NOW(), updated_at=NOW() WHERE id=?`,
      { replacements: [completion_notes || null, req.params.id] }
    );
    await log({ action: 'FOLLOWUP_COMPLETED', module: 'followups', recordId: req.params.id, performedBy: req.user.id, req });
    return sendSuccess(res, 'Follow-up marked as completed');
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const getTodayFollowups = async (req, res) => {
  const { id: userId, role } = req.user;
  let where = "f.status = 'pending' AND f.followup_date = CURDATE() AND f.deleted_at IS NULL";
  const replacements = [];

  if (role === 'sales_executive') {
    where += ' AND f.assigned_salesperson_id = ?'; replacements.push(userId);
  }

  try {
    const [followups] = await sequelize.query(
      `SELECT f.id, f.title, f.followup_time, f.priority, c.company_name, sp.full_name as salesperson_name
       FROM followups f
       JOIN clients c ON f.client_id = c.id
       JOIN users sp ON f.assigned_salesperson_id = sp.id
       WHERE ${where} ORDER BY f.followup_time ASC`,
      { replacements }
    );
    return sendSuccess(res, "Today's follow-ups", followups);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const getOverdueFollowups = async (req, res) => {
  const { id: userId, role } = req.user;
  let where = "f.status = 'pending' AND f.followup_date < CURDATE() AND f.deleted_at IS NULL";
  const replacements = [];

  if (role === 'sales_executive') {
    where += ' AND f.assigned_salesperson_id = ?'; replacements.push(userId);
  } else if (role === 'sales_manager') {
    where += ' AND (f.assigned_salesperson_id = ? OR f.assigned_salesperson_id IN (SELECT id FROM users WHERE manager_id = ?))';
    replacements.push(userId, userId);
  }

  try {
    const [followups] = await sequelize.query(
      `SELECT f.id, f.title, f.followup_date, f.priority, c.company_name, sp.full_name as salesperson_name,
              DATEDIFF(CURDATE(), f.followup_date) as days_overdue
       FROM followups f
       JOIN clients c ON f.client_id = c.id
       JOIN users sp ON f.assigned_salesperson_id = sp.id
       WHERE ${where} ORDER BY f.followup_date ASC`,
      { replacements }
    );

    // Auto-update status to overdue
    await sequelize.query(
      "UPDATE followups SET status='overdue' WHERE status='pending' AND followup_date < CURDATE()"
    );

    return sendSuccess(res, 'Overdue follow-ups', followups);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

module.exports = { listFollowups, createFollowup, updateFollowup, completeFollowup, getTodayFollowups, getOverdueFollowups };
