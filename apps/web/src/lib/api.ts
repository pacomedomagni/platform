import axios from 'axios';

const api = axios.create({
  baseURL: '/api', // All API paths already include /v1/ prefix
  timeout: 30000, // 30s timeout
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
    // Attach storefront session token if present
    const cartSession = localStorage.getItem('cart_session');
    if (cartSession) {
      config.headers['x-session-token'] = cartSession;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Handle 429 rate limiting with retry
    if (error.response?.status === 429) {
      const retryAfter = parseInt(error.response.headers['retry-after'] || '2', 10);
      const delay = Math.min(retryAfter * 1000, 10000);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return api.request(error.config);
    }

    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        const path = window.location.pathname;
        // Don't redirect if already on a login page
        if (path.startsWith('/app/login') || path.startsWith('/storefront/account/login')) {
          return Promise.reject(error);
        }
        localStorage.removeItem('access_token');
        // Redirect to appropriate login page
        if (path.startsWith('/storefront')) {
          window.location.href = '/storefront/account/login';
        } else {
          window.location.href = '/app/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
