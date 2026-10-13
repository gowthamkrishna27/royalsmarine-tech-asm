const { v4: uuidv4 } = require('uuid');
const ExcelJS = require('exceljs');
const sequelize = require('../config/database');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const { getPagination, buildMeta } = require('../utils/pagination');
const { log } = require('../utils/audit');

const buildVisitWhere = (query, userId, role) => {
  let where = 'v.deleted_at IS NULL';
  const replacements = [];

  if (role === 'sales_executive') {
    where += ' AND v.salesperson_id = ?';
    replacements.push(userId);
  } else if (role === 'sales_manager') {
    where += ' AND (v.salesperson_id = ? OR v.salesperson_id IN (SELECT id FROM users WHERE manager_id = ?))';
    replacements.push(userId, userId);
  }

  if (query.salesperson_id) { where += ' AND v.salesperson_id = ?'; replacements.push(query.salesperson_id); }
  if (query.client_id) { where += ' AND v.client_id = ?'; replacements.push(query.client_id); }
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

    return sendPaginated(res, 'Visits fetched', visits, buildMeta(total, page, limit));
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const createVisit = async (req, res) => {
  const {
    visit_date, visit_time, client_id, latitude, longitude, gps_address,
    gps_captured_at, gps_denied_reason, person_met, designation_met,
    meeting_type, meeting_highlights, remarks, visit_outcome, next_action,
    next_followup_date, brands, categories,
    tank_id, tank_number, water_quality, feeding_details, medication_details, harvest_details,
  } = req.body;

  const t = await sequelize.transaction();
  try {
    const uuid = uuidv4();
    const formattedGpsCapturedAt = gps_captured_at ? new Date(gps_captured_at).toISOString().slice(0, 19).replace('T', ' ') : null;

    const jsonWaterQuality = water_quality ? JSON.stringify(water_quality) : null;
    const jsonFeeding = feeding_details ? JSON.stringify(feeding_details) : null;
    const jsonMedication = medication_details ? JSON.stringify(medication_details) : null;
    const jsonHarvest = harvest_details ? JSON.stringify(harvest_details) : null;

    const [insertResult] = await sequelize.query(
      `INSERT INTO visits (uuid, visit_date, visit_time, salesperson_id, client_id, latitude, longitude,
       gps_address, gps_captured_at, gps_denied_reason, person_met, designation_met, meeting_type,
       meeting_highlights, remarks, visit_outcome, next_action, next_followup_date,
       tank_id, tank_number, water_quality, feeding_details, medication_details, harvest_details,
       created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      {
        replacements: [
          uuid, visit_date, visit_time, req.user.id, client_id,
          latitude || null, longitude || null, gps_address || null,
          formattedGpsCapturedAt, gps_denied_reason || null,
          person_met || null, designation_met || null, meeting_type,
          meeting_highlights || null, remarks || null, visit_outcome || null,
          next_action || null, next_followup_date || null,
          tank_id || null, tank_number || null, jsonWaterQuality, jsonFeeding, jsonMedication, jsonHarvest,
          req.user.id,
        ],
        transaction: t,
      }
    );

    const visitId = typeof insertResult === 'number' ? insertResult : (insertResult?.insertId || insertResult);

    for (const brandId of (brands || [])) {
      await sequelize.query('INSERT IGNORE INTO visit_brands (visit_id, brand_id) VALUES (?, ?)', {
        replacements: [visitId, brandId],
        transaction: t,
      });
    }
    for (const catId of (categories || [])) {
      await sequelize.query('INSERT IGNORE INTO visit_categories (visit_id, category_id) VALUES (?, ?)', {
        replacements: [visitId, catId],
        transaction: t,
      });
    }

    // Auto-create follow-up if next_followup_date provided
    if (next_followup_date) {
      await sequelize.query(
        `INSERT INTO followups (uuid, title, client_id, visit_id, assigned_salesperson_id, followup_date, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        {
          replacements: [uuidv4(), `Follow-up after ${meeting_type} visit`, client_id, visitId, req.user.id, next_followup_date, req.user.id],
          transaction: t,
        }
      );
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

    const [brands] = await sequelize.query(
      'SELECT b.id, b.name FROM brands b JOIN visit_brands vb ON b.id = vb.brand_id WHERE vb.visit_id = ?',
      { replacements: [req.params.id] }
    );
    const [cats] = await sequelize.query(
      'SELECT c.id, c.name FROM categories c JOIN visit_categories vc ON c.id = vc.category_id WHERE vc.visit_id = ?',
      { replacements: [req.params.id] }
    );
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

    return sendSuccess(res, 'Visit fetched', { ...visit, brands, categories: cats, attachments });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const updateVisit = async (req, res) => {
  try {
    const [visits] = await sequelize.query(
      "SELECT id, salesperson_id, approval_status FROM visits WHERE id = ? AND deleted_at IS NULL LIMIT 1",
      { replacements: [req.params.id] }
    );
    if (!visits[0]) return sendError(res, 'Visit not found', 404);

    const visit = visits[0];
    if (req.user.role === 'sales_executive') {
      if (visit.salesperson_id !== req.user.id) return sendError(res, 'Access denied: not your visit', 403);
      if (visit.approval_status !== 'pending') return sendError(res, 'Cannot edit approved or rejected visit', 400);
    }

    const {
      visit_date, visit_time, person_met, designation_met, meeting_type,
      meeting_highlights, remarks, visit_outcome, next_action, next_followup_date,
      brands, categories,
      tank_id, tank_number, water_quality, feeding_details, medication_details, harvest_details,
    } = req.body;

    const jsonWaterQuality = water_quality !== undefined ? (water_quality ? JSON.stringify(water_quality) : null) : undefined;
    const jsonFeeding = feeding_details !== undefined ? (feeding_details ? JSON.stringify(feeding_details) : null) : undefined;
    const jsonMedication = medication_details !== undefined ? (medication_details ? JSON.stringify(medication_details) : null) : undefined;
    const jsonHarvest = harvest_details !== undefined ? (harvest_details ? JSON.stringify(harvest_details) : null) : undefined;

    const t = await sequelize.transaction();
    try {
      await sequelize.query(
        `UPDATE visits SET visit_date=?, visit_time=?, person_met=?, designation_met=?,
         meeting_type=?, meeting_highlights=?, remarks=?, visit_outcome=?, next_action=?,
         next_followup_date=?,
         tank_id = COALESCE(?, tank_id),
         tank_number = COALESCE(?, tank_number),
         water_quality = CASE WHEN ? IS NOT NULL THEN ? ELSE water_quality END,
         feeding_details = CASE WHEN ? IS NOT NULL THEN ? ELSE feeding_details END,
         medication_details = CASE WHEN ? IS NOT NULL THEN ? ELSE medication_details END,
         harvest_details = CASE WHEN ? IS NOT NULL THEN ? ELSE harvest_details END,
         updated_at=NOW() WHERE id=?`,
        {
          replacements: [
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
            req.params.id,
          ],
          transaction: t,
        }
      );

      if (brands && Array.isArray(brands)) {
        await sequelize.query('DELETE FROM visit_brands WHERE visit_id = ?', { replacements: [req.params.id], transaction: t });
        for (const brandId of brands) {
          await sequelize.query('INSERT IGNORE INTO visit_brands (visit_id, brand_id) VALUES (?, ?)', { replacements: [req.params.id, brandId], transaction: t });
        }
      }

      if (categories && Array.isArray(categories)) {
        await sequelize.query('DELETE FROM visit_categories WHERE visit_id = ?', { replacements: [req.params.id], transaction: t });
        for (const catId of categories) {
          await sequelize.query('INSERT IGNORE INTO visit_categories (visit_id, category_id) VALUES (?, ?)', { replacements: [req.params.id, catId], transaction: t });
        }
      }

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
    ws.addRow(['Date', 'Time', 'Salesperson', 'Client', 'City', 'Type', 'Person Met', 'Outcome', 'Status', 'Next Followup']);
    visits.forEach(v => ws.addRow(Object.values(v)));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=visits.xlsx');
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

module.exports = { listVisits, createVisit, getVisit, updateVisit, approveVisit, uploadAttachment, exportVisits };
