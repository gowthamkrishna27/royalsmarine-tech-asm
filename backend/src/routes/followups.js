const router = require('express').Router();
const { listFollowups, createFollowup, updateFollowup, completeFollowup, getTodayFollowups, getOverdueFollowups } = require('../controllers/followupController');
const { authenticate, authorize } = require('../middleware/auth');

const adminRoles = ['super_admin', 'admin'];

router.get('/today', authenticate, getTodayFollowups);
router.get('/overdue', authenticate, getOverdueFollowups);
router.get('/', authenticate, listFollowups);
router.post('/', authenticate, authorize(...adminRoles), createFollowup);
router.put('/:id', authenticate, updateFollowup);
router.patch('/:id/complete', authenticate, completeFollowup);

module.exports = router;
