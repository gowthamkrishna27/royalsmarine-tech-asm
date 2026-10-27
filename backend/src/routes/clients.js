const router = require('express').Router();
const {
  listClients, createClient, getClient, updateClient, getClientProfile, exportClients, importClients,
  listPonds, createPond, updatePond, deletePond, getMapLocations, listHarvestedTanks,
} = require('../controllers/clientController');
const { authenticate, authorize } = require('../middleware/auth');
const multer = require('multer');

const noViewer = ['super_admin', 'admin', 'sales_manager', 'sales_executive', 'backend_ops'];
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/export', authenticate, exportClients);
router.get('/map-locations', authenticate, getMapLocations);
router.get('/harvested-tanks', authenticate, listHarvestedTanks);
router.post('/import', authenticate, authorize('super_admin', 'admin', 'sales_manager'), upload.single('file'), importClients);
router.get('/', authenticate, listClients);
router.post('/', authenticate, authorize(...noViewer), createClient);
router.get('/:id', authenticate, getClient);
router.get('/:id/profile', authenticate, getClientProfile);
router.put('/:id', authenticate, authorize(...noViewer), updateClient);

// Pond routes
router.get('/:id/ponds', authenticate, listPonds);
router.post('/:id/ponds', authenticate, authorize(...noViewer), createPond);
router.put('/:id/ponds/:pondId', authenticate, authorize(...noViewer), updatePond);
router.delete('/:id/ponds/:pondId', authenticate, authorize(...noViewer), deletePond);

module.exports = router;
