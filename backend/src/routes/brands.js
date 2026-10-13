const router = require('express').Router();
const { listBrands, createBrand, updateBrand, listCategories, createCategory, updateCategory, listProducts, createProduct } = require('../controllers/brandController');
const { authenticate, authorize } = require('../middleware/auth');

const adminRoles = ['super_admin', 'admin'];

router.get('/brands', authenticate, listBrands);
router.post('/brands', authenticate, authorize(...adminRoles), createBrand);
router.put('/brands/:id', authenticate, authorize(...adminRoles), updateBrand);

router.get('/categories', authenticate, listCategories);
router.post('/categories', authenticate, authorize(...adminRoles), createCategory);
router.put('/categories/:id', authenticate, authorize(...adminRoles), updateCategory);

router.get('/products', authenticate, listProducts);
router.post('/products', authenticate, authorize(...adminRoles), createProduct);

module.exports = router;
