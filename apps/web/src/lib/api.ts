import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1', // Proxy will handle this or absolute URL. Next.js rewrites can also be used.
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
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
