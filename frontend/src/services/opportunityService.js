import api from './api';

export const opportunityService = {
  list: (params) => api.get('/opportunities', { params }),
  get: (id) => api.get(`/opportunities/${id}`),
  create: (data) => api.post('/opportunities', data),
  update: (id, data) => api.put(`/opportunities/${id}`, data),
  changeStage: (id, data) => api.patch(`/opportunities/${id}/stage`, data),
  addComment: (id, comment) => api.post(`/opportunities/${id}/comments`, { comment }),
  pipeline: (params) => api.get('/opportunities/pipeline', { params }),
};

export default opportunityService;
