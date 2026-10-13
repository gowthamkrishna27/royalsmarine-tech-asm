import api from './api';

export const purchaseOrderService = {
  list: (params) => api.get('/purchase-orders', { params }),
  create: (formData) => api.post('/purchase-orders', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateStatus: (id, status) => api.patch(`/purchase-orders/${id}/status`, { order_status: status }),
};

export default purchaseOrderService;
