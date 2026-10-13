const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { sendSuccess, sendError } = require('../utils/response');
const { billingUpload } = require('../config/multer');
const { v4: uuidv4 } = require('uuid');
const { log } = require('../utils/audit');
const sequelize = require('../config/database');
const ExcelJS = require('exceljs');

const opsRoles = ['super_admin', 'admin', 'backend_ops'];

router.get('/imports', authenticate, authorize(...opsRoles), async (req, res) => {
  try {
    const [imports] = await sequelize.query(
      `SELECT bi.*, u.full_name as imported_by_name FROM billing_imports bi LEFT JOIN users u ON bi.imported_by=u.id ORDER BY bi.created_at DESC LIMIT 50`
    );
    return sendSuccess(res, 'Import history', imports);
  } catch (err) { return sendError(res, err.message, 500); }
});

router.post('/import', authenticate, authorize(...opsRoles), billingUpload.single('file'), async (req, res) => {
  if (!req.file) return sendError(res, 'File required');

  try {
    const uuid = uuidv4();
    const [result] = await sequelize.query(
      'INSERT INTO billing_imports (uuid, file_name, original_name, file_path, status, imported_by) VALUES (?, ?, ?, ?, ?, ?)',
      { replacements: [uuid, req.file.filename, req.file.originalname, req.file.path, 'pending', req.user.id] }
    );
    const importId = result.insertId;

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(req.file.path);
    const ws = wb.worksheets[0];
    const rows = [];

    ws.eachRow((row, rowNum) => {
      if (rowNum === 1) return; // skip header
      const [, invoice_number, invoice_date, client_name, client_code, salesperson_name, brand_name, category_name, invoice_amount, paid_amount, outstanding_amount, due_date] = row.values;
      if (invoice_number) {
        rows.push([importId, String(invoice_number), invoice_date || null, client_name || null, client_code || null, salesperson_name || null, brand_name || null, category_name || null, parseFloat(invoice_amount) || 0, parseFloat(paid_amount) || 0, parseFloat(outstanding_amount) || 0, due_date || null]);
      }
    });

    let imported = 0, failed = 0, unmatched = 0;
    for (const row of rows) {
      try {
        const [existing] = await sequelize.query('SELECT id FROM billing_records WHERE import_id=? AND invoice_number=? LIMIT 1', { replacements: [importId, row[1]] });
        if (existing[0]) { failed++; continue; }

        const [clients] = await sequelize.query('SELECT id FROM clients WHERE company_name LIKE ? OR (? IS NOT NULL AND company_name LIKE ?) LIMIT 1', { replacements: [`%${row[2]}%`, row[3], `%${row[3]}%`] });
        const clientId = clients[0]?.id || null;
        if (!clientId) unmatched++;

        await sequelize.query(
          `INSERT INTO billing_records (import_id, invoice_number, invoice_date, client_name, client_code, client_id, salesperson_name, brand_name, category_name, invoice_amount, paid_amount, outstanding_amount, due_date, is_matched) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          { replacements: [...row, clientId ? 1 : 0] }
        );
        imported++;
      } catch { failed++; }
    }

    await sequelize.query(
      'UPDATE billing_imports SET status=?, total_records=?, imported_records=?, failed_records=?, unmatched_records=? WHERE id=?',
      { replacements: ['completed', rows.length, imported, failed, unmatched, importId] }
    );

    await log({ action: 'BILLING_IMPORTED', module: 'billing', recordId: importId, performedBy: req.user.id, req });
    return sendSuccess(res, 'Import complete', { importId, total: rows.length, imported, failed, unmatched });
  } catch (err) { return sendError(res, err.message, 500); }
});

router.get('/unmatched', authenticate, authorize(...opsRoles), async (req, res) => {
  try {
    const [records] = await sequelize.query(
      'SELECT id, invoice_number, invoice_date, client_name, client_code, invoice_amount FROM billing_records WHERE is_matched=0 ORDER BY invoice_date DESC LIMIT 100'
    );
    return sendSuccess(res, 'Unmatched billing records', records);
  } catch (err) { return sendError(res, err.message, 500); }
});

router.patch('/records/:id/map', authenticate, authorize(...opsRoles), async (req, res) => {
  const { client_id, salesperson_id } = req.body;
  try {
    await sequelize.query(
      'UPDATE billing_records SET client_id=?, salesperson_id=?, is_matched=1, match_notes=? WHERE id=?',
      { replacements: [client_id, salesperson_id || null, 'Manually mapped', req.params.id] }
    );
    return sendSuccess(res, 'Record mapped successfully');
  } catch (err) { return sendError(res, err.message, 500); }
});

module.exports = router;
