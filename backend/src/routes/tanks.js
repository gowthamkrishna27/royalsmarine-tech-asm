const router = require('express').Router();
const { listAllTanks } = require('../controllers/tankController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, listAllTanks);

module.exports = router;
