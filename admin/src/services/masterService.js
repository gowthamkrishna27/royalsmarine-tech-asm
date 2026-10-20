import api from './api';

export const masterService = {
  brands: (params) => api.get('/master/brands', { params }),
  createBrand: (data) => api.post('/master/brands', data),
  updateBrand: (id, data) => api.put(`/master/brands/${id}`, data),
  categories: (params) => api.get('/master/categories', { params }),
  createCategory: (data) => api.post('/master/categories', data),
  updateCategory: (id, data) => api.put(`/master/categories/${id}`, data),
  products: (params) => api.get('/master/products', { params }),
  createProduct: (data) => api.post('/master/products', data),
};

export default masterService;
