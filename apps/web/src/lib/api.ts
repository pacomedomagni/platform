import axios from 'axios';

const api = axios.create({
  baseURL: '/api', // All API paths already include /v1/ prefix
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
        // Redirect to admin login if not already there
        if (!window.location.pathname.startsWith('/app/login')) {
             window.location.href = '/app/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
