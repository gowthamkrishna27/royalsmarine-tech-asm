import api from './api';

export const reportService = {
  visits: (params) => api.get('/reports/visits', { params }),
  opportunities: (params) => api.get('/reports/opportunities', { params }),
  followups: (params) => api.get('/reports/followups', { params }),
  billing: (params) => api.get('/reports/billing', { params }),
  brand: (params) => api.get('/reports/brand', { params }),
  mom: (params) => api.get('/reports/mom', { params }),
  products: (params) => api.get('/reports/products', { params }),
  export: (params) => api.get('/reports/export', { params, responseType: 'blob' }),
};

export default reportService;
