import api from './api';

export const visitService = {
  list: (params) => api.get('/visits', { params }),
  get: (id) => api.get(`/visits/${id}`),
  create: (data) => api.post('/visits', data),
  update: (id, data) => api.put(`/visits/${id}`, data),
  approve: (id, data) => api.patch(`/visits/${id}/approve`, data),
  upload: (id, formData) => api.post(`/visits/${id}/attachments`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  export: (params) => api.get('/visits/export', { params, responseType: 'blob' }),
};

export default visitService;
