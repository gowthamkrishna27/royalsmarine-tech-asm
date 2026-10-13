const router = require('express').Router();
const { listFollowups, createFollowup, updateFollowup, completeFollowup, getTodayFollowups, getOverdueFollowups } = require('../controllers/followupController');
const { authenticate } = require('../middleware/auth');

router.get('/today', authenticate, getTodayFollowups);
router.get('/overdue', authenticate, getOverdueFollowups);
router.get('/', authenticate, listFollowups);
router.post('/', authenticate, createFollowup);
router.put('/:id', authenticate, updateFollowup);
router.patch('/:id/complete', authenticate, completeFollowup);

module.exports = router;
