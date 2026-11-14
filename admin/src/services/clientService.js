import api from './api';

export const clientService = {
  list: (params) => api.get('/clients', { params }),
  getFilters: () => api.get('/visits/filters'),
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
  getFcrTanks: (params) => api.get('/clients/fcr-tanks', { params }),
  getCountTanks: (params) => api.get('/clients/count-tanks', { params }),
  getHarvestedTanks: (params) => api.get('/clients/harvested-tanks', { params }),
  getDealers: (params) => api.get('/clients/dealers', { params }),
  exportFcr: (params) => api.get('/clients/fcr-export', { params, responseType: 'blob' }),
  exportCount: (params) => api.get('/clients/count-export', { params, responseType: 'blob' }),
};

export default clientService;
