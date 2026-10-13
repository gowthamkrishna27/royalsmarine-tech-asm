import api from './api';

export const billingService = {
  imports: () => api.get('/billing/imports'),
  import: (formData) => api.post('/billing/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  unmatched: () => api.get('/billing/unmatched'),
  map: (id, data) => api.patch(`/billing/records/${id}/map`, data),
};

export default billingService;
