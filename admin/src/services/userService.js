import api from './api';

export const userService = {
  list: (params) => api.get('/users', { params }),
  get: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  resetPassword: (id, password) => api.put(`/users/${id}/reset-password`, { password }),
  roles: () => api.get('/users/roles'),
  downloadTemplate: (format = 'xlsx') => api.get(`/users/template?format=${format}`, { responseType: 'blob' }),
  import: (formData) => api.post('/users/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

export default userService;
