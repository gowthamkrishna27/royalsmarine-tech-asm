const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { sendPaginated } = require('../utils/response');
const { getPagination, buildMeta } = require('../utils/pagination');
const sequelize = require('../config/database');

router.get('/', authenticate, authorize('super_admin', 'admin'), async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const { module, from_date, to_date } = req.query;
  let where = '1=1';
  const replacements = [];
  if (module) { where += ' AND a.module=?'; replacements.push(module); }
  if (from_date) { where += ' AND a.created_at>=?'; replacements.push(from_date); }
  if (to_date) { where += ' AND a.created_at<=?'; replacements.push(to_date); }

  const [[{ total }]] = await sequelize.query(`SELECT COUNT(*) as total FROM audit_logs a WHERE ${where}`, { replacements });
  const [logs] = await sequelize.query(
    `SELECT a.*, u.full_name as performed_by_name FROM audit_logs a LEFT JOIN users u ON a.performed_by=u.id WHERE ${where} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
    { replacements: [...replacements, limit, offset] }
  );
  return sendPaginated(res, 'Audit logs', logs, buildMeta(total, page, limit));
});

module.exports = router;
