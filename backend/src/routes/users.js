const router = require('express').Router();
const { listUsers, createUser, getUser, updateUser, deleteUser, resetUserPassword, getRoles } = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');

const adminRoles = ['super_admin', 'admin'];

router.get('/roles', authenticate, getRoles);
router.get('/', authenticate, authorize(...adminRoles, 'sales_manager'), listUsers);
router.post('/', authenticate, authorize(...adminRoles), createUser);
router.get('/:id', authenticate, getUser);
router.put('/:id', authenticate, authorize(...adminRoles), updateUser);
router.delete('/:id', authenticate, authorize(...adminRoles), deleteUser);
router.put('/:id/reset-password', authenticate, authorize(...adminRoles), resetUserPassword);

module.exports = router;
