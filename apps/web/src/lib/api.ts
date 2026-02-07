import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1', // Proxy will handle this or absolute URL. Next.js rewrites can also be used.
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const tenantId = localStorage.getItem('tenantId');
    if (tenantId) {
      config.headers['x-tenant-id'] = tenantId;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token');
        if (!window.location.pathname.startsWith('/login')) {
             window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
