const router = require('express').Router();
const {
  listUsers,
  createUser,
  getUser,
  updateUser,
  deleteUser,
  resetUserPassword,
  getRoles,
  downloadUserTemplate,
  importUsers,
} = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');
const multer = require('multer');

const adminRoles = ['super_admin', 'admin'];
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const { sendError } = require('../utils/response');

router.get('/roles', authenticate, getRoles);
router.get('/template', authenticate, authorize(...adminRoles), downloadUserTemplate);
router.post('/import', authenticate, authorize(...adminRoles), upload.single('file'), importUsers);
router.get('/', authenticate, authorize(...adminRoles, 'sales_manager', 'management', 'backend_ops'), listUsers);
router.post('/', authenticate, authorize(...adminRoles), createUser);
router.get('/:id', authenticate, getUser);
router.put('/:id', authenticate, authorize(...adminRoles), updateUser);
router.delete('/:id', authenticate, authorize(...adminRoles), deleteUser);

// Allow users to reset their own password, or admins to reset any user's password
router.put(
  '/:id/reset-password',
  authenticate,
  (req, res, next) => {
    const isSelf = String(req.user.id) === String(req.params.id);
    const isAdmin = adminRoles.includes(req.user.role);
    if (!isSelf && !isAdmin) {
      return sendError(res, 'Access denied', 403);
    }
    next();
  },
  resetUserPassword
);

module.exports = router;
