const router = require('express').Router();
const { getSettings, updateSettings } = require('../controllers/settingsController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, authorize('super_admin', 'admin'), getSettings);
router.put('/', authenticate, authorize('super_admin', 'admin'), updateSettings);

module.exports = router;
