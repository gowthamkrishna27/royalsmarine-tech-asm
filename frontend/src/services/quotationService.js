import api from './api';

export const quotationService = {
  list: (params) => api.get('/quotations', { params }),
  create: (formData) => api.post('/quotations', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id, data) => api.put(`/quotations/${id}`, data),
};

export default quotationService;
