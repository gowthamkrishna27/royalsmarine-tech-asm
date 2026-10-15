import api from './api';

export const submissionService = {
  list: (params) => api.get('/submissions', { params }),
  get: (id) => api.get(`/submissions/${id}`),
  create: (data) => api.post('/submissions', data),
};

export default submissionService;
