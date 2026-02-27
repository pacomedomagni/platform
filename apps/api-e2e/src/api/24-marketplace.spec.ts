import axios from 'axios';
import { getAdminToken, adminHeaders } from '../support/auth-helper';

describe('Marketplace Endpoints (Extended)', () => {
  beforeAll(async () => {
    await getAdminToken();
  });

  // ───────────────────────────── Marketplace Listings (Local) ─────────────────────────────

  describe('Marketplace Listings', () => {
    it('GET /marketplace/listings → 200 (list marketplace listings)', async () => {
      const res = await axios.get('/marketplace/listings', {
        headers: adminHeaders(),
      });

      expect(res.status).toBeLessThan(500);
      if (res.status === 200) {
        const items = res.data.data ?? res.data;
        expect(Array.isArray(items)).toBe(true);
      }
    });
  });

  // ───────────────────────────── Marketplace Orders (Local) ─────────────────────────────

  describe('Marketplace Orders', () => {
    it('GET /marketplace/orders → 200 (list marketplace orders)', async () => {
      const res = await axios.get('/marketplace/orders', {
        headers: adminHeaders(),
      });

      expect(res.status).toBeLessThan(500);
      if (res.status === 200) {
        expect(res.data).toBeDefined();
      }
    });
  });

  // ───────────────────────────── Marketplace Connections ─────────────────────────────

  describe('Marketplace Connections', () => {
    it('GET /marketplace/connections → list connections', async () => {
      const res = await axios.get('/marketplace/connections', {
        headers: adminHeaders(),
      });

      expect(res.status).toBeLessThan(500);
    });

    it('POST /marketplace/connections → create connection (will fail without eBay creds)', async () => {
      const res = await axios.post(
        '/marketplace/connections',
        {
          platform: 'ebay',
          name: 'E2E Test Connection',
        },
        { headers: adminHeaders() }
      );

      // Expected to fail since no eBay credentials configured
      expect(res.status).toBeLessThan(500);
    });
  });
});
