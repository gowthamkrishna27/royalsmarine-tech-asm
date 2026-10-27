import api from './api';

export const clientService = {
  list: (params) => api.get('/clients', { params }),
  get: (id) => api.get(`/clients/${id}`),
  profile: (id) => api.get(`/clients/${id}/profile`),
  create: (data) => api.post('/clients', data),
  update: (id, data) => api.put(`/clients/${id}`, data),
  export: (params) => api.get('/clients/export', { params, responseType: 'blob' }),
  import: (formData) => api.post('/clients/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  listPonds: (clientId) => api.get(`/clients/${clientId}/ponds`),
  addPond: (clientId, data) => api.post(`/clients/${clientId}/ponds`, data),
  updatePond: (clientId, pondId, data) => api.put(`/clients/${clientId}/ponds/${pondId}`, data),
  deletePond: (clientId, pondId) => api.delete(`/clients/${clientId}/ponds/${pondId}`),
  getMapLocations: (params) => api.get('/clients/map-locations', { params }),
  getHarvestedTanks: (params) => api.get('/clients/harvested-tanks', { params }),
  getFcrTanks: (params) => api.get('/clients/fcr-tanks', { params }),
};

export default clientService;
