const { v4: uuidv4 } = require('uuid');
const ExcelJS = require('exceljs');
const sequelize = require('../config/database');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const { getPagination, buildMeta } = require('../utils/pagination');
const { log } = require('../utils/audit');

const VISIT_EDIT_WINDOW_SECONDS = 5 * 60; // Visits can only be updated within 5 minutes of submission

const getVisitCols = async () => {
  const [cols] = await sequelize.query(
    `SELECT COLUMN_NAME FROM information_schema.columns WHERE TABLE_NAME = 'visits' AND TABLE_SCHEMA = DATABASE()`
  );
  return new Set(cols.map(c => c.COLUMN_NAME));
};

const buildVisitWhere = (query, userId, role) => {
  let where = "v.deleted_at IS NULL AND v.salesperson_id IN (SELECT id FROM users WHERE status = 'active' AND deleted_at IS NULL)";
  const replacements = [];

  if (role === 'sales_executive') {
    where += ' AND v.salesperson_id = ?';
    replacements.push(userId);
  } else if (role === 'sales_manager') {
    where += ' AND (v.salesperson_id = ? OR v.salesperson_id IN (SELECT id FROM users WHERE manager_id = ? AND status = \'active\' AND deleted_at IS NULL))';
    replacements.push(userId, userId);
  }

  // Filter by Region
  if (query.region && String(query.region).trim()) {
    const reg = String(query.region).trim();
    where += ` AND (
      v.salesperson_id IN (
        SELECT u.id FROM users u
        LEFT JOIN users m ON u.manager_id = m.id
        WHERE (LOWER(u.region) = LOWER(?) OR LOWER(m.region) = LOWER(?)) AND u.deleted_at IS NULL AND u.status = 'active'
      )
      OR v.client_id IN (
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

  // Filter by ASM (Sales Manager)
  const asmId = query.asm_id || query.manager_id;
  if (asmId) {
    where += ` AND (
      v.salesperson_id = ?
      OR v.salesperson_id IN (SELECT id FROM users WHERE manager_id = ? AND deleted_at IS NULL AND status = 'active')
      OR v.client_id IN (
        SELECT id FROM clients
        WHERE (assigned_manager_id = ? OR assigned_salesperson_id IN (SELECT id FROM users WHERE manager_id = ? AND deleted_at IS NULL AND status = 'active'))
          AND deleted_at IS NULL
      )
    )`;
    replacements.push(asmId, asmId, asmId, asmId);
  }

  // Filter by Tech (Sales Executive)
  const techId = query.tech_id || query.salesperson_id;
  if (techId) {
    where += ' AND v.salesperson_id = ?';
    replacements.push(techId);
  }

  // Filter by Farmer (Client)
  const farmerId = query.client_id || query.farmer_id;
  if (farmerId) {
    where += ' AND v.client_id = ?';
    replacements.push(farmerId);
  }

  if (query.approval_status) { where += ' AND v.approval_status = ?'; replacements.push(query.approval_status); }
  if (query.meeting_type) { where += ' AND v.meeting_type = ?'; replacements.push(query.meeting_type); }
  if (query.from_date) { where += ' AND v.visit_date >= ?'; replacements.push(query.from_date); }
  if (query.to_date) { where += ' AND v.visit_date <= ?'; replacements.push(query.to_date); }

  return { where, replacements };
};

const listVisits = async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const { where, replacements } = buildVisitWhere(req.query, req.user.id, req.user.role);

  try {
    const [[{ total }]] = await sequelize.query(
      `SELECT COUNT(*) as total FROM visits v WHERE ${where}`,
      { replacements }
    );

    const [visits] = await sequelize.query(
      `SELECT v.id, v.uuid, v.visit_date, v.visit_time, v.meeting_type, v.person_met,
              v.visit_outcome, v.approval_status, v.next_followup_date, v.created_at,
              TIMESTAMPDIFF(SECOND, v.created_at, NOW()) as seconds_since_creation,
              v.tank_id, v.tank_number,
              c.company_name, c.city,
              sp.full_name as salesperson_name
       FROM visits v
       JOIN clients c ON v.client_id = c.id
       JOIN users sp ON v.salesperson_id = sp.id
       WHERE ${where}
       ORDER BY v.visit_date DESC, v.visit_time DESC LIMIT ? OFFSET ?`,
      { replacements: [...replacements, limit, offset] }
    );

    const visitsWithEditInfo = visits.map(v => {
      const secDb = Number(v.seconds_since_creation);
      const secNode = v.created_at ? Math.max(0, Math.floor((Date.now() - new Date(v.created_at).getTime()) / 1000)) : 999999;
      const elapsed = !isNaN(secDb) && secDb >= 0 ? secDb : secNode;
      const isEditable = elapsed <= VISIT_EDIT_WINDOW_SECONDS && v.approval_status !== 'approved';
      return {
        ...v,
        is_editable: isEditable,
        edit_time_remaining_seconds: Math.max(0, VISIT_EDIT_WINDOW_SECONDS - elapsed),
      };
    });

    return sendPaginated(res, 'Visits fetched', visitsWithEditInfo, buildMeta(total, page, limit));
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const createVisit = async (req, res) => {
  if (['super_admin', 'admin', 'management', 'backend_ops'].includes(req.user.role)) {
    return sendError(res, 'Admins cannot create or log visits. Field visits can only be conducted by technical executives or ASMs.', 403);
  }
  const {
    visit_date, visit_time, client_id, latitude, longitude, gps_address,
    gps_captured_at, gps_denied_reason, person_met, designation_met,
    meeting_type, meeting_highlights, remarks, visit_outcome, next_action,
    next_followup_date, brands, categories,
    tank_id, tank_number, water_quality, feeding_details, medication_details, harvest_details, disease_details,
  } = req.body;

  const t = await sequelize.transaction();
  try {
    const cols = await getVisitCols();
    const hasDisease = cols.has('disease_details');
    const uuid = uuidv4();
    const formattedGpsCapturedAt = gps_captured_at ? new Date(gps_captured_at).toISOString().slice(0, 19).replace('T', ' ') : null;

    // Water quality mandatory field validation
    if (meeting_type === 'water_quality' || meeting_type === 'all') {
      const wq = water_quality || {};
      const missing = [];
      if (!wq.ph) missing.push('pH');
      if (!wq.ammonia) missing.push('Ammonia');
      if (!wq.salinity) missing.push('Salinity');
      if (!wq.nitrite) missing.push('Nitrite');
      if (missing.length > 0) {
        return sendError(res, `Water quality fields are required: ${missing.join(', ')}`, 400);
      }
    }
    // Harvest details mandatory count validation
    if (meeting_type === 'harvest_details') {
      const hd = harvest_details || {};
      const partials = Array.isArray(hd.partial_harvests) ? hd.partial_harvests : [];
      const finalH = hd.final_harvest || {};
      const hasFinalData = Object.values(finalH).some(val => val !== null && val !== undefined && String(val).trim() !== '');

      if (partials.length === 0 && !hasFinalData) {
        return sendError(res, 'Harvest details are required. Please provide harvest details with Count.', 400);
      }

      for (let i = 0; i < partials.length; i++) {
        if (partials[i].count === undefined || partials[i].count === null || String(partials[i].count).trim() === '') {
          return sendError(res, `Count is mandatory for Partial Harvest #${i + 1}`, 400);
        }
      }

      if (hasFinalData || partials.length === 0) {
        if (finalH.count === undefined || finalH.count === null || String(finalH.count).trim() === '') {
          return sendError(res, 'Count is mandatory for Final Harvest', 400);
        }
      }
    } else if (harvest_details) {
      const hd = harvest_details;
      const partials = Array.isArray(hd.partial_harvests) ? hd.partial_harvests : [];
      const finalH = hd.final_harvest || {};
      const hasFinalData = Object.values(finalH).some(val => val !== null && val !== undefined && String(val).trim() !== '');

      for (let i = 0; i < partials.length; i++) {
        if (partials[i].count === undefined || partials[i].count === null || String(partials[i].count).trim() === '') {
          return sendError(res, `Count is mandatory for Partial Harvest #${i + 1}`, 400);
        }
      }

      if (hasFinalData) {
        if (finalH.count === undefined || finalH.count === null || String(finalH.count).trim() === '') {
          return sendError(res, 'Count is mandatory for Final Harvest', 400);
        }
      }
    }


    const jsonWaterQuality = water_quality ? JSON.stringify(water_quality) : null;
    const jsonFeeding = feeding_details ? JSON.stringify(feeding_details) : null;
    const jsonMedication = medication_details ? JSON.stringify(medication_details) : null;
    const jsonHarvest = harvest_details ? JSON.stringify(harvest_details) : null;
    const jsonDisease = disease_details ? JSON.stringify(disease_details) : null;

    const fields = [
      'uuid', 'visit_date', 'visit_time', 'salesperson_id', 'client_id', 'latitude', 'longitude',
      'gps_address', 'gps_captured_at', 'gps_denied_reason', 'person_met', 'designation_met', 'meeting_type',
      'meeting_highlights', 'remarks', 'visit_outcome', 'next_action', 'next_followup_date',
      'tank_id', 'tank_number', 'water_quality', 'feeding_details', 'medication_details', 'harvest_details',
    ];
    const replacements = [
      uuid, visit_date, visit_time, req.user.id, client_id,
      latitude || null, longitude || null, gps_address || null,
      formattedGpsCapturedAt, gps_denied_reason || null,
      person_met || null, designation_met || null, meeting_type,
      meeting_highlights || null, remarks || null, visit_outcome || null,
      next_action || null, next_followup_date || null,
      tank_id || null, tank_number || null, jsonWaterQuality, jsonFeeding, jsonMedication, jsonHarvest,
    ];
    if (hasDisease) {
      fields.push('disease_details');
      replacements.push(jsonDisease);
    }
    fields.push('created_by');
    replacements.push(req.user.id);

    const [insertResult] = await sequelize.query(
      `INSERT INTO visits (${fields.join(', ')})
       VALUES (${fields.map(() => '?').join(', ')})`,
      { replacements, transaction: t }
    );

    const visitId = typeof insertResult === 'number' ? insertResult : (insertResult?.insertId || insertResult);

    // Auto-create follow-up only if admin set a due/overdue follow-up date
    if (next_followup_date && ['super_admin', 'admin'].includes(req.user.role)) {
      const followupDate = new Date(`${String(next_followup_date).slice(0, 10)}T00:00:00`);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (!Number.isNaN(followupDate.getTime()) && followupDate <= today) {
        await sequelize.query(
          `INSERT INTO followups (uuid, title, client_id, visit_id, assigned_salesperson_id, followup_date, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          {
            replacements: [uuidv4(), `Follow-up after ${meeting_type} visit`, client_id, visitId, req.user.id, next_followup_date, req.user.id],
            transaction: t,
          }
        );
      }
    }

    await t.commit();

    await log({ action: 'VISIT_SUBMITTED', module: 'visits', recordId: visitId, performedBy: req.user.id, req });

    return sendSuccess(res, 'Visit submitted successfully', { id: visitId, uuid }, 201);
  } catch (err) {
    await t.rollback();
    return sendError(res, err.message, 500);
  }
};

const getVisit = async (req, res) => {
  try {
    const [visits] = await sequelize.query(
      `SELECT v.*, c.company_name, c.city, c.state,
              TIMESTAMPDIFF(SECOND, v.created_at, NOW()) as seconds_since_creation,
              sp.full_name as salesperson_name, ab.full_name as approved_by_name
       FROM visits v
       JOIN clients c ON v.client_id = c.id
       JOIN users sp ON v.salesperson_id = sp.id
       LEFT JOIN users ab ON v.approved_by = ab.id
       WHERE v.id = ? AND v.deleted_at IS NULL LIMIT 1`,
      { replacements: [req.params.id] }
    );
    if (!visits[0]) return sendError(res, 'Visit not found', 404);

    const visit = visits[0];

    // Data isolation: Sales Executive can only view their own visits
    if (req.user.role === 'sales_executive' && visit.salesperson_id !== req.user.id) {
      return sendError(res, 'Access denied: not your visit', 403);
    }

    // Data isolation: Sales Manager can only view their own visits or their team's visits
    if (req.user.role === 'sales_manager') {
      const isSelf = visit.salesperson_id === req.user.id;
      if (!isSelf) {
        const [managed] = await sequelize.query(
          'SELECT id FROM users WHERE id = ? AND manager_id = ? LIMIT 1',
          { replacements: [visit.salesperson_id, req.user.id] }
        );
        if (!managed.length) return sendError(res, 'Access denied: visit outside your territory', 403);
      }
    }

    const [attachments] = await sequelize.query(
      'SELECT id, original_name, file_type, file_size, created_at FROM visit_attachments WHERE visit_id = ?',
      { replacements: [req.params.id] }
    );

    const safeParse = (val) => {
      if (!val) return null;
      if (typeof val === 'object') return val;
      try { return JSON.parse(val); } catch { return val; }
    };
    visit.water_quality = safeParse(visit.water_quality);
    visit.feeding_details = safeParse(visit.feeding_details);
    visit.medication_details = safeParse(visit.medication_details);
    visit.harvest_details = safeParse(visit.harvest_details);
    visit.disease_details = safeParse(visit.disease_details);

    const secDb = Number(visit.seconds_since_creation);
    const secNode = visit.created_at ? Math.max(0, Math.floor((Date.now() - new Date(visit.created_at).getTime()) / 1000)) : 999999;
    const elapsed = !isNaN(secDb) && secDb >= 0 ? secDb : secNode;
    const isEditable = elapsed <= VISIT_EDIT_WINDOW_SECONDS && visit.approval_status !== 'approved';
    const remainingSeconds = Math.max(0, VISIT_EDIT_WINDOW_SECONDS - elapsed);

    return sendSuccess(res, 'Visit fetched', {
      ...visit,
      brands: [],
      categories: [],
      attachments,
      is_editable: isEditable,
      edit_time_remaining_seconds: remainingSeconds,
    });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const updateVisit = async (req, res) => {
  try {
    const [visits] = await sequelize.query(
      `SELECT id, salesperson_id, approval_status, created_at,
              TIMESTAMPDIFF(SECOND, created_at, NOW()) as seconds_since_creation
       FROM visits WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      { replacements: [req.params.id] }
    );
    if (!visits[0]) return sendError(res, 'Visit not found', 404);

    const visit = visits[0];
    if (['super_admin', 'admin', 'management'].includes(req.user.role)) {
      if (visit.salesperson_id !== req.user.id) {
        return sendError(res, 'Admins cannot edit visits submitted by technical executives or ASMs. View only.', 403);
      }
    }
    if (req.user.role === 'sales_executive') {
      if (visit.salesperson_id !== req.user.id) return sendError(res, 'Access denied: not your visit', 403);
    }

    if (visit.approval_status === 'approved') {
      return sendError(res, 'Approved visits cannot be modified', 400);
    }

    // Enforce 5-minute update limit from submission time
    const secDb = Number(visit.seconds_since_creation);
    const secNode = visit.created_at ? Math.max(0, Math.floor((Date.now() - new Date(visit.created_at).getTime()) / 1000)) : 999999;
    const elapsedSeconds = !isNaN(secDb) && secDb >= 0 ? secDb : secNode;

    if (elapsedSeconds > VISIT_EDIT_WINDOW_SECONDS) {
      return sendError(res, 'Visit update window has expired. Visits can only be edited within 5 minutes of submission.', 403);
    }

  const {
    visit_date, visit_time, person_met, designation_met, meeting_type,
    meeting_highlights, remarks, visit_outcome, next_action, next_followup_date,
    brands, categories,
    tank_id, tank_number, water_quality, feeding_details, medication_details, harvest_details, disease_details,
  } = req.body;

    if (meeting_type === 'harvest_details' && harvest_details !== undefined) {
      const hd = harvest_details || {};
      const partials = Array.isArray(hd.partial_harvests) ? hd.partial_harvests : [];
      const finalH = hd.final_harvest || {};
      const hasFinalData = Object.values(finalH).some(val => val !== null && val !== undefined && String(val).trim() !== '');
      if (partials.length === 0 && !hasFinalData) {
        return sendError(res, 'Harvest details are required. Please provide harvest details with Count.', 400);
      }
      for (let i = 0; i < partials.length; i++) {
        if (partials[i].count === undefined || partials[i].count === null || String(partials[i].count).trim() === '') {
          return sendError(res, `Count is mandatory for Partial Harvest #${i + 1}`, 400);
        }
      }
      if (hasFinalData || partials.length === 0) {
        if (finalH.count === undefined || finalH.count === null || String(finalH.count).trim() === '') {
          return sendError(res, 'Count is mandatory for Final Harvest', 400);
        }
      }
    } else if (harvest_details) {
      const hd = harvest_details;
      const partials = Array.isArray(hd.partial_harvests) ? hd.partial_harvests : [];
      const finalH = hd.final_harvest || {};
      const hasFinalData = Object.values(finalH).some(val => val !== null && val !== undefined && String(val).trim() !== '');
      for (let i = 0; i < partials.length; i++) {
        if (partials[i].count === undefined || partials[i].count === null || String(partials[i].count).trim() === '') {
          return sendError(res, `Count is mandatory for Partial Harvest #${i + 1}`, 400);
        }
      }
      if (hasFinalData) {
        if (finalH.count === undefined || finalH.count === null || String(finalH.count).trim() === '') {
          return sendError(res, 'Count is mandatory for Final Harvest', 400);
        }
      }
    }

    const cols = await getVisitCols();
    const hasDisease = cols.has('disease_details');
    const jsonWaterQuality = water_quality !== undefined ? (water_quality ? JSON.stringify(water_quality) : null) : undefined;
    const jsonFeeding = feeding_details !== undefined ? (feeding_details ? JSON.stringify(feeding_details) : null) : undefined;
    const jsonMedication = medication_details !== undefined ? (medication_details ? JSON.stringify(medication_details) : null) : undefined;
    const jsonHarvest = harvest_details !== undefined ? (harvest_details ? JSON.stringify(harvest_details) : null) : undefined;
    const jsonDisease = disease_details !== undefined ? (disease_details ? JSON.stringify(disease_details) : null) : undefined;

    const t = await sequelize.transaction();
    try {
      const setParts = [
        'visit_date=?', 'visit_time=?', 'person_met=?', 'designation_met=?',
        'meeting_type=?', 'meeting_highlights=?', 'remarks=?', 'visit_outcome=?', 'next_action=?',
        'next_followup_date=?',
        'tank_id = COALESCE(?, tank_id)',
        'tank_number = COALESCE(?, tank_number)',
        'water_quality = CASE WHEN ? IS NOT NULL THEN ? ELSE water_quality END',
        'feeding_details = CASE WHEN ? IS NOT NULL THEN ? ELSE feeding_details END',
        'medication_details = CASE WHEN ? IS NOT NULL THEN ? ELSE medication_details END',
        'harvest_details = CASE WHEN ? IS NOT NULL THEN ? ELSE harvest_details END',
      ];
      const replacements = [
        visit_date || null,
        visit_time || null,
        person_met || null,
        designation_met || null,
        meeting_type || null,
        meeting_highlights || null,
        remarks || null,
        visit_outcome || null,
        next_action || null,
        next_followup_date || null,
        tank_id || null,
        tank_number || null,
        jsonWaterQuality !== undefined ? 1 : null, jsonWaterQuality || null,
        jsonFeeding !== undefined ? 1 : null, jsonFeeding || null,
        jsonMedication !== undefined ? 1 : null, jsonMedication || null,
        jsonHarvest !== undefined ? 1 : null, jsonHarvest || null,
      ];
      if (hasDisease) {
        setParts.push('disease_details = CASE WHEN ? IS NOT NULL THEN ? ELSE disease_details END');
        replacements.push(jsonDisease !== undefined ? 1 : null, jsonDisease || null);
      }
      setParts.push('updated_at=NOW()');
      replacements.push(req.params.id);

      await sequelize.query(
        `UPDATE visits SET ${setParts.join(', ')} WHERE id=?`,
        { replacements, transaction: t }
      );

      await t.commit();
    } catch (updateErr) {
      await t.rollback();
      throw updateErr;
    }

    await log({ action: 'VISIT_UPDATED', module: 'visits', recordId: req.params.id, performedBy: req.user.id, req });
    return sendSuccess(res, 'Visit updated');
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const approveVisit = async (req, res) => {
  const { status, rejection_reason } = req.body;
  if (!['approved', 'rejected'].includes(status)) return sendError(res, 'Invalid status');
  if (status === 'rejected' && !rejection_reason) return sendError(res, 'Rejection reason required');

  try {
    await sequelize.query(
      `UPDATE visits SET approval_status=?, approved_by=?, approved_at=NOW(), rejection_reason=? WHERE id=?`,
      { replacements: [status, req.user.id, rejection_reason || null, req.params.id] }
    );
    await log({ action: `VISIT_${status.toUpperCase()}`, module: 'visits', recordId: req.params.id, performedBy: req.user.id, req });
    return sendSuccess(res, `Visit ${status} successfully`);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const uploadAttachment = async (req, res) => {
  if (!req.file) return sendError(res, 'No file uploaded');
  try {
    const [visits] = await sequelize.query(
      `SELECT id, salesperson_id, approval_status, created_at,
              TIMESTAMPDIFF(SECOND, created_at, NOW()) as seconds_since_creation
       FROM visits WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      { replacements: [req.params.id] }
    );
    if (!visits[0]) return sendError(res, 'Visit not found', 404);
    const visit = visits[0];
    if (req.user.role === 'sales_executive' && visit.salesperson_id !== req.user.id) {
      return sendError(res, 'Access denied: not your visit', 403);
    }
    if (visit.approval_status === 'approved') {
      return sendError(res, 'Approved visits cannot be modified', 400);
    }
    const secDb = Number(visit.seconds_since_creation);
    const secNode = visit.created_at ? Math.max(0, Math.floor((Date.now() - new Date(visit.created_at).getTime()) / 1000)) : 999999;
    const elapsedSeconds = !isNaN(secDb) && secDb >= 0 ? secDb : secNode;
    if (elapsedSeconds > VISIT_EDIT_WINDOW_SECONDS) {
      return sendError(res, 'Attachments can only be uploaded within 5 minutes of visit submission', 403);
    }

    await sequelize.query(
      `INSERT INTO visit_attachments (visit_id, file_name, original_name, file_type, file_size, file_path, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      {
        replacements: [req.params.id, req.file.filename, req.file.originalname, req.file.mimetype,
          req.file.size, req.file.path, req.user.id],
      }
    );
    return sendSuccess(res, 'File uploaded', { filename: req.file.originalname }, 201);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const exportVisits = async (req, res) => {
  const { where, replacements } = buildVisitWhere(req.query, req.user.id, req.user.role);
  try {
    const [visits] = await sequelize.query(
      `SELECT v.visit_date, v.visit_time, sp.full_name as salesperson, c.company_name, c.city,
              v.meeting_type, v.person_met, v.visit_outcome, v.approval_status, v.next_followup_date
       FROM visits v
       JOIN clients c ON v.client_id = c.id
       JOIN users sp ON v.salesperson_id = sp.id
       WHERE ${where} ORDER BY v.visit_date DESC`,
      { replacements }
    );

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Visits');
    ws.addRow(['Date', 'Time', 'Technical Executive', 'Farmer', 'City', 'Type', 'Person Met', 'Outcome', 'Status', 'Next Followup']);
    visits.forEach(v => ws.addRow(Object.values(v)));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=visits.xlsx');
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};


const getVisitFilters = async (req, res) => {
  try {
    // 1. Fetch ASMs (users with role 'sales_manager' and status 'active')
    const [asms] = await sequelize.query(`
      SELECT u.id, u.full_name as name, u.region, u.area
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE r.name = 'sales_manager' AND u.deleted_at IS NULL AND u.status = 'active'
      ORDER BY u.full_name ASC
    `);

    // 2. Fetch Techs (users with role 'sales_executive' and status 'active')
    const [techs] = await sequelize.query(`
      SELECT u.id, u.full_name as name, u.manager_id, u.region, u.area,
             m.region as manager_region, m.full_name as manager_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN users m ON u.manager_id = m.id
      WHERE r.name = 'sales_executive' AND u.deleted_at IS NULL AND u.status = 'active'
      ORDER BY u.full_name ASC
    `);

    // 3. Fetch Farmers (assigned to active personnel)
    const [farmers] = await sequelize.query(`
      SELECT c.id, c.company_name as name, c.contact_person,
             c.assigned_salesperson_id, c.assigned_manager_id,
             c.village, c.city, c.district, c.state,
             sp.manager_id as sp_manager_id,
             COALESCE(m.region, sp_m.region, sp.region, c.district, c.city) as region
      FROM clients c
      LEFT JOIN users sp ON c.assigned_salesperson_id = sp.id
      LEFT JOIN users m ON c.assigned_manager_id = m.id
      LEFT JOIN users sp_m ON sp.manager_id = sp_m.id
      WHERE c.deleted_at IS NULL
        AND (c.assigned_salesperson_id IS NULL OR c.assigned_salesperson_id IN (SELECT id FROM users WHERE status = 'active' AND deleted_at IS NULL))
      ORDER BY c.company_name ASC
    `);

    // 4. Derive distinct regions from ASMs, Techs, and Farmers
    const regionMap = new Map();
    const addRegion = (reg) => {
      if (!reg || !String(reg).trim()) return;
      const clean = String(reg).trim();
      const lower = clean.toLowerCase();
      if (!regionMap.has(lower)) {
        const formatted = clean.charAt(0).toUpperCase() + clean.slice(1);
        regionMap.set(lower, formatted);
      }
    };

    asms.forEach(a => addRegion(a.region));
    techs.forEach(t => { addRegion(t.region); addRegion(t.manager_region); });
    farmers.forEach(f => { addRegion(f.region); });

    const regions = Array.from(regionMap.values()).sort((a, b) => a.localeCompare(b));

    const normalizedTechs = techs.map(t => {
      const reg = t.region || t.manager_region || '';
      return {
        id: t.id,
        name: t.name,
        manager_id: t.manager_id,
        region: reg ? (reg.charAt(0).toUpperCase() + reg.slice(1)) : '',
      };
    });

    const normalizedAsms = asms.map(a => {
      const reg = a.region || '';
      return {
        id: a.id,
        name: a.name,
        region: reg ? (reg.charAt(0).toUpperCase() + reg.slice(1)) : '',
      };
    });

    const normalizedFarmers = farmers.map(f => {
      const reg = f.region || '';
      return {
        id: f.id,
        name: f.name || f.contact_person || `Farmer #${f.id}`,
        assigned_salesperson_id: f.assigned_salesperson_id,
        assigned_manager_id: f.assigned_manager_id || f.sp_manager_id,
        region: reg ? (reg.charAt(0).toUpperCase() + reg.slice(1)) : '',
      };
    });

    return sendSuccess(res, 'Visit filter options fetched', {
      regions,
      asms: normalizedAsms,
      techs: normalizedTechs,
      farmers: normalizedFarmers,
    });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

module.exports = {
  getVisitFilters, listVisits, createVisit, getVisit, updateVisit, approveVisit, uploadAttachment, exportVisits };
