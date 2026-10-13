const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { sendSuccess, sendError } = require('../utils/response');
const sequelize = require('../config/database');

router.get('/', authenticate, async (req, res) => {
  try {
    const [notifications] = await sequelize.query(
      'SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50',
      { replacements: [req.user.id] }
    );
    return sendSuccess(res, 'Notifications fetched', notifications);
  } catch (err) { return sendError(res, err.message, 500); }
});

router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    await sequelize.query('UPDATE notifications SET is_read=1, read_at=NOW() WHERE id=? AND user_id=?', { replacements: [req.params.id, req.user.id] });
    return sendSuccess(res, 'Marked as read');
  } catch (err) { return sendError(res, err.message, 500); }
});

router.patch('/read-all', authenticate, async (req, res) => {
  try {
    await sequelize.query('UPDATE notifications SET is_read=1, read_at=NOW() WHERE user_id=?', { replacements: [req.user.id] });
    return sendSuccess(res, 'All marked as read');
  } catch (err) { return sendError(res, err.message, 500); }
});

module.exports = router;
