import axios from 'axios';
import { API_BASE } from '../constants';

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refresh = localStorage.getItem('refreshToken');
        const { data } = await axios.post(`${API_BASE}/auth/refresh-token`, { refreshToken: refresh });
        localStorage.setItem('accessToken', data.data.accessToken);
        localStorage.setItem('refreshToken', data.data.refreshToken);
        original.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(original);
      } catch {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;

// Domain-specific service exports
export { authService } from './authService';
export { clientService } from './clientService';
export { visitService } from './visitService';
export { followupService } from './followupService';
export { billingService } from './billingService';
export { reportService } from './reportService';
export { userService } from './userService';
export { masterService } from './masterService';
export { notificationService } from './notificationService';
export { gpsService } from './gpsService';

// Backwards-compatible aliases
import { authService } from './authService';
import { clientService } from './clientService';
import { visitService } from './visitService';
import { followupService } from './followupService';
import { billingService } from './billingService';
import { reportService } from './reportService';
import { userService } from './userService';
import { masterService } from './masterService';
import { notificationService } from './notificationService';

export const authApi = authService;
export const clientApi = clientService;
export const visitApi = visitService;
export const followupApi = followupService;
export const masterApi = masterService;
export const billingApi = billingService;
export const dashboardApi = { get: () => api.get('/dashboard') };
export const reportApi = reportService;
export const notificationApi = notificationService;
export const userApi = userService;
