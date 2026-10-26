const router = require('express').Router();
const { listFollowups, createFollowup, updateFollowup, completeFollowup, getTodayFollowups, getOverdueFollowups } = require('../controllers/followupController');
const { authenticate, authorize } = require('../middleware/auth');

const createRoles = ['super_admin', 'admin', 'sales_manager', 'sales_executive'];

router.get('/today', authenticate, getTodayFollowups);
router.get('/overdue', authenticate, getOverdueFollowups);
router.get('/', authenticate, listFollowups);
router.post('/', authenticate, authorize(...createRoles), createFollowup);
router.put('/:id', authenticate, updateFollowup);
router.patch('/:id/complete', authenticate, completeFollowup);

module.exports = router;
