const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const { getPagination, buildMeta } = require('../utils/pagination');
const { poUpload } = require('../config/multer');
const { v4: uuidv4 } = require('uuid');
const { log } = require('../utils/audit');
const sequelize = require('../config/database');

router.get('/', authenticate, async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const { order_status, client_id, salesperson_id, from_date, to_date } = req.query;
  let where = 'po.deleted_at IS NULL';
  const replacements = [];

  if (order_status) { where += ' AND po.order_status=?'; replacements.push(order_status); }
  if (client_id) { where += ' AND po.client_id=?'; replacements.push(client_id); }
  if (salesperson_id) { where += ' AND po.salesperson_id=?'; replacements.push(salesperson_id); }
  if (from_date) { where += ' AND po.po_date>=?'; replacements.push(from_date); }
  if (to_date) { where += ' AND po.po_date<=?'; replacements.push(to_date); }

  try {
    const [[{ total }]] = await sequelize.query(`SELECT COUNT(*) as total FROM purchase_orders po WHERE ${where}`, { replacements });
    const [pos] = await sequelize.query(
      `SELECT po.id, po.uuid, po.po_number, po.po_date, po.po_value, po.order_status,
              c.company_name, sp.full_name as salesperson_name
       FROM purchase_orders po JOIN clients c ON po.client_id=c.id JOIN users sp ON po.salesperson_id=sp.id
       WHERE ${where} ORDER BY po.po_date DESC LIMIT ? OFFSET ?`,
      { replacements: [...replacements, limit, offset] }
    );
    return sendPaginated(res, 'Purchase orders fetched', pos, buildMeta(total, page, limit));
  } catch (err) { return sendError(res, err.message, 500); }
});

router.post('/', authenticate, authorize('super_admin', 'admin', 'backend_ops', 'sales_manager'), poUpload.single('file'), async (req, res) => {
  const { po_number, po_date, client_id, opportunity_id, quotation_id, brand_id, category_id, po_value, remarks } = req.body;
  try {
    const uuid = uuidv4();
    const [result] = await sequelize.query(
      `INSERT INTO purchase_orders (uuid, po_number, po_date, client_id, salesperson_id, opportunity_id, quotation_id, brand_id, category_id, po_value, remarks, file_name, original_name, file_path, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      { replacements: [uuid, po_number, po_date, client_id, req.user.id, opportunity_id || null, quotation_id || null, brand_id || null, category_id || null, po_value, remarks || null, req.file?.filename || null, req.file?.originalname || null, req.file?.path || null, req.user.id] }
    );
    await log({ action: 'PO_CREATED', module: 'purchase_orders', recordId: result.insertId, performedBy: req.user.id, req });
    return sendSuccess(res, 'Purchase order created', { id: result.insertId, uuid }, 201);
  } catch (err) { return sendError(res, err.message, 500); }
});

router.patch('/:id/status', authenticate, authorize('super_admin', 'admin', 'backend_ops', 'sales_manager'), async (req, res) => {
  const { order_status } = req.body;
  try {
    await sequelize.query('UPDATE purchase_orders SET order_status=?, updated_at=NOW() WHERE id=?', { replacements: [order_status, req.params.id] });
    return sendSuccess(res, 'Status updated');
  } catch (err) { return sendError(res, err.message, 500); }
});

module.exports = router;
