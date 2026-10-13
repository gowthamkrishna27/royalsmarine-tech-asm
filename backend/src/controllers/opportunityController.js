const { v4: uuidv4 } = require('uuid');
const ExcelJS = require('exceljs');
const sequelize = require('../config/database');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const { getPagination, buildMeta } = require('../utils/pagination');
const { log } = require('../utils/audit');

const STAGES = ['identification','qualified','evaluation','quotation_sent','negotiation','finalization','won','lost'];
const STAGE_PROBABILITY = { identification: 10, qualified: 25, evaluation: 40, quotation_sent: 55, negotiation: 70, finalization: 85, won: 100, lost: 0 };

const buildWhere = (query, userId, role) => {
  let where = 'o.deleted_at IS NULL';
  const replacements = [];

  if (role === 'sales_executive') {
    where += ' AND o.assigned_salesperson_id = ?'; replacements.push(userId);
  } else if (role === 'sales_manager') {
    where += ' AND (o.assigned_manager_id = ? OR o.assigned_salesperson_id IN (SELECT id FROM users WHERE manager_id = ?))';
    replacements.push(userId, userId);
  }

  if (query.stage) { where += ' AND o.current_stage = ?'; replacements.push(query.stage); }
  if (query.brand_id) { where += ' AND o.brand_id = ?'; replacements.push(query.brand_id); }
  if (query.salesperson_id) { where += ' AND o.assigned_salesperson_id = ?'; replacements.push(query.salesperson_id); }
  if (query.client_id) { where += ' AND o.client_id = ?'; replacements.push(query.client_id); }
  if (query.from_date) { where += ' AND o.expected_closing_date >= ?'; replacements.push(query.from_date); }
  if (query.to_date) { where += ' AND o.expected_closing_date <= ?'; replacements.push(query.to_date); }

  return { where, replacements };
};

const listOpportunities = async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const { where, replacements } = buildWhere(req.query, req.user.id, req.user.role);

  try {
    const [[{ total }]] = await sequelize.query(`SELECT COUNT(*) as total FROM opportunities o WHERE ${where}`, { replacements });

    const [opps] = await sequelize.query(
      `SELECT o.id, o.uuid, o.title, o.current_stage, o.estimated_value, o.probability,
              o.expected_closing_date, o.created_at,
              c.company_name, b.name as brand_name,
              sp.full_name as salesperson_name
       FROM opportunities o
       JOIN clients c ON o.client_id = c.id
       LEFT JOIN brands b ON o.brand_id = b.id
       JOIN users sp ON o.assigned_salesperson_id = sp.id
       WHERE ${where}
       ORDER BY o.expected_closing_date ASC LIMIT ? OFFSET ?`,
      { replacements: [...replacements, limit, offset] }
    );

    return sendPaginated(res, 'Opportunities fetched', opps, buildMeta(total, page, limit));
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const createOpportunity = async (req, res) => {
  const {
    title, client_id, assigned_salesperson_id, assigned_manager_id,
    brand_id, category_id, product_id, estimated_value, expected_closing_date,
    current_stage, requirement_details, competitor_info, next_followup_date, remarks,
  } = req.body;

  const t = await sequelize.transaction();
  try {
    const uuid = uuidv4();
    const stage = current_stage || 'identification';
    const probability = STAGE_PROBABILITY[stage] || 10;
    const salespersonId = req.user.role === 'sales_executive' ? req.user.id : (assigned_salesperson_id || req.user.id);

    const [result] = await sequelize.query(
      `INSERT INTO opportunities (uuid, title, client_id, assigned_salesperson_id, assigned_manager_id,
       brand_id, category_id, product_id, estimated_value, expected_closing_date, current_stage,
       probability, requirement_details, competitor_info, next_followup_date, remarks, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      {
        replacements: [
          uuid, title, client_id, salespersonId, assigned_manager_id || null,
          brand_id || null, category_id || null, product_id || null,
          estimated_value || null, expected_closing_date || null,
          stage, probability, requirement_details || null,
          competitor_info || null, next_followup_date || null, remarks || null, req.user.id,
        ],
        transaction: t,
      }
    );

    const oppId = typeof result === 'number' ? result : (result?.insertId || result);

    await sequelize.query(
      'INSERT INTO opportunity_stage_history (opportunity_id, from_stage, to_stage, changed_by) VALUES (?, NULL, ?, ?)',
      {
        replacements: [oppId, stage, req.user.id],
        transaction: t,
      }
    );

    await t.commit();

    await log({ action: 'OPP_CREATED', module: 'opportunities', recordId: oppId, performedBy: req.user.id, req });
    return sendSuccess(res, 'Opportunity created', { id: oppId, uuid }, 201);
  } catch (err) {
    await t.rollback();
    return sendError(res, err.message, 500);
  }
};

const getOpportunity = async (req, res) => {
  try {
    const [opps] = await sequelize.query(
      `SELECT o.*, c.company_name, c.mobile as client_mobile, c.city,
              b.name as brand_name, cat.name as category_name,
              sp.full_name as salesperson_name, m.full_name as manager_name
       FROM opportunities o
       JOIN clients c ON o.client_id = c.id
       LEFT JOIN brands b ON o.brand_id = b.id
       LEFT JOIN categories cat ON o.category_id = cat.id
       JOIN users sp ON o.assigned_salesperson_id = sp.id
       LEFT JOIN users m ON o.assigned_manager_id = m.id
       WHERE o.id = ? AND o.deleted_at IS NULL LIMIT 1`,
      { replacements: [req.params.id] }
    );
    if (!opps[0]) return sendError(res, 'Opportunity not found', 404);

    const opp = opps[0];

    // Data isolation
    if (req.user.role === 'sales_executive' && opp.assigned_salesperson_id !== req.user.id) {
      return sendError(res, 'Access denied: not your opportunity', 403);
    }
    if (req.user.role === 'sales_manager') {
      const isSelf = opp.assigned_salesperson_id === req.user.id || opp.assigned_manager_id === req.user.id;
      if (!isSelf) {
        const [managed] = await sequelize.query(
          'SELECT id FROM users WHERE id = ? AND manager_id = ? LIMIT 1',
          { replacements: [opp.assigned_salesperson_id, req.user.id] }
        );
        if (!managed.length) return sendError(res, 'Access denied: opportunity outside your territory', 403);
      }
    }

    const [stageHistory] = await sequelize.query(
      `SELECT osh.*, u.full_name as changed_by_name FROM opportunity_stage_history osh
       LEFT JOIN users u ON osh.changed_by = u.id WHERE osh.opportunity_id = ? ORDER BY osh.changed_at ASC`,
      { replacements: [req.params.id] }
    );
    const [comments] = await sequelize.query(
      `SELECT oc.*, u.full_name as author FROM opportunity_comments oc
       LEFT JOIN users u ON oc.created_by = u.id WHERE oc.opportunity_id = ? ORDER BY oc.created_at ASC`,
      { replacements: [req.params.id] }
    );

    return sendSuccess(res, 'Opportunity fetched', { ...opp, stageHistory, comments });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const updateOpportunity = async (req, res) => {
  try {
    const [opps] = await sequelize.query(
      'SELECT id, assigned_salesperson_id FROM opportunities WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      { replacements: [req.params.id] }
    );
    if (!opps[0]) return sendError(res, 'Opportunity not found', 404);

    if (req.user.role === 'sales_executive' && opps[0].assigned_salesperson_id !== req.user.id) {
      return sendError(res, 'Access denied: not your opportunity', 403);
    }

    const {
      title, brand_id, category_id, product_id, estimated_value,
      expected_closing_date, requirement_details, competitor_info,
      next_followup_date, remarks,
    } = req.body;

    await sequelize.query(
      `UPDATE opportunities SET title=?, brand_id=?, category_id=?, product_id=?, estimated_value=?,
       expected_closing_date=?, requirement_details=?, competitor_info=?, next_followup_date=?,
       remarks=?, updated_at=NOW() WHERE id=?`,
      {
        replacements: [title, brand_id || null, category_id || null, product_id || null,
          estimated_value || null, expected_closing_date || null, requirement_details || null,
          competitor_info || null, next_followup_date || null, remarks || null, req.params.id],
      }
    );
    await log({ action: 'OPP_UPDATED', module: 'opportunities', recordId: req.params.id, performedBy: req.user.id, req });
    return sendSuccess(res, 'Opportunity updated');
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const changeStage = async (req, res) => {
  const { stage, remarks, lost_reason, won_value, won_date, po_reference } = req.body;
  if (!STAGES.includes(stage)) return sendError(res, 'Invalid stage');
  if (stage === 'lost' && !lost_reason) return sendError(res, 'Lost reason required');

  const t = await sequelize.transaction();
  try {
    const [opps] = await sequelize.query(
      'SELECT current_stage, assigned_salesperson_id FROM opportunities WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      { replacements: [req.params.id], transaction: t }
    );
    if (!opps[0]) {
      await t.rollback();
      return sendError(res, 'Opportunity not found', 404);
    }

    if (req.user.role === 'sales_executive' && opps[0].assigned_salesperson_id !== req.user.id) {
      await t.rollback();
      return sendError(res, 'Access denied: not your opportunity', 403);
    }

    const fromStage = opps[0].current_stage;
    await sequelize.query(
      `UPDATE opportunities SET current_stage=?, probability=?, lost_reason=?, won_value=?, won_date=?,
       po_reference=?, updated_at=NOW() WHERE id=?`,
      {
        replacements: [stage, STAGE_PROBABILITY[stage], lost_reason || null,
          won_value || null, won_date || null, po_reference || null, req.params.id],
        transaction: t,
      }
    );

    await sequelize.query(
      'INSERT INTO opportunity_stage_history (opportunity_id, from_stage, to_stage, changed_by, remarks) VALUES (?, ?, ?, ?, ?)',
      {
        replacements: [req.params.id, fromStage, stage, req.user.id, remarks || null],
        transaction: t,
      }
    );

    await t.commit();

    await log({ action: 'OPP_STAGE_CHANGED', module: 'opportunities', recordId: req.params.id, oldValue: { stage: fromStage }, newValue: { stage }, performedBy: req.user.id, req });
    return sendSuccess(res, `Stage changed to ${stage}`);
  } catch (err) {
    await t.rollback();
    return sendError(res, err.message, 500);
  }
};

const addComment = async (req, res) => {
  const { comment } = req.body;
  if (!comment) return sendError(res, 'Comment required');
  try {
    const [opps] = await sequelize.query(
      'SELECT id, assigned_salesperson_id FROM opportunities WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      { replacements: [req.params.id] }
    );
    if (!opps[0]) return sendError(res, 'Opportunity not found', 404);

    if (req.user.role === 'sales_executive' && opps[0].assigned_salesperson_id !== req.user.id) {
      return sendError(res, 'Access denied: not your opportunity', 403);
    }

    await sequelize.query(
      'INSERT INTO opportunity_comments (opportunity_id, comment, created_by) VALUES (?, ?, ?)',
      { replacements: [req.params.id, comment, req.user.id] }
    );
    return sendSuccess(res, 'Comment added', null, 201);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const getPipeline = async (req, res) => {
  const { where, replacements } = buildWhere(req.query, req.user.id, req.user.role);
  try {
    const [pipeline] = await sequelize.query(
      `SELECT o.current_stage, COUNT(*) as count, COALESCE(SUM(o.estimated_value), 0) as total_value
       FROM opportunities o WHERE ${where} AND o.current_stage NOT IN ('won','lost')
       GROUP BY o.current_stage`,
      { replacements }
    );
    const [brandPipeline] = await sequelize.query(
      `SELECT b.name as brand, o.current_stage, COUNT(*) as count, COALESCE(SUM(o.estimated_value), 0) as value
       FROM opportunities o LEFT JOIN brands b ON o.brand_id = b.id
       WHERE ${where} AND o.current_stage NOT IN ('won','lost')
       GROUP BY b.name, o.current_stage`,
      { replacements }
    );
    return sendSuccess(res, 'Pipeline fetched', { pipeline, brandPipeline });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

module.exports = { listOpportunities, createOpportunity, getOpportunity, updateOpportunity, changeStage, addComment, getPipeline };
