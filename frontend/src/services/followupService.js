import api from './api';

export const followupService = {
  list: (params) => api.get('/followups', { params }),
  today: () => api.get('/followups/today'),
  overdue: () => api.get('/followups/overdue'),
  create: (data) => api.post('/followups', data),
  update: (id, data) => api.put(`/followups/${id}`, data),
  complete: (id, notes) => api.patch(`/followups/${id}/complete`, { completion_notes: notes }),
  listTests: (params) => api.get('/followups/tests', { params }),
  completeTest: (id, notes) => api.patch(`/followups/tests/${id}/complete`, { notes }),
};

export default followupService;
