import axios from 'axios';
import { getAdminToken } from '../support/auth-helper';

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@noslag.com';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'admin123';

describe('Auth Endpoints', () => {
  describe('POST /auth/login', () => {
    it('should return 201 with an access_token for valid credentials', async () => {
      const res = await axios.post('/auth/login', {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      });

      expect(res.status).toBe(201);
      expect(res.data).toHaveProperty('access_token');
      expect(typeof res.data.access_token).toBe('string');
      expect(res.data.access_token.length).toBeGreaterThan(0);
    });

    it('should return 401 for a wrong password', async () => {
      const res = await axios.post('/auth/login', {
        email: ADMIN_EMAIL,
        password: 'definitely-wrong-password',
      });

      expect(res.status).toBe(401);
    });

    it('should return 401 for a nonexistent email', async () => {
      const res = await axios.post('/auth/login', {
        email: 'nobody-here@nonexistent.com',
        password: 'irrelevant',
      });

      expect(res.status).toBe(401);
    });
  });

  describe('JWT token claims', () => {
    it('should contain expected claims in the token payload', async () => {
      const res = await axios.post('/auth/login', {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      });

      expect(res.status).toBe(201);

      const token = res.data.access_token;
      const parts = token.split('.');
      expect(parts).toHaveLength(3);

      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString('utf-8')
      );

      // Standard JWT claims
      expect(payload).toHaveProperty('sub');
      expect(payload).toHaveProperty('iat');
      expect(payload).toHaveProperty('exp');
      expect(payload.exp).toBeGreaterThan(payload.iat);

      // Application-specific claims
      expect(payload).toHaveProperty('email', ADMIN_EMAIL);
    });
  });

  describe('Admin token caching', () => {
    it('should retrieve and cache the admin token for later test files', async () => {
      const token = await getAdminToken();

      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);

      // Subsequent calls should return the same cached token
      const cachedToken = await getAdminToken();
      expect(cachedToken).toBe(token);
    });
  });
});
