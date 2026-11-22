import api from './api';

export const followupService = {
  list: (params) => api.get('/followups', { params }),
  stats: (params) => api.get('/followups/stats', { params }),
  today: (params) => api.get('/followups/today', { params }),
  dues: (params) => api.get('/followups/dues', { params }),
  overdue: (params) => api.get('/followups/overdue', { params }),
  getFilters: () => api.get('/visits/filters'),
  create: (data) => api.post('/followups', data),
  update: (id, data) => api.put(`/followups/${id}`, data),
  complete: (id, data) => api.patch(`/followups/${id}/complete`, typeof data === 'object' ? data : { completion_notes: data }),
};

export default followupService;
