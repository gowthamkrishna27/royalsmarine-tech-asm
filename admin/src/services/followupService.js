import api from './api';

export const followupService = {
  list: (params) => api.get('/followups', { params }),
  today: (params) => api.get('/followups/today', { params }),
  overdue: (params) => api.get('/followups/overdue', { params }),
  getFilters: () => api.get('/visits/filters'),
  create: (data) => api.post('/followups', data),
  update: (id, data) => api.put(`/followups/${id}`, data),
  complete: (id, notes) => api.patch(`/followups/${id}/complete`, { completion_notes: notes }),
};

export default followupService;
