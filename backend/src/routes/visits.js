const router = require('express').Router();
const { listVisits, createVisit, getVisit, updateVisit, approveVisit, uploadAttachment, exportVisits } = require('../controllers/visitController');
const { authenticate, authorize } = require('../middleware/auth');
const { visitUpload } = require('../config/multer');

const managerRoles = ['super_admin', 'admin', 'sales_manager'];

router.get('/export', authenticate, exportVisits);
router.get('/', authenticate, listVisits);
router.post('/', authenticate, authorize('super_admin', 'admin', 'sales_manager', 'sales_executive'), createVisit);
router.get('/:id', authenticate, getVisit);
router.put('/:id', authenticate, updateVisit);
router.patch('/:id/approve', authenticate, authorize(...managerRoles), approveVisit);
router.post('/:id/attachments', authenticate, visitUpload.array('files', 5), uploadAttachment);

module.exports = router;
