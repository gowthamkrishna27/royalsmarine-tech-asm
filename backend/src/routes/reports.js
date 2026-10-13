const router = require('express').Router();
const { salespersonVisitReport, opportunityReport, followupReport, billingReport, exportReport, brandReport, momReport, productMovementReport } = require('../controllers/reportController');
const { authenticate, authorize } = require('../middleware/auth');

const viewRoles = ['super_admin', 'admin', 'sales_manager', 'management'];

router.get('/visits', authenticate, authorize(...viewRoles), salespersonVisitReport);
router.get('/opportunities', authenticate, authorize(...viewRoles), opportunityReport);
router.get('/followups', authenticate, authorize(...viewRoles), followupReport);
router.get('/billing', authenticate, authorize(...viewRoles), billingReport);
router.get('/brand', authenticate, authorize(...viewRoles), brandReport);
router.get('/mom', authenticate, authorize(...viewRoles), momReport);
router.get('/products', authenticate, authorize(...viewRoles), productMovementReport);
router.get('/export', authenticate, exportReport);

module.exports = router;
