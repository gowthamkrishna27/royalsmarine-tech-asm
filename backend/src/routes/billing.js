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
  return sendSuccess(res, 'Import history', []);
});

router.post('/import', authenticate, authorize(...opsRoles), async (req, res) => {
  return sendSuccess(res, 'Import complete', { importId: 0, total: 0, imported: 0, failed: 0, unmatched: 0 });
});

router.get('/unmatched', authenticate, authorize(...opsRoles), async (req, res) => {
  return sendSuccess(res, 'Unmatched billing records', []);
});

router.patch('/records/:id/map', authenticate, authorize(...opsRoles), async (req, res) => {
  return sendSuccess(res, 'Record mapped successfully');
});

module.exports = router;
