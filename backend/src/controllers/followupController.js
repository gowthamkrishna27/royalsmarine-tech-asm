const { v4: uuidv4 } = require('uuid');
const sequelize = require('../config/database');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const { getPagination, buildMeta } = require('../utils/pagination');
const { log } = require('../utils/audit');

const listFollowups = async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const { status, priority, from_date, to_date, client_id, dues_only } = req.query;
  const { id: userId, role } = req.user;

  // Auto-mark past pending as overdue in database
  try {
    await sequelize.query(
      "UPDATE followups SET status='overdue' WHERE status='pending' AND followup_date < CURDATE() AND deleted_at IS NULL"
    );
  } catch (e) {
    console.error('Auto overdue update failed:', e.message);
  }

  let where = 'f.deleted_at IS NULL';
  const replacements = [];

  if (role === 'sales_executive') {
    where += ' AND f.assigned_salesperson_id = ?'; replacements.push(userId);
  } else if (role === 'sales_manager') {
    where += ' AND (f.assigned_salesperson_id = ? OR f.assigned_salesperson_id IN (SELECT id FROM users WHERE manager_id = ?))';
    replacements.push(userId, userId);
  }

  if (status === 'dues' || status === 'pending_overdue' || dues_only === 'true') {
    where += " AND f.status IN ('pending', 'overdue')";
  } else if (status) {
    where += ' AND f.status = ?'; replacements.push(status);
  }

  if (priority) { where += ' AND f.priority = ?'; replacements.push(priority); }
  if (client_id) { where += ' AND f.client_id = ?'; replacements.push(client_id); }
  if (from_date) { where += ' AND f.followup_date >= ?'; replacements.push(from_date); }
  if (to_date) { where += ' AND f.followup_date <= ?'; replacements.push(to_date); }

  try {
    const [[{ total }]] = await sequelize.query(`SELECT COUNT(*) as total FROM followups f WHERE ${where}`, { replacements });

    const [followups] = await sequelize.query(
      `SELECT f.id, f.uuid, f.title, f.followup_date, f.followup_time, f.priority, f.status,
              f.remarks, f.completion_notes, f.completed_date, f.completed_by, f.created_at,
              c.company_name, c.city, c.mobile as client_mobile, c.village, c.district,
              sp.id as salesperson_id, sp.full_name as salesperson_name, sp.mobile as salesperson_mobile,
              r.name as salesperson_role, r.display_name as salesperson_role_name,
              admin_user.full_name as completed_by_name,
              DATEDIFF(CURDATE(), f.followup_date) as days_overdue
       FROM followups f
       JOIN clients c ON f.client_id = c.id
       JOIN users sp ON f.assigned_salesperson_id = sp.id
       LEFT JOIN roles r ON sp.role_id = r.id
       LEFT JOIN users admin_user ON f.completed_by = admin_user.id
       WHERE ${where}
       ORDER BY 
         CASE WHEN f.status IN ('pending', 'overdue') THEN 0 ELSE 1 END,
         f.followup_date ASC, f.priority DESC LIMIT ? OFFSET ?`,
      { replacements: [...replacements, limit, offset] }
    );

    return sendPaginated(res, 'Follow-ups fetched', followups, buildMeta(total, page, limit));
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const createFollowup = async (req, res) => {
  if (!['super_admin', 'admin', 'sales_manager', 'sales_executive'].includes(req.user.role)) {
    return sendError(res, 'Access denied: You do not have permission to create follow-ups', 403);
  }

  const { title, client_id, visit_id, opportunity_id, assigned_salesperson_id, followup_date, followup_time, priority, remarks } = req.body;

  try {
    const uuid = uuidv4();
    const salespersonId = (assigned_salesperson_id && assigned_salesperson_id !== '') ? assigned_salesperson_id : req.user.id;

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
    const completed_by = status === 'completed' ? req.user.id : null;

    await sequelize.query(
      `UPDATE followups SET title=?, followup_date=?, followup_time=?, priority=?, remarks=?,
       status=?, completion_notes=?, completed_date=?, completed_by=?, updated_at=NOW() WHERE id=?`,
      { replacements: [title, followup_date, followup_time || null, priority, remarks || null, status, completion_notes || null, completed_date, completed_by, req.params.id] }
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
    const [existing] = await sequelize.query(`
      SELECT 
        f.id, f.title, f.followup_date, f.followup_time, f.priority, f.status,
        f.assigned_salesperson_id, f.client_id,
        c.company_name, c.mobile as client_phone, c.village, c.district,
        sp.id as sp_id, sp.full_name as sp_name, sp.mobile as sp_mobile, sp.manager_id,
        r.name as sp_role, r.display_name as sp_role_name,
        mgr.id as mgr_id, mgr.full_name as mgr_name, mgr.mobile as mgr_mobile
      FROM followups f
      JOIN clients c ON f.client_id = c.id
      JOIN users sp ON f.assigned_salesperson_id = sp.id
      LEFT JOIN roles r ON sp.role_id = r.id
      LEFT JOIN users mgr ON sp.manager_id = mgr.id
      WHERE f.id = ? AND f.deleted_at IS NULL LIMIT 1
    `, { replacements: [req.params.id] });

    if (!existing[0]) return sendError(res, 'Follow-up not found', 404);
    const item = existing[0];

    if (req.user.role === 'sales_executive' && item.assigned_salesperson_id !== req.user.id) {
      return sendError(res, 'Access denied: not your follow-up', 403);
    }

    const adminName = req.user.full_name || 'Administrator';
    const notes = completion_notes ? completion_notes.trim() : '';

    // 1. Update follow-up status in the database
    await sequelize.query(
      `UPDATE followups 
       SET status = 'completed', 
           completion_notes = ?, 
           completed_date = NOW(), 
           completed_by = ?, 
           updated_at = NOW() 
       WHERE id = ?`,
      { replacements: [notes || 'Completed by Admin', req.user.id, req.params.id] }
    );

    // 2. Insert In-App Notification into Database for the assigned ASM or Technical Executive
    const notifTitle = 'Follow-up Marked Completed by Administrator';
    const notifMessage = `Your scheduled follow-up for "${item.company_name}" ("${item.title}") on ${item.followup_date} has been marked as COMPLETED by Administrator ${adminName}.${notes ? ` Notes: "${notes}"` : ''}`;

    await sequelize.query(
      `INSERT INTO notifications (user_id, title, message, type, reference_type, reference_id, is_read, created_at)
       VALUES (?, ?, ?, 'followup', 'followup', ?, 0, NOW())`,
      { replacements: [item.assigned_salesperson_id, notifTitle, notifMessage, String(item.id)] }
    );

    // If technical executive reports to an ASM manager, also insert notification for the ASM in database
    if (item.mgr_id && item.mgr_id !== req.user.id && item.mgr_id !== item.assigned_salesperson_id) {
      const asmMessage = `Follow-up due for "${item.company_name}" assigned to ${item.sp_name} (${item.sp_role_name || 'Technical Executive'}) has been marked as COMPLETED by Administrator ${adminName}.${notes ? ` Notes: "${notes}"` : ''}`;
      await sequelize.query(
        `INSERT INTO notifications (user_id, title, message, type, reference_type, reference_id, is_read, created_at)
         VALUES (?, ?, ?, 'followup', 'followup', ?, 0, NOW())`,
        { replacements: [item.mgr_id, notifTitle, asmMessage, String(item.id)] }
      );
    }

    // 3. Format WhatsApp Notification Message
    const recipientPhone = item.sp_mobile || item.mgr_mobile || '';
    const cleanPhone = recipientPhone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

    const roleLabel = item.sp_role_name || (item.sp_role === 'sales_manager' ? 'ASM' : 'Technical Executive');
    const whatsappText = `🔔 *Follow-up Completed - Royals Marine Tech*

Hello *${item.sp_name}* (${roleLabel}),

Your scheduled follow-up due for farmer *${item.company_name}* has been reviewed and marked as *COMPLETED* by Administrator *${adminName}*.

📌 *Follow-up Details:*
• Title: ${item.title}
• Scheduled Date: ${item.followup_date}${item.followup_time ? ` at ${item.followup_time}` : ''}
• Priority: ${(item.priority || 'medium').toUpperCase()}
• Status: ✅ Completed
• Admin Notes: ${notes || 'All requirements completed.'}

This follow-up is recorded in the system database.
Thank you!`;

    const whatsappUrl = formattedPhone ? `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(whatsappText)}` : null;

    await log({ action: 'FOLLOWUP_COMPLETED', module: 'followups', recordId: req.params.id, performedBy: req.user.id, req });

    return sendSuccess(res, 'Follow-up marked as completed and notification sent', {
      id: item.id,
      status: 'completed',
      assigned_to: item.sp_name,
      assigned_mobile: item.sp_mobile,
      assigned_role: roleLabel,
      whatsapp_url: whatsappUrl,
      whatsapp_text: whatsappText,
      notification_sent: true,
    });
  } catch (err) {
    console.error('Error in completeFollowup:', err);
    return sendError(res, err.message, 500);
  }
};

const getTodayFollowups = async (req, res) => {
  const { id: userId, role } = req.user;
  let where = "f.status = 'pending' AND f.followup_date = CURDATE() AND f.deleted_at IS NULL";
  const replacements = [];

  if (role === 'sales_executive') {
    where += ' AND f.assigned_salesperson_id = ?'; replacements.push(userId);
  } else if (role === 'sales_manager') {
    where += ' AND (f.assigned_salesperson_id = ? OR f.assigned_salesperson_id IN (SELECT id FROM users WHERE manager_id = ?))';
    replacements.push(userId, userId);
  }

  try {
    const [followups] = await sequelize.query(
      `SELECT f.id, f.title, f.followup_time, f.priority, f.status, c.company_name, 
              sp.full_name as salesperson_name, sp.mobile as salesperson_mobile,
              r.display_name as salesperson_role_name
       FROM followups f
       JOIN clients c ON f.client_id = c.id
       JOIN users sp ON f.assigned_salesperson_id = sp.id
       LEFT JOIN roles r ON sp.role_id = r.id
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
  let where = "f.status IN ('pending', 'overdue') AND f.followup_date < CURDATE() AND f.deleted_at IS NULL";
  const replacements = [];

  if (role === 'sales_executive') {
    where += ' AND f.assigned_salesperson_id = ?'; replacements.push(userId);
  } else if (role === 'sales_manager') {
    where += ' AND (f.assigned_salesperson_id = ? OR f.assigned_salesperson_id IN (SELECT id FROM users WHERE manager_id = ?))';
    replacements.push(userId, userId);
  }

  try {
    const [followups] = await sequelize.query(
      `SELECT f.id, f.title, f.followup_date, f.priority, f.status, c.company_name, 
              sp.full_name as salesperson_name, sp.mobile as salesperson_mobile,
              r.display_name as salesperson_role_name,
              DATEDIFF(CURDATE(), f.followup_date) as days_overdue
       FROM followups f
       JOIN clients c ON f.client_id = c.id
       JOIN users sp ON f.assigned_salesperson_id = sp.id
       LEFT JOIN roles r ON sp.role_id = r.id
       WHERE ${where} ORDER BY f.followup_date ASC`,
      { replacements }
    );

    // Auto-update status to overdue in database
    await sequelize.query(
      "UPDATE followups SET status='overdue' WHERE status='pending' AND followup_date < CURDATE() AND deleted_at IS NULL"
    );

    return sendSuccess(res, 'Overdue follow-ups', followups);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

module.exports = { listFollowups, createFollowup, updateFollowup, completeFollowup, getTodayFollowups, getOverdueFollowups };
