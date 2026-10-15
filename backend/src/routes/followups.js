const router = require('express').Router();
const {
  listFollowups,
  createFollowup,
  updateFollowup,
  completeFollowup,
  getTodayFollowups,
  getOverdueFollowups,
  listTestFollowups,
  completeTestFollowup,
} = require('../controllers/followupController');
const { authenticate } = require('../middleware/auth');

router.get('/today', authenticate, getTodayFollowups);
router.get('/overdue', authenticate, getOverdueFollowups);

// Test Follow-up routes for Agents and ASMs
router.get('/tests', authenticate, listTestFollowups);
router.patch('/tests/:id/complete', authenticate, completeTestFollowup);
router.post('/tests/:id/complete', authenticate, completeTestFollowup);

router.get('/', authenticate, listFollowups);
router.post('/', authenticate, createFollowup);
router.put('/:id', authenticate, updateFollowup);
router.patch('/:id/complete', authenticate, completeFollowup);

module.exports = router;
