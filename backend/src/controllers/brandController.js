const sequelize = require('../config/database');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const { getPagination, buildMeta } = require('../utils/pagination');

const listBrands = async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const { status, search } = req.query;
  let where = 'deleted_at IS NULL';
  const replacements = [];
  if (status) { where += ' AND status = ?'; replacements.push(status); }
  if (search) { where += ' AND name LIKE ?'; replacements.push(`%${search}%`); }

  try {
    const [[{ total }]] = await sequelize.query(`SELECT COUNT(*) as total FROM brands WHERE ${where}`, { replacements });
    const [brands] = await sequelize.query(`SELECT * FROM brands WHERE ${where} ORDER BY name LIMIT ? OFFSET ?`, { replacements: [...replacements, limit, offset] });
    return sendPaginated(res, 'Brands fetched', brands, buildMeta(total, page, limit));
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const createBrand = async (req, res) => {
  const { name, description } = req.body;
  try {
    const [result] = await sequelize.query(
      'INSERT INTO brands (name, description, created_by) VALUES (?, ?, ?)',
      { replacements: [name, description || null, req.user.id] }
    );
    return sendSuccess(res, 'Brand created', { id: result.insertId }, 201);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return sendError(res, 'Brand name already exists', 409);
    return sendError(res, err.message, 500);
  }
};

const updateBrand = async (req, res) => {
  const { name, description, status } = req.body;
  try {
    await sequelize.query('UPDATE brands SET name=?, description=?, status=?, updated_at=NOW() WHERE id=?', { replacements: [name, description || null, status, req.params.id] });
    return sendSuccess(res, 'Brand updated');
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const listCategories = async (req, res) => {
  const { status, parent_id } = req.query;
  let where = 'deleted_at IS NULL';
  const replacements = [];
  if (status) { where += ' AND status = ?'; replacements.push(status); }
  if (parent_id === 'null') { where += ' AND parent_id IS NULL'; }
  else if (parent_id) { where += ' AND parent_id = ?'; replacements.push(parent_id); }

  try {
    const [cats] = await sequelize.query(
      `SELECT c.*, p.name as parent_name FROM categories c LEFT JOIN categories p ON c.parent_id = p.id WHERE c.${where} ORDER BY c.name`,
      { replacements }
    );
    return sendSuccess(res, 'Categories fetched', cats);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const createCategory = async (req, res) => {
  const { name, parent_id, description } = req.body;
  try {
    const [result] = await sequelize.query(
      'INSERT INTO categories (name, parent_id, description, created_by) VALUES (?, ?, ?, ?)',
      { replacements: [name, parent_id || null, description || null, req.user.id] }
    );
    return sendSuccess(res, 'Category created', { id: result.insertId }, 201);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const updateCategory = async (req, res) => {
  const { name, parent_id, description, status } = req.body;
  try {
    await sequelize.query('UPDATE categories SET name=?, parent_id=?, description=?, status=?, updated_at=NOW() WHERE id=?',
      { replacements: [name, parent_id || null, description || null, status, req.params.id] });
    return sendSuccess(res, 'Category updated');
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const listProducts = async (req, res) => {
  const { brand_id, category_id, status } = req.query;
  let where = 'p.deleted_at IS NULL';
  const replacements = [];
  if (brand_id) { where += ' AND p.brand_id = ?'; replacements.push(brand_id); }
  if (category_id) { where += ' AND p.category_id = ?'; replacements.push(category_id); }
  if (status) { where += ' AND p.status = ?'; replacements.push(status); }

  try {
    const [products] = await sequelize.query(
      `SELECT p.id, p.name, p.description, p.status, b.name as brand, c.name as category
       FROM products p LEFT JOIN brands b ON p.brand_id = b.id LEFT JOIN categories c ON p.category_id = c.id
       WHERE ${where} ORDER BY p.name`,
      { replacements }
    );
    return sendSuccess(res, 'Products fetched', products);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const createProduct = async (req, res) => {
  const { name, brand_id, category_id, subcategory_id, description } = req.body;
  try {
    const [result] = await sequelize.query(
      'INSERT INTO products (name, brand_id, category_id, subcategory_id, description, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      { replacements: [name, brand_id, category_id, subcategory_id || null, description || null, req.user.id] }
    );
    return sendSuccess(res, 'Product created', { id: result.insertId }, 201);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

module.exports = { listBrands, createBrand, updateBrand, listCategories, createCategory, updateCategory, listProducts, createProduct };
