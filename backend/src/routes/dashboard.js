const router = require('express').Router();
const { getDashboard, getLiveSubmissions } = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, getDashboard);
router.get('/live-submissions', authenticate, getLiveSubmissions);

module.exports = router;
