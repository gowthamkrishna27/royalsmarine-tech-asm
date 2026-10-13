const router = require('express').Router();
const { listOpportunities, createOpportunity, getOpportunity, updateOpportunity, changeStage, addComment, getPipeline } = require('../controllers/opportunityController');
const { authenticate, authorize } = require('../middleware/auth');

const oppRoles = ['super_admin', 'admin', 'sales_manager', 'management'];

// Strictly block sales_executive completely from opportunities
router.use(authenticate, authorize(...oppRoles));

router.get('/pipeline', getPipeline);
router.get('/', listOpportunities);
router.post('/', createOpportunity);
router.get('/:id', getOpportunity);
router.put('/:id', updateOpportunity);
router.patch('/:id/stage', changeStage);
router.post('/:id/comments', addComment);

module.exports = router;
