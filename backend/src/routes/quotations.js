const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const { getPagination, buildMeta } = require('../utils/pagination');
const { quotationUpload } = require('../config/multer');
const { v4: uuidv4 } = require('uuid');
const { log } = require('../utils/audit');
const sequelize = require('../config/database');

router.get('/', authenticate, async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const { status, client_id, brand_id, salesperson_id, from_date, to_date } = req.query;
  let where = 'q.deleted_at IS NULL';
  const replacements = [];

  if (status) { where += ' AND q.status=?'; replacements.push(status); }
  if (client_id) { where += ' AND q.client_id=?'; replacements.push(client_id); }
  if (brand_id) { where += ' AND q.brand_id=?'; replacements.push(brand_id); }
  if (salesperson_id) { where += ' AND q.salesperson_id=?'; replacements.push(salesperson_id); }
  if (from_date) { where += ' AND q.quotation_date>=?'; replacements.push(from_date); }
  if (to_date) { where += ' AND q.quotation_date<=?'; replacements.push(to_date); }

  if (req.user.role === 'sales_executive') { where += ' AND q.salesperson_id=?'; replacements.push(req.user.id); }

  try {
    const [[{ total }]] = await sequelize.query(`SELECT COUNT(*) as total FROM quotations q WHERE ${where}`, { replacements });
    const [quotations] = await sequelize.query(
      `SELECT q.id, q.uuid, q.quotation_number, q.quotation_date, q.quotation_value, q.status,
              c.company_name, b.name as brand_name, sp.full_name as salesperson_name
       FROM quotations q JOIN clients c ON q.client_id=c.id LEFT JOIN brands b ON q.brand_id=b.id JOIN users sp ON q.salesperson_id=sp.id
       WHERE ${where} ORDER BY q.quotation_date DESC LIMIT ? OFFSET ?`,
      { replacements: [...replacements, limit, offset] }
    );
    return sendPaginated(res, 'Quotations fetched', quotations, buildMeta(total, page, limit));
  } catch (err) { return sendError(res, err.message, 500); }
});

router.post('/', authenticate, authorize('super_admin', 'admin', 'backend_ops', 'sales_manager', 'sales_executive'), quotationUpload.single('file'), async (req, res) => {
  const { quotation_number, client_id, opportunity_id, brand_id, category_id, quotation_date, quotation_value, status, customer_feedback, remarks } = req.body;
  try {
    const uuid = uuidv4();
    const [result] = await sequelize.query(
      `INSERT INTO quotations (uuid, quotation_number, client_id, opportunity_id, salesperson_id, brand_id, category_id, quotation_date, quotation_value, status, customer_feedback, remarks, file_name, original_name, file_path, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      { replacements: [uuid, quotation_number, client_id, opportunity_id || null, req.user.id, brand_id || null, category_id || null, quotation_date, quotation_value, status || 'draft', customer_feedback || null, remarks || null, req.file?.filename || null, req.file?.originalname || null, req.file?.path || null, req.user.id] }
    );
    await log({ action: 'QUOTATION_CREATED', module: 'quotations', recordId: result.insertId, performedBy: req.user.id, req });
    return sendSuccess(res, 'Quotation created', { id: result.insertId, uuid }, 201);
  } catch (err) { return sendError(res, err.message, 500); }
});

router.put('/:id', authenticate, async (req, res) => {
  const { status, customer_feedback, remarks, quotation_value } = req.body;
  try {
    const [existing] = await sequelize.query('SELECT id, salesperson_id, status FROM quotations WHERE id = ? AND deleted_at IS NULL LIMIT 1', { replacements: [req.params.id] });
    if (!existing[0]) return sendError(res, 'Quotation not found', 404);

    if (req.user.role === 'sales_executive') {
      if (existing[0].salesperson_id !== req.user.id) return sendError(res, 'Access denied: not your quotation', 403);
    }

    await sequelize.query('UPDATE quotations SET status=?, customer_feedback=?, remarks=?, quotation_value=?, updated_at=NOW() WHERE id=?',
      { replacements: [status || existing[0].status, customer_feedback || null, remarks || null, quotation_value, req.params.id] });
    return sendSuccess(res, 'Quotation updated');
  } catch (err) { return sendError(res, err.message, 500); }
});

module.exports = router;
