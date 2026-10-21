const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const { buildMeta } = require('../utils/pagination');

const listBrands = async (req, res) => {
  return sendPaginated(res, 'Brands fetched', [], buildMeta(0, 1, 20));
};

const createBrand = async (req, res) => {
  return sendError(res, 'Brands module has been removed', 400);
};

const updateBrand = async (req, res) => {
  return sendError(res, 'Brands module has been removed', 400);
};

const listCategories = async (req, res) => {
  return sendSuccess(res, 'Categories fetched', []);
};

const createCategory = async (req, res) => {
  return sendError(res, 'Categories module has been removed', 400);
};

const updateCategory = async (req, res) => {
  return sendError(res, 'Categories module has been removed', 400);
};

const listProducts = async (req, res) => {
  return sendSuccess(res, 'Products fetched', []);
};

const createProduct = async (req, res) => {
  return sendError(res, 'Products module has been removed', 400);
};

module.exports = {
  listBrands,
  createBrand,
  updateBrand,
  listCategories,
  createCategory,
  updateCategory,
  listProducts,
  createProduct,
};
