const { v4: uuidv4 } = require('uuid');
const sequelize = require('../config/database');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const { getPagination, buildMeta } = require('../utils/pagination');
const { log } = require('../utils/audit');

let followupColsChecked = false;
async function ensureFollowupCols() {
  if (followupColsChecked) return;
  try {
    const [cols] = await sequelize.query('SHOW COLUMNS FROM followups;');
    const names = cols.map(c => c.Field);
    if (!names.includes('test_required')) {
      await sequelize.query('ALTER TABLE followups ADD COLUMN test_required TINYINT(1) DEFAULT 0;');
    }
    if (!names.includes('test_details')) {
      await sequelize.query('ALTER TABLE followups ADD COLUMN test_details JSON NULL;');
    }
    if (!names.includes('tank_id')) {
      await sequelize.query('ALTER TABLE followups ADD COLUMN tank_id INT NULL;');
    }
    if (!names.includes('test_week')) {
      await sequelize.query('ALTER TABLE followups ADD COLUMN test_week VARCHAR(20) NULL;');
    }
    if (!names.includes('completed_by')) {
      await sequelize.query('ALTER TABLE followups ADD COLUMN completed_by INT NULL;');
    }
    followupColsChecked = true;
  } catch (e) {
    console.warn('ensureFollowupCols note:', e.message);
  }
}

let lastWeeklySyncTime = 0;
/**
 * Automatically syncs mandatory weekly water tests for every farmer's active tanks.
 * - Current week: If no test has been performed yet, a follow-up task is placed in "Dues".
 * - Previous week: If a week was skipped without performing a test, the follow-up task is in "Overdues".
 */
async function syncWeeklyTankTests(force = false) {
  const now = Date.now();
  if (!force && now - lastWeeklySyncTime < 60000) return;
  lastWeeklySyncTime = now;

  try {
    await ensureFollowupCols();

    // 1. Get dates from database
    const [[dates]] = await sequelize.query(`
      SELECT 
        CURDATE() as today,
        DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY) as current_week_start,
        DATE_SUB(CURDATE(), INTERVAL (WEEKDAY(CURDATE()) + 7) DAY) as prev_week_start,
        YEARWEEK(CURDATE(), 1) as current_yw,
        YEARWEEK(DATE_SUB(CURDATE(), INTERVAL 7 DAY), 1) as prev_yw
    `);

    if (!dates) return;
    const { current_week_start, prev_week_start, current_yw, prev_yw } = dates;
    const currentWeekKey = String(current_yw);
    const prevWeekKey = String(prev_yw);

    // 2. Fetch all active ponds with client details
    const [ponds] = await sequelize.query(`
      SELECT 
        p.id as pond_id,
        p.pond_name,
        p.tank_number,
        p.created_by as pond_created_by,
        c.id as client_id,
        c.company_name,
        c.assigned_salesperson_id,
        c.assigned_manager_id
      FROM ponds p
      JOIN clients c ON p.client_id = c.id
      WHERE c.deleted_at IS NULL
        AND p.deleted_at IS NULL
        AND (p.status = 'active' OR p.status IS NULL)
    `);

    if (!ponds || ponds.length === 0) return;

    for (const pond of ponds) {
      const assignedExecId =
        pond.assigned_salesperson_id ||
        pond.assigned_manager_id ||
        pond.pond_created_by;

      if (!assignedExecId) continue;

      const tankLabel = pond.tank_number || pond.pond_name || ('Tank #' + pond.pond_id);

      // --- A. Current Week Test (In "Dues") ---
      const [[currentVisit]] = await sequelize.query(`
        SELECT id FROM visits 
        WHERE tank_id = ? 
          AND visit_date >= ?
          AND (meeting_type = 'water_quality' OR water_quality IS NOT NULL)
          AND deleted_at IS NULL
        LIMIT 1
      `, { replacements: [pond.pond_id, current_week_start] });

      const [[currentFollowup]] = await sequelize.query(`
        SELECT id, status FROM followups
        WHERE tank_id = ? AND test_week = ? AND deleted_at IS NULL
        LIMIT 1
      `, { replacements: [pond.pond_id, currentWeekKey] });

      if (currentVisit || (currentFollowup && currentFollowup.status === 'completed')) {
        // Test already performed this week
        if (currentFollowup && currentFollowup.status !== 'completed') {
          await sequelize.query(`
            UPDATE followups 
            SET status = 'completed', completed_date = NOW(), updated_at = NOW(),
                completion_notes = COALESCE(completion_notes, 'Weekly test verified and completed')
            WHERE id = ?
          `, { replacements: [currentFollowup.id] });
        }
      } else {
        // Not tested this week -> must be in Dues (status = 'pending')
        if (!currentFollowup) {
          const uuid = uuidv4();
          await sequelize.query(`
            INSERT INTO followups (
              uuid, title, client_id, tank_id, assigned_salesperson_id,
              followup_date, followup_time, priority, status, test_required, test_week, remarks
            ) VALUES (?, ?, ?, ?, ?, ?, '09:00:00', 'medium', 'pending', 1, ?, ?)
          `, {
            replacements: [
              uuid,
              'Weekly Water Test - ' + tankLabel,
              pond.client_id,
              pond.pond_id,
              assignedExecId,
              current_week_start,
              currentWeekKey,
              'Weekly water quality test for ' + pond.company_name + ' (' + tankLabel + ')'
            ]
          });
        } else if (currentFollowup.status !== 'pending' && currentFollowup.status !== 'completed') {
          await sequelize.query(`
            UPDATE followups SET status = 'pending', followup_date = ?, updated_at = NOW()
            WHERE id = ?
          `, { replacements: [current_week_start, currentFollowup.id] });
        }
      }

      // --- B. Previous Week Test (Skipped Week -> In "Overdues") ---
      const [[prevVisit]] = await sequelize.query(`
        SELECT id FROM visits 
        WHERE tank_id = ? 
          AND visit_date >= ? AND visit_date < ?
          AND (meeting_type = 'water_quality' OR water_quality IS NOT NULL)
          AND deleted_at IS NULL
        LIMIT 1
      `, { replacements: [pond.pond_id, prev_week_start, current_week_start] });

      const [[prevFollowup]] = await sequelize.query(`
        SELECT id, status FROM followups
        WHERE tank_id = ? AND test_week = ? AND deleted_at IS NULL
        LIMIT 1
      `, { replacements: [pond.pond_id, prevWeekKey] });

      if (prevVisit || (prevFollowup && prevFollowup.status === 'completed')) {
        if (prevFollowup && prevFollowup.status !== 'completed') {
          await sequelize.query(`
            UPDATE followups 
            SET status = 'completed', completed_date = NOW(), updated_at = NOW()
            WHERE id = ?
          `, { replacements: [prevFollowup.id] });
        }
      } else {
        // Previous week was SKIPPED without a test -> must be in Overdues
        if (!prevFollowup) {
          const uuid = uuidv4();
          await sequelize.query(`
            INSERT INTO followups (
              uuid, title, client_id, tank_id, assigned_salesperson_id,
              followup_date, followup_time, priority, status, test_required, test_week, remarks
            ) VALUES (?, ?, ?, ?, ?, ?, '09:00:00', 'high', 'overdue', 1, ?, ?)
          `, {
            replacements: [
              uuid,
              'Weekly Water Test - ' + tankLabel,
              pond.client_id,
              pond.pond_id,
              assignedExecId,
              prev_week_start,
              prevWeekKey,
              'Weekly water quality test for ' + pond.company_name + ' (' + tankLabel + ')'
            ]
          });
        } else if (prevFollowup.status !== 'overdue' && prevFollowup.status !== 'completed') {
          await sequelize.query(`
            UPDATE followups SET status = 'overdue', followup_date = ?, updated_at = NOW()
            WHERE id = ?
          `, { replacements: [prev_week_start, prevFollowup.id] });
        }
      }
    }
  } catch (err) {
    console.error('syncWeeklyTankTests error:', err.message);
  }
}

function applyPersonnelAndRegionFilters(query, where, replacements) {
  const { region, asm_id, manager_id, tech_id, salesperson_id } = query;

  if (region && String(region).trim()) {
    const reg = String(region).trim();
    where += ` AND (
      f.assigned_salesperson_id IN (
        SELECT u.id FROM users u
        LEFT JOIN users m ON u.manager_id = m.id
        WHERE (LOWER(u.region) = LOWER(?) OR LOWER(m.region) = LOWER(?)) AND u.deleted_at IS NULL AND u.status = 'active'
      )
      OR f.client_id IN (
        SELECT c.id FROM clients c
        LEFT JOIN users sp ON c.assigned_salesperson_id = sp.id
        LEFT JOIN users m ON c.assigned_manager_id = m.id
        LEFT JOIN users sp_m ON sp.manager_id = sp_m.id
        WHERE (
          LOWER(c.district) = LOWER(?)
          OR LOWER(c.city) = LOWER(?)
          OR LOWER(m.region) = LOWER(?)
          OR LOWER(sp_m.region) = LOWER(?)
          OR LOWER(sp.region) = LOWER(?)
        ) AND c.deleted_at IS NULL
      )
    )`;
    replacements.push(reg, reg, reg, reg, reg, reg, reg);
  }

  const asmFilterId = asm_id || manager_id;
  if (asmFilterId) {
    where += ` AND (
      f.assigned_salesperson_id = ?
      OR f.assigned_salesperson_id IN (SELECT id FROM users WHERE manager_id = ? AND deleted_at IS NULL AND status = 'active')
      OR f.client_id IN (
        SELECT id FROM clients
        WHERE (assigned_manager_id = ? OR assigned_salesperson_id IN (SELECT id FROM users WHERE manager_id = ? AND deleted_at IS NULL AND status = 'active'))
          AND deleted_at IS NULL
      )
    )`;
    replacements.push(asmFilterId, asmFilterId, asmFilterId, asmFilterId);
  }

  const techFilterId = tech_id || salesperson_id;
  if (techFilterId) {
    where += ' AND (f.assigned_salesperson_id = ? OR (f.assigned_salesperson_id IS NULL AND f.created_by = ?))';
    replacements.push(techFilterId, techFilterId);
  }

  return where;
}

const listFollowups = async (req, res) => {
  await ensureFollowupCols();
  await syncWeeklyTankTests();
  const { page, limit, offset } = getPagination(req.query);
  const { status, priority, from_date, to_date, date, followup_date, client_id, dues_only } = req.query;
  const { id: userId, role } = req.user;

  // Auto-mark overdue in database for > 7 days, and reset to pending if <= 7 days
  try {
    await sequelize.query(
      "UPDATE followups SET status='overdue' WHERE status='pending' AND DATEDIFF(CURDATE(), followup_date) > 7 AND deleted_at IS NULL"
    );
    await sequelize.query(
      "UPDATE followups SET status='pending' WHERE status='overdue' AND DATEDIFF(CURDATE(), followup_date) <= 7 AND deleted_at IS NULL"
    );
    await sequelize.query(
      "UPDATE followups SET title = TRIM(REPLACE(title, '(Skipped Week)', '')) WHERE title LIKE '%(Skipped Week)%'"
    );
  } catch (e) {
    console.error('Auto overdue update failed:', e.message);
  }

  let where = "f.deleted_at IS NULL AND (f.assigned_salesperson_id IS NULL OR f.assigned_salesperson_id IN (SELECT id FROM users WHERE status = 'active' AND deleted_at IS NULL))";
  const replacements = [];

  if (role === 'sales_executive') {
    where += ' AND (f.assigned_salesperson_id = ? OR (f.assigned_salesperson_id IS NULL AND f.created_by = ?))';
    replacements.push(userId, userId);
  } else if (role === 'sales_manager') {
    where += ` AND (
      f.assigned_salesperson_id = ?
      OR f.created_by = ?
      OR f.assigned_salesperson_id IN (SELECT id FROM users WHERE manager_id = ? AND deleted_at IS NULL)
      OR f.client_id IN (SELECT id FROM clients WHERE assigned_manager_id = ? AND deleted_at IS NULL)
    )`;
    replacements.push(userId, userId, userId, userId);
  }

  if (status === 'dues') {
    where += " AND f.status = 'pending' AND DATEDIFF(CURDATE(), f.followup_date) <= 7";
  } else if (status === 'overdue') {
    where += " AND (f.status = 'overdue' OR (f.status = 'pending' AND DATEDIFF(CURDATE(), f.followup_date) > 7))";
  } else if (status === 'pending') {
    where += " AND f.status IN ('pending', 'overdue')";
  } else if (dues_only === 'true') {
    where += " AND f.status = 'pending' AND DATEDIFF(CURDATE(), f.followup_date) <= 7";
  } else if (status === 'upcoming') {
    where += " AND f.status = 'pending' AND f.followup_date > CURDATE()";
  } else if (status === 'completed') {
    where += " AND f.status = 'completed'";
  } else if (status === 'cancelled') {
    where += " AND f.status = 'cancelled'";
  } else if (status && status !== 'all') {
    where += ' AND f.status = ?'; replacements.push(status);
  }

  if (priority) { where += ' AND f.priority = ?'; replacements.push(priority); }
  if (client_id) { where += ' AND f.client_id = ?'; replacements.push(client_id); }

  const singleDate = date || followup_date;
  if (singleDate) {
    where += ' AND f.followup_date = ?';
    replacements.push(singleDate);
  } else {
    if (from_date) { where += ' AND f.followup_date >= ?'; replacements.push(from_date); }
    if (to_date) { where += ' AND f.followup_date <= ?'; replacements.push(to_date); }
  }

  where = applyPersonnelAndRegionFilters(req.query, where, replacements);

  try {
    const [[{ total }]] = await sequelize.query(`SELECT COUNT(*) as total FROM followups f WHERE ${where}`, { replacements });

    const [followups] = await sequelize.query(
      `SELECT f.id, f.uuid, f.title, f.followup_date, f.followup_time, f.priority, f.status,
              f.remarks, f.completion_notes, f.completed_date, f.completed_by, f.created_at,
              f.test_required, f.test_details, f.tank_id, f.test_week,
              p.pond_name as tank_name, p.tank_number,
              c.company_name, c.city, c.city as client_city, c.mobile as client_mobile,
              c.village, c.village as client_village, c.district, c.district as client_district,
              sp.id as salesperson_id, sp.full_name as salesperson_name, sp.mobile as salesperson_mobile,
              r.name as salesperson_role, r.display_name as salesperson_role_name,
              COALESCE(
                admin_user.full_name,
                v_sp.full_name,
                v_cb.full_name,
                CASE WHEN LOWER(f.status) = 'completed' THEN sp.full_name ELSE NULL END,
                CASE WHEN LOWER(f.status) = 'completed' THEN cr.full_name ELSE NULL END
              ) as completed_by_name,
              DATEDIFF(CURDATE(), f.followup_date) as days_overdue
       FROM followups f
       LEFT JOIN clients c ON f.client_id = c.id
       LEFT JOIN users sp ON f.assigned_salesperson_id = sp.id
       LEFT JOIN roles r ON sp.role_id = r.id
       LEFT JOIN users admin_user ON f.completed_by = admin_user.id
       LEFT JOIN visits v ON f.visit_id = v.id
       LEFT JOIN users v_sp ON v.salesperson_id = v_sp.id
       LEFT JOIN users v_cb ON v.created_by = v_cb.id
       LEFT JOIN users cr ON f.created_by = cr.id
       LEFT JOIN ponds p ON f.tank_id = p.id
       WHERE ${where}
       ORDER BY 
         CASE 
           WHEN f.status = 'overdue' OR (f.status = 'pending' AND DATEDIFF(CURDATE(), f.followup_date) > 7) THEN 0
           WHEN f.status = 'pending' AND f.followup_date <= CURDATE() THEN 1 
           WHEN f.status = 'pending' THEN 2 
           ELSE 3 
         END,
         f.followup_date ASC, f.created_at DESC LIMIT ? OFFSET ?`,
      { replacements: [...replacements, limit, offset] }
    );

    return sendPaginated(res, 'Follow-ups fetched', followups, buildMeta(total, page, limit));
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const createFollowup = async (req, res) => {
  await ensureFollowupCols();
  if (!['super_admin', 'admin', 'sales_manager', 'sales_executive'].includes(req.user.role)) {
    return sendError(res, 'Access denied: You do not have permission to create follow-ups', 403);
  }

  const {
    title,
    client_id,
    visit_id,
    opportunity_id,
    assigned_salesperson_id,
    followup_date,
    followup_time,
    priority,
    remarks,
    test_required,
    tank_id,
    test_details,
  } = req.body;

  if (req.user.role === 'sales_executive') {
    const [c] = await sequelize.query(
      'SELECT id, assigned_salesperson_id, created_by FROM clients WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      { replacements: [client_id] }
    );
    if (!c[0]) return sendError(res, 'Farmer not found', 404);
    const isAssigned = Number(c[0].assigned_salesperson_id) === Number(req.user.id);
    const isUnassignedCreator = !c[0].assigned_salesperson_id && Number(c[0].created_by) === Number(req.user.id);
    if (!isAssigned && !isUnassignedCreator) {
      return sendError(res, 'Access denied: You can only create follow-ups for your assigned farmers', 403);
    }
  }

  try {
    const uuid = uuidv4();
    const salespersonId = (assigned_salesperson_id && assigned_salesperson_id !== '') ? assigned_salesperson_id : req.user.id;
    const isTestRequired = test_required ? 1 : 0;
    const cleanTankId = tank_id ? Number(tank_id) : null;
    const jsonTestDetails = test_details ? (typeof test_details === 'object' ? JSON.stringify(test_details) : test_details) : null;

    const [result] = await sequelize.query(
      `INSERT INTO followups (uuid, title, client_id, visit_id, opportunity_id, assigned_salesperson_id,
       followup_date, followup_time, priority, remarks, test_required, tank_id, test_details, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      {
        replacements: [
          uuid,
          title,
          client_id,
          visit_id || null,
          opportunity_id || null,
          salespersonId,
          followup_date,
          followup_time || null,
          priority || 'medium',
          remarks || null,
          isTestRequired,
          cleanTankId,
          jsonTestDetails,
          req.user.id,
        ],
      }
    );

    const followupId = typeof result === 'number' ? result : (result?.insertId || result);
    await log({ action: 'FOLLOWUP_CREATED', module: 'followups', recordId: followupId, performedBy: req.user.id, req });

    // Send In-App Notifications to the assigned Tech or ASM
    try {
      const [metaRows] = await sequelize.query(
        `SELECT 
           c.company_name, c.city, c.assigned_manager_id as client_mgr_id,
           sp.id as sp_id, sp.full_name as sp_name, sp.manager_id as sp_mgr_id,
           r.name as sp_role, r.display_name as sp_role_name,
           mgr.id as mgr_id, mgr.full_name as mgr_name
         FROM users sp
         LEFT JOIN roles r ON sp.role_id = r.id
         LEFT JOIN users mgr ON sp.manager_id = mgr.id
         LEFT JOIN clients c ON c.id = ?
         WHERE sp.id = ? LIMIT 1`,
        { replacements: [client_id || null, salespersonId] }
      );

      const target = metaRows[0] || {};
      const farmerName = target.company_name || 'Farmer';
      const creatorRoleLabel = ['super_admin', 'admin'].includes(req.user.role)
        ? 'Administrator'
        : (req.user.role === 'sales_manager' ? 'ASM' : 'Technical Executive');
      const creatorDisplayName = req.user.full_name ? `${creatorRoleLabel} ${req.user.full_name}` : creatorRoleLabel;
      const timeStr = followup_time ? ` at ${followup_time}` : '';
      const notesStr = remarks ? ` Notes: "${remarks}"` : '';
      const testReqStr = isTestRequired ? ' [Field/Water Test Required]' : '';

      // 1. Notify the assigned Executive (Tech or ASM) if creator is not the assignee
      if (Number(salespersonId) !== Number(req.user.id)) {
        const notifTitle = `New Follow-up Assigned: ${title}${testReqStr}`;
        const notifMessage = `${creatorDisplayName} has assigned you a follow-up for farmer "${farmerName}" scheduled on ${followup_date}${timeStr}.${notesStr}${isTestRequired ? ' (Water test required on completion)' : ''}`;

        await sequelize.query(
          `INSERT INTO notifications (user_id, title, message, type, reference_type, reference_id, is_read, created_at)
           VALUES (?, ?, ?, 'followup', 'followup', ?, 0, NOW())`,
          { replacements: [salespersonId, notifTitle, notifMessage, followupId] }
        );
      }

      // 2. Identify the ASM manager:
      // Can be the manager of the assigned executive (target.sp_mgr_id) OR client's assigned manager (target.client_mgr_id)
      const asmManagerId = target.sp_mgr_id || target.client_mgr_id;

      // If the assigned executive has an ASM manager, also notify the ASM manager
      // (Unless the ASM manager is the creator themselves, or the assigned user is the ASM manager)
      if (
        asmManagerId &&
        Number(asmManagerId) !== Number(req.user.id) &&
        Number(asmManagerId) !== Number(salespersonId)
      ) {
        const asmTitle = `New Follow-up Assigned to ${target.sp_name || 'Technical Executive'}: ${title}${testReqStr}`;
        const asmMessage = `${creatorDisplayName} has scheduled a follow-up for farmer "${farmerName}" assigned to ${target.sp_name || 'Technical Executive'} on ${followup_date}${timeStr}.${notesStr}${isTestRequired ? ' (Water test required on completion)' : ''}`;

        await sequelize.query(
          `INSERT INTO notifications (user_id, title, message, type, reference_type, reference_id, is_read, created_at)
           VALUES (?, ?, ?, 'followup', 'followup', ?, 0, NOW())`,
          { replacements: [asmManagerId, asmTitle, asmMessage, followupId] }
        );
      }
    } catch (notifErr) {
      console.error('Failed to dispatch follow-up creation notification:', notifErr.message);
    }

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
  await ensureFollowupCols();
  const { completion_notes, test_data, water_quality, tank_id } = req.body;
  try {
    const [existing] = await sequelize.query(`
      SELECT 
        f.id, f.title, f.followup_date, f.followup_time, f.priority, f.status,
        f.assigned_salesperson_id, f.client_id, f.test_required, f.test_details, f.tank_id,
        c.company_name, c.mobile as client_phone, c.village, c.district,
        sp.id as sp_id, sp.full_name as sp_name, sp.mobile as sp_mobile, sp.manager_id,
        r.name as sp_role, r.display_name as sp_role_name,
        mgr.id as mgr_id, mgr.full_name as mgr_name, mgr.mobile as mgr_mobile
      FROM followups f
      LEFT JOIN clients c ON f.client_id = c.id
      LEFT JOIN users sp ON f.assigned_salesperson_id = sp.id
      LEFT JOIN roles r ON sp.role_id = r.id
      LEFT JOIN users mgr ON sp.manager_id = mgr.id
      WHERE f.id = ? AND f.deleted_at IS NULL LIMIT 1
    `, { replacements: [req.params.id] });

    if (!existing[0]) return sendError(res, 'Follow-up not found', 404);
    const item = existing[0];

    if (req.user.role === 'sales_executive' && item.assigned_salesperson_id !== req.user.id) {
      return sendError(res, 'Access denied: not your follow-up', 403);
    }

    const isAdmin = ['super_admin', 'admin'].includes(req.user.role);
    const testPayload = test_data || water_quality;

    // Rule: If test is required and user is NOT an admin, test data MUST be provided
    if (Boolean(item.test_required) && !isAdmin) {
      if (!testPayload || typeof testPayload !== 'object') {
        return sendError(res, 'Field test results (pH, Salinity, Ammonia, Nitrite) are required to complete this follow-up.', 400);
      }
      const { ph, salinity, ammonia, nitrite } = testPayload;
      if (
        ph === undefined || ph === null || String(ph).trim() === '' ||
        salinity === undefined || salinity === null || String(salinity).trim() === '' ||
        ammonia === undefined || ammonia === null || String(ammonia).trim() === '' ||
        nitrite === undefined || nitrite === null || String(nitrite).trim() === ''
      ) {
        return sendError(res, 'Test results are incomplete. pH, Salinity, Ammonia, and Nitrite are mandatory.', 400);
      }
    }

    const actorRole = isAdmin
      ? 'Administrator'
      : (req.user.role === 'sales_manager' ? 'ASM' : 'Technical Executive');
    const actorName = req.user.full_name ? `${actorRole} (${req.user.full_name})` : actorRole;
    const adminName = req.user.full_name ? `${req.user.full_name} (${actorRole})` : actorRole;
    const notes = completion_notes ? (typeof completion_notes === 'string' ? completion_notes.trim() : JSON.stringify(completion_notes)) : '';
    const finalTankId = tank_id ? Number(tank_id) : (item.tank_id || null);

    let createdVisitId = null;
    let jsonTestDetails = null;

    // If test data was provided (mandatory for non-admin, optional for admin)
    if (testPayload && typeof testPayload === 'object' && Object.keys(testPayload).length > 0) {
      jsonTestDetails = JSON.stringify(testPayload);
      try {
        const visitUuid = uuidv4();
        const todayDate = new Date().toISOString().slice(0, 10);
        const currentTime = new Date().toTimeString().slice(0, 5);

        // Fetch tank number if pond exists
        let tankNumber = null;
        if (finalTankId) {
          const [pRows] = await sequelize.query('SELECT tank_number FROM ponds WHERE id = ? LIMIT 1', { replacements: [finalTankId] });
          if (pRows[0]) tankNumber = pRows[0].tank_number;
        }

        const [vResult] = await sequelize.query(
          `INSERT INTO visits (
             uuid, visit_date, visit_time, salesperson_id, client_id,
             meeting_type, meeting_highlights, remarks, visit_outcome,
             tank_id, tank_number, water_quality, created_by, approval_status
           ) VALUES (?, ?, ?, ?, ?, 'water_quality', ?, ?, ?, ?, ?, ?, ?, 'approved')`,
          {
            replacements: [
              visitUuid,
              todayDate,
              currentTime,
              item.assigned_salesperson_id || req.user.id,
              item.client_id,
              `Water quality test on completing follow-up: ${item.title}`,
              notes || 'Water test recorded upon follow-up completion.',
              'Follow-up completed with water test',
              finalTankId,
              tankNumber,
              jsonTestDetails,
              req.user.id,
            ],
          }
        );
        createdVisitId = typeof vResult === 'number' ? vResult : (vResult?.insertId || vResult);
      } catch (visitErr) {
        console.error('Failed to auto-create visit for test data:', visitErr.message);
      }
    }

    // 1. Update follow-up status in the database
    await sequelize.query(
      `UPDATE followups 
       SET status = 'completed', 
           completion_notes = ?, 
           test_details = COALESCE(?, test_details),
           tank_id = COALESCE(?, tank_id),
           visit_id = COALESCE(visit_id, ?),
           completed_date = NOW(), 
           completed_by = ?, 
           updated_at = NOW() 
       WHERE id = ?`,
      {
        replacements: [
          notes || `Completed by ${actorRole}`,
          jsonTestDetails,
          finalTankId,
          createdVisitId,
          req.user.id,
          req.params.id,
        ],
      }
    );

    // Format test results summary if recorded
    let testSummaryText = '';
    if (testPayload && typeof testPayload === 'object' && testPayload.ph) {
      testSummaryText = `\n🔬 Test Results: pH: ${testPayload.ph} | Salinity: ${testPayload.salinity} ppt | Ammonia: ${testPayload.ammonia} ppm | Nitrite: ${testPayload.nitrite} ppm`;
    }

    // 2. Insert In-App Notification into Database for the assigned ASM or Technical Executive
    const notifTitle = `Follow-up Marked Completed by ${actorRole}`;
    const notifMessage = `Your scheduled follow-up for "${item.company_name}" ("${item.title}") on ${item.followup_date} has been marked as COMPLETED by ${actorName}.${notes ? ` Notes: "${notes}"` : ''}${testSummaryText}`;

    if (item.assigned_salesperson_id && Number(item.assigned_salesperson_id) !== Number(req.user.id)) {
      await sequelize.query(
        `INSERT INTO notifications (user_id, title, message, type, reference_type, reference_id, is_read, created_at)
         VALUES (?, ?, ?, 'followup', 'followup', ?, 0, NOW())`,
        { replacements: [item.assigned_salesperson_id, notifTitle, notifMessage, String(item.id)] }
      );
    }

    // If technical executive reports to an ASM manager, also insert notification for the ASM in database
    if (item.mgr_id && Number(item.mgr_id) !== Number(req.user.id) && Number(item.mgr_id) !== Number(item.assigned_salesperson_id)) {
      const asmMessage = `Follow-up due for "${item.company_name}" assigned to ${item.sp_name} (${item.sp_role_name || 'Technical Executive'}) has been marked as COMPLETED by ${actorName}.${notes ? ` Notes: "${notes}"` : ''}${testSummaryText}`;
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

Your scheduled follow-up due for farmer *${item.company_name}* has been reviewed and marked as *COMPLETED* by *${adminName}*.

📌 *Follow-up Details:*
• Title: ${item.title}
• Scheduled Date: ${item.followup_date}${item.followup_time ? ` at ${item.followup_time}` : ''}
• Priority: ${(item.priority || 'medium').toUpperCase()}
• Status: ✅ Completed
• Notes: ${notes || 'All requirements completed.'}${testSummaryText ? `\n• Test: ${testSummaryText.trim()}` : ''}

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
      test_recorded: Boolean(createdVisitId),
      notification_sent: true,
    });
  } catch (err) {
    console.error('Error in completeFollowup:', err);
    return sendError(res, err.message, 500);
  }
};

const getTodayFollowups = async (req, res) => {
  await ensureFollowupCols();
  await syncWeeklyTankTests();
  const { id: userId, role } = req.user;
  let where = "f.status = 'pending' AND f.followup_date = CURDATE() AND f.deleted_at IS NULL";
  const replacements = [];

  if (role === 'sales_executive') {
    where += ' AND (f.assigned_salesperson_id = ? OR (f.assigned_salesperson_id IS NULL AND f.created_by = ?))';
    replacements.push(userId, userId);
  } else if (role === 'sales_manager') {
    where += ` AND (
      f.assigned_salesperson_id = ?
      OR f.created_by = ?
      OR f.assigned_salesperson_id IN (SELECT id FROM users WHERE manager_id = ? AND deleted_at IS NULL)
      OR f.client_id IN (SELECT id FROM clients WHERE assigned_manager_id = ? AND deleted_at IS NULL)
    )`;
    replacements.push(userId, userId, userId, userId);
  }

  where = applyPersonnelAndRegionFilters(req.query, where, replacements);

  try {
    const [followups] = await sequelize.query(
      `SELECT f.id, f.title, f.followup_time, f.priority, f.status, c.company_name, 
              f.test_required, f.test_details, f.tank_id, f.test_week,
              p.pond_name as tank_name, p.tank_number,
              sp.full_name as salesperson_name, sp.mobile as salesperson_mobile,
              r.display_name as salesperson_role_name
       FROM followups f
       LEFT JOIN clients c ON f.client_id = c.id
       LEFT JOIN users sp ON f.assigned_salesperson_id = sp.id
       LEFT JOIN roles r ON sp.role_id = r.id
       LEFT JOIN ponds p ON f.tank_id = p.id
       WHERE ${where} ORDER BY f.followup_time ASC`,
      { replacements }
    );
    return sendSuccess(res, "Today's follow-ups", followups);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const getDuesFollowups = async (req, res) => {
  await ensureFollowupCols();
  await syncWeeklyTankTests();
  const { id: userId, role } = req.user;
  let where = "f.status = 'pending' AND DATEDIFF(CURDATE(), f.followup_date) <= 7 AND f.deleted_at IS NULL";
  const replacements = [];

  if (role === 'sales_executive') {
    where += ' AND (f.assigned_salesperson_id = ? OR (f.assigned_salesperson_id IS NULL AND f.created_by = ?))';
    replacements.push(userId, userId);
  } else if (role === 'sales_manager') {
    where += ` AND (
      f.assigned_salesperson_id = ?
      OR f.created_by = ?
      OR f.assigned_salesperson_id IN (SELECT id FROM users WHERE manager_id = ? AND deleted_at IS NULL)
      OR f.client_id IN (SELECT id FROM clients WHERE assigned_manager_id = ? AND deleted_at IS NULL)
    )`;
    replacements.push(userId, userId, userId, userId);
  }

  where = applyPersonnelAndRegionFilters(req.query, where, replacements);

  try {
    const [followups] = await sequelize.query(
      `SELECT f.id, f.title, f.followup_date, f.followup_time, f.priority, f.status, c.company_name, 
              f.test_required, f.test_details, f.tank_id, f.test_week,
              p.pond_name as tank_name, p.tank_number,
              sp.full_name as salesperson_name, sp.mobile as salesperson_mobile,
              r.display_name as salesperson_role_name,
              DATEDIFF(CURDATE(), f.followup_date) as days_due
       FROM followups f
       LEFT JOIN clients c ON f.client_id = c.id
       LEFT JOIN users sp ON f.assigned_salesperson_id = sp.id
       LEFT JOIN roles r ON sp.role_id = r.id
       LEFT JOIN ponds p ON f.tank_id = p.id
       WHERE ${where} ORDER BY f.followup_date DESC`,
      { replacements }
    );
    return sendSuccess(res, 'Dues follow-ups', followups);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const getOverdueFollowups = async (req, res) => {
  await ensureFollowupCols();
  await syncWeeklyTankTests();
  const { id: userId, role } = req.user;
  let where = "(f.status = 'overdue' OR (f.status = 'pending' AND DATEDIFF(CURDATE(), f.followup_date) > 7)) AND f.deleted_at IS NULL";
  const replacements = [];

  if (role === 'sales_executive') {
    where += ' AND (f.assigned_salesperson_id = ? OR (f.assigned_salesperson_id IS NULL AND f.created_by = ?))';
    replacements.push(userId, userId);
  } else if (role === 'sales_manager') {
    where += ` AND (
      f.assigned_salesperson_id = ?
      OR f.created_by = ?
      OR f.assigned_salesperson_id IN (SELECT id FROM users WHERE manager_id = ? AND deleted_at IS NULL)
      OR f.client_id IN (SELECT id FROM clients WHERE assigned_manager_id = ? AND deleted_at IS NULL)
    )`;
    replacements.push(userId, userId, userId, userId);
  }

  where = applyPersonnelAndRegionFilters(req.query, where, replacements);

  try {
    const [followups] = await sequelize.query(
      `SELECT f.id, f.title, f.followup_date, f.priority, f.status, c.company_name, 
              f.test_required, f.test_details, f.tank_id, f.test_week,
              p.pond_name as tank_name, p.tank_number,
              sp.full_name as salesperson_name, sp.mobile as salesperson_mobile,
              r.display_name as salesperson_role_name,
              DATEDIFF(CURDATE(), f.followup_date) as days_overdue
       FROM followups f
       LEFT JOIN clients c ON f.client_id = c.id
       LEFT JOIN users sp ON f.assigned_salesperson_id = sp.id
       LEFT JOIN roles r ON sp.role_id = r.id
       LEFT JOIN ponds p ON f.tank_id = p.id
       WHERE ${where} ORDER BY f.followup_date ASC`,
      { replacements }
    );

    // Auto-update status to overdue in database for > 7 days
    await sequelize.query(
      "UPDATE followups SET status='overdue' WHERE status='pending' AND DATEDIFF(CURDATE(), followup_date) > 7 AND deleted_at IS NULL"
    );

    return sendSuccess(res, 'Overdue follow-ups', followups);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const getFollowupStats = async (req, res) => {
  await ensureFollowupCols();
  await syncWeeklyTankTests();
  const { id: userId, role } = req.user;
  let where = "f.deleted_at IS NULL AND (f.assigned_salesperson_id IS NULL OR f.assigned_salesperson_id IN (SELECT id FROM users WHERE status = 'active' AND deleted_at IS NULL))";
  const replacements = [];

  if (role === 'sales_executive') {
    where += ' AND (f.assigned_salesperson_id = ? OR (f.assigned_salesperson_id IS NULL AND f.created_by = ?))';
    replacements.push(userId, userId);
  } else if (role === 'sales_manager') {
    where += ` AND (
      f.assigned_salesperson_id = ?
      OR f.created_by = ?
      OR f.assigned_salesperson_id IN (SELECT id FROM users WHERE manager_id = ? AND deleted_at IS NULL)
      OR f.client_id IN (SELECT id FROM clients WHERE assigned_manager_id = ? AND deleted_at IS NULL)
    )`;
    replacements.push(userId, userId, userId, userId);
  }

  where = applyPersonnelAndRegionFilters(req.query, where, replacements);

  try {
    const [[stats]] = await sequelize.query(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN f.status IN ('pending', 'overdue') THEN 1 ELSE 0 END) as non_completed,
         SUM(CASE WHEN f.status = 'pending' AND DATEDIFF(CURDATE(), f.followup_date) <= 7 THEN 1 ELSE 0 END) as dues,
         SUM(CASE WHEN (f.status = 'overdue' OR (f.status = 'pending' AND DATEDIFF(CURDATE(), f.followup_date) > 7)) THEN 1 ELSE 0 END) as overdue,
         SUM(CASE WHEN f.status = 'pending' AND f.followup_date > CURDATE() THEN 1 ELSE 0 END) as upcoming,
         SUM(CASE WHEN f.status = 'completed' THEN 1 ELSE 0 END) as completed
       FROM followups f
       WHERE ${where}`,
      { replacements }
    );

    return sendSuccess(res, 'Follow-up stats', {
      total: Number(stats?.total || 0),
      non_completed: Number(stats?.non_completed || 0),
      dues: Number(stats?.dues || 0),
      overdue: Number(stats?.overdue || 0),
      upcoming: Number(stats?.upcoming || 0),
      completed: Number(stats?.completed || 0),
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
  getDuesFollowups,
  getOverdueFollowups,
  getFollowupStats,
  syncWeeklyTankTests,
};
