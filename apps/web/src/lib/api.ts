import axios from 'axios';

const api = axios.create({
  baseURL: '/api', // All API paths already include /v1/ prefix
  timeout: 30000, // 30s timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const path = window.location.pathname;
    // Use customer token for storefront, admin token for app
    const tokenKey = path.startsWith('/storefront') ? 'customer_token' : 'access_token';
    const token = localStorage.getItem(tokenKey);
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
  (response) => {
    // Unwrap { data, meta } envelope from standardized API responses
    if (response.data && typeof response.data === 'object' && 'data' in response.data && 'meta' in response.data) {
      response.data = response.data.data;
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Handle 429 rate limiting with retry
    if (error.response?.status === 429) {
      const retryAfter = parseInt(error.response.headers['retry-after'] || '2', 10);
      const delay = Math.min(retryAfter * 1000, 10000);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return api.request(originalRequest);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (typeof window === 'undefined') {
        return Promise.reject(error);
      }

      const path = window.location.pathname;

      // Don't attempt refresh on login pages or refresh endpoint itself
      if (
        path.startsWith('/app/login') ||
        path.startsWith('/storefront/account/login') ||
        originalRequest.url?.includes('/auth/refresh')
      ) {
        return Promise.reject(error);
      }

      const isStorefront = path.startsWith('/storefront');
      const refreshTokenKey = isStorefront ? 'customer_refresh_token' : 'refresh_token';
      const accessTokenKey = isStorefront ? 'customer_token' : 'access_token';
      const refreshEndpoint = isStorefront ? '/v1/store/auth/refresh' : '/v1/auth/refresh';
      const loginPath = isStorefront ? '/storefront/account/login' : '/app/login';

      const refreshToken = localStorage.getItem(refreshTokenKey);

      if (!refreshToken) {
        localStorage.removeItem(accessTokenKey);
        window.location.href = loginPath;
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api.request(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await axios.post(`/api${refreshEndpoint}`, {
          refresh_token: refreshToken,
        });

        const data = response.data?.data || response.data;
        const newAccessToken = data.access_token || data.token;
        const newRefreshToken = data.refresh_token;

        if (newAccessToken) {
          localStorage.setItem(accessTokenKey, newAccessToken);
        }
        if (newRefreshToken) {
          localStorage.setItem(refreshTokenKey, newRefreshToken);
        }

        processQueue(null, newAccessToken);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api.request(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem(accessTokenKey);
        localStorage.removeItem(refreshTokenKey);
        window.location.href = loginPath;
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
