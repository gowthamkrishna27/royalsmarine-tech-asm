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
  const { title, client_id, visit_id, opportunity_id, assigned_salesperson_id, followup_date, followup_time, priority, remarks } = req.body;

  try {
    const uuid = uuidv4();
    const salespersonId = req.user.role === 'sales_executive' ? req.user.id : (assigned_salesperson_id || req.user.id);

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

/**
 * List tests for agents and ASMs with due and overdue follow-up statuses
 */
const listTestFollowups = async (req, res) => {
  try {
    const { status, submitter_type, submitter_id, search, limit = 100 } = req.query;

    let whereConditions = ['1=1'];
    const replacements = [];

    // Filter by submitter role/type: 'agent' or 'asm'
    if (submitter_type === 'agent') {
      whereConditions.push(`(
        LOWER(COALESCE(s.role, r.display_name, r.name, '')) NOT LIKE '%asm%'
        AND LOWER(COALESCE(s.role, r.name, '')) NOT LIKE '%sales_manager%'
        AND LOWER(COALESCE(s.role, r.display_name, '')) NOT LIKE '%area sales manager%'
      )`);
    } else if (submitter_type === 'asm') {
      whereConditions.push(`(
        LOWER(COALESCE(s.role, r.display_name, r.name, '')) LIKE '%asm%'
        OR LOWER(COALESCE(s.role, r.name, '')) LIKE '%sales_manager%'
        OR LOWER(COALESCE(s.role, r.display_name, '')) LIKE '%area sales manager%'
      )`);
    }

    if (submitter_id) {
      whereConditions.push('(s.user_id = ? OR s.agent_id = ?)');
      replacements.push(submitter_id, submitter_id);
    }

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      whereConditions.push(`(
        s.id LIKE ? OR
        s.test_type LIKE ? OR
        s.user_name LIKE ? OR
        u.full_name LIKE ? OR
        c.company_name LIKE ? OR
        f.name LIKE ? OR
        p.pond_name LIKE ? OR
        s.locality LIKE ?
      )`);
      replacements.push(q, q, q, q, q, q, q, q);
    }

    // Dynamic followup status filtering
    if (status === 'completed') {
      whereConditions.push("s.followup_status = 'completed'");
    } else if (status === 'overdue') {
      whereConditions.push("s.followup_status != 'completed' AND COALESCE(s.due_date, s.date) < CURDATE()");
    } else if (status === 'due') {
      whereConditions.push("s.followup_status != 'completed' AND COALESCE(s.due_date, s.date) >= CURDATE()");
    }

    const whereClause = whereConditions.join(' AND ');

    const [tests] = await sequelize.query(`
      SELECT 
        s.id,
        s.agent_id,
        s.user_id,
        COALESCE(s.user_name, u.full_name, 'Field Executive') as submitter_name,
        COALESCE(s.role, r.display_name, r.name, 'Technical Executive') as submitter_role,
        CASE 
          WHEN LOWER(COALESCE(s.role, r.display_name, r.name, '')) LIKE '%asm%' 
            OR LOWER(COALESCE(s.role, r.name, '')) LIKE '%sales_manager%' 
            OR LOWER(COALESCE(s.role, r.display_name, '')) LIKE '%area sales manager%'
          THEN 'asm'
          ELSE 'agent'
        END as submitter_type,
        s.farmer_id,
        COALESCE(c.company_name, f.name, 'Farmer') as farmer_name,
        COALESCE(c.mobile, f.phone, '—') as farmer_mobile,
        COALESCE(s.locality, c.village, c.city, f.district, 'Local') as locality,
        s.tank_id,
        COALESCE(p.pond_name, t.name, CONCAT('Tank #', s.tank_id)) as tank_name,
        COALESCE(s.test_type, 'Water Quality Analysis') as test_type,
        s.date as test_date,
        COALESCE(s.due_date, s.date) as due_date,
        s.submission_time,
        UPPER(COALESCE(s.status, 'PENDING_VERIFICATION')) as status,
        CASE 
          WHEN s.followup_status = 'completed' THEN 'completed'
          WHEN COALESCE(s.due_date, s.date) < CURDATE() THEN 'overdue'
          ELSE 'due'
        END as followup_status,
        CASE 
          WHEN s.followup_status != 'completed' AND COALESCE(s.due_date, s.date) < CURDATE() 
          THEN DATEDIFF(CURDATE(), COALESCE(s.due_date, s.date))
          ELSE 0
        END as days_overdue,
        s.data as parameters,
        s.latitude,
        s.longitude,
        s.accuracy,
        s.review_notes as notes,
        s.followed_up_by_id,
        s.followed_up_by_name,
        s.followed_up_at,
        s.admin_completion_notes,
        n.id as notification_id,
        n.is_read as notification_is_read,
        n.read_at as notification_read_at,
        n.created_at as notification_sent_at,
        s.created_at
      FROM submissions s
      LEFT JOIN users u ON u.id = CAST(NULLIF(s.user_id, '') AS UNSIGNED)
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN clients c ON c.id = CAST(NULLIF(s.farmer_id, '') AS UNSIGNED)
      LEFT JOIN farmers f ON f.id = CAST(NULLIF(s.farmer_id, '') AS UNSIGNED)
      LEFT JOIN ponds p ON p.id = CAST(NULLIF(s.tank_id, '') AS UNSIGNED)
      LEFT JOIN tanks t ON t.id = CAST(NULLIF(s.tank_id, '') AS UNSIGNED)
      LEFT JOIN (
        SELECT reference_id, MAX(id) as id, MAX(is_read) as is_read, MAX(read_at) as read_at, MAX(created_at) as created_at
        FROM notifications 
        WHERE reference_type = 'test_submission'
        GROUP BY reference_id
      ) n ON n.reference_id = s.id
      WHERE ${whereClause}
      ORDER BY 
        CASE 
          WHEN s.followup_status != 'completed' AND COALESCE(s.due_date, s.date) < CURDATE() THEN 1
          WHEN s.followup_status != 'completed' THEN 2
          ELSE 3
        END ASC,
        COALESCE(s.due_date, s.date) ASC,
        s.created_at DESC
      LIMIT ?
    `, { replacements: [...replacements, parseInt(limit, 10)] });

    // Summary counts
    const [[summary]] = await sequelize.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN s.followup_status = 'completed' THEN 1 ELSE 0 END) as completed_count,
        SUM(CASE WHEN s.followup_status != 'completed' AND COALESCE(s.due_date, s.date) < CURDATE() THEN 1 ELSE 0 END) as overdue_count,
        SUM(CASE WHEN s.followup_status != 'completed' AND COALESCE(s.due_date, s.date) >= CURDATE() THEN 1 ELSE 0 END) as due_count,
        SUM(CASE 
          WHEN LOWER(COALESCE(s.role, r.display_name, r.name, '')) LIKE '%asm%' 
            OR LOWER(COALESCE(s.role, r.name, '')) LIKE '%sales_manager%' 
            OR LOWER(COALESCE(s.role, r.display_name, '')) LIKE '%area sales manager%'
          THEN 1 ELSE 0 END) as asm_count,
        SUM(CASE 
          WHEN LOWER(COALESCE(s.role, r.display_name, r.name, '')) NOT LIKE '%asm%' 
            AND LOWER(COALESCE(s.role, r.name, '')) NOT LIKE '%sales_manager%' 
            AND LOWER(COALESCE(s.role, r.display_name, '')) NOT LIKE '%area sales manager%'
          THEN 1 ELSE 0 END) as agent_count
      FROM submissions s
      LEFT JOIN users u ON u.id = CAST(NULLIF(s.user_id, '') AS UNSIGNED)
      LEFT JOIN roles r ON u.role_id = r.id
    `);

    return sendSuccess(res, 'Test follow-ups fetched', {
      tests,
      stats: {
        total: Number(summary?.total || 0),
        due_count: Number(summary?.due_count || 0),
        overdue_count: Number(summary?.overdue_count || 0),
        completed_count: Number(summary?.completed_count || 0),
        agent_count: Number(summary?.agent_count || 0),
        asm_count: Number(summary?.asm_count || 0),
      }
    });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

/**
 * Mark a test follow-up as complete, record admin name, and send notification to respective agent or ASM
 */
const completeTestFollowup = async (req, res) => {
  const { id } = req.params;
  const { notes, remarks } = req.body;
  const adminId = req.user.id;
  const adminName = req.user.full_name || 'Administrator';

  try {
    const [existingRows] = await sequelize.query(`
      SELECT 
        s.*,
        COALESCE(c.company_name, f.name, 'Farmer') as farmer_name,
        COALESCE(p.pond_name, t.name, CONCAT('Tank #', s.tank_id)) as tank_name
      FROM submissions s
      LEFT JOIN clients c ON c.id = CAST(NULLIF(s.farmer_id, '') AS UNSIGNED)
      LEFT JOIN farmers f ON f.id = CAST(NULLIF(s.farmer_id, '') AS UNSIGNED)
      LEFT JOIN ponds p ON p.id = CAST(NULLIF(s.tank_id, '') AS UNSIGNED)
      LEFT JOIN tanks t ON t.id = CAST(NULLIF(s.tank_id, '') AS UNSIGNED)
      WHERE s.id = ?
      LIMIT 1
    `, { replacements: [id] });

    if (!existingRows.length) {
      return sendError(res, 'Test submission not found', 404);
    }

    const test = existingRows[0];
    const completionNote = notes || remarks || 'Test parameters reviewed and follow-up completed.';

    // 1. Update submissions table with admin info
    await sequelize.query(`
      UPDATE submissions
      SET followup_status = 'completed',
          followed_up_by_id = ?,
          followed_up_by_name = ?,
          followed_up_at = NOW(),
          admin_completion_notes = ?
      WHERE id = ?
    `, {
      replacements: [adminId, adminName, completionNote, id]
    });

    // 2. Send notification message to the respective ASM or Agent
    const targetUserId = parseInt(test.user_id, 10);
    let notificationInserted = false;

    if (!isNaN(targetUserId) && targetUserId > 0) {
      const notifTitle = `Test Follow-up Completed: ${test.test_type}`;
      const notifMsg = `Admin ${adminName} has followed up and completed your test (${test.test_type}) for farmer ${test.farmer_name} (${test.tank_name}). Notes: ${completionNote}`;

      await sequelize.query(`
        INSERT INTO notifications (
          user_id, title, message, type, reference_type, reference_id, is_read, created_at
        ) VALUES (
          ?, ?, ?, 'followup', 'test_submission', ?, 0, NOW()
        )
      `, {
        replacements: [targetUserId, notifTitle, notifMsg, id]
      });
      notificationInserted = true;
    }

    // 3. Log audit log
    await log({
      action: 'TEST_FOLLOWUP_COMPLETED',
      module: 'followups',
      recordId: id,
      performedBy: adminId,
      req,
      details: {
        admin_name: adminName,
        recipient_user_id: targetUserId,
        recipient_name: test.user_name,
        test_type: test.test_type,
        notes: completionNote
      }
    });

    return sendSuccess(res, `Test follow-up marked as completed. Message sent to ${test.user_name || 'submitter'}.`, {
      id,
      followed_up_by_id: adminId,
      followed_up_by_name: adminName,
      followed_up_at: new Date(),
      admin_completion_notes: completionNote,
      recipient_id: targetUserId,
      recipient_name: test.user_name,
      notification_sent: notificationInserted,
    });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

module.exports = {
  listFollowups,
  createFollowup,
  updateFollowup,
  completeFollowup,
  getTodayFollowups,
  getOverdueFollowups,
  listTestFollowups,
  completeTestFollowup,
};
