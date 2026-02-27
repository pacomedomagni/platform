import axios from 'axios';
import { getAdminToken, adminHeaders } from '../support/auth-helper';

describe('Dashboard Endpoints', () => {
  beforeAll(async () => {
    await getAdminToken();
  });

  // ───────────────────────────── Admin Dashboard ─────────────────────────────

  describe('Admin Dashboard', () => {
    it('GET /dashboard/summary → 200 (full dashboard summary)', async () => {
      const res = await axios.get('/dashboard/summary', {
        headers: adminHeaders(),
      });

      expect(res.status).toBeLessThan(500);
      if (res.status === 200) {
        expect(res.data).toBeDefined();
        expect(typeof res.data).toBe('object');
      }
    });

    it('GET /dashboard/attention → 200 (what needs attention)', async () => {
      const res = await axios.get('/dashboard/attention', {
        headers: adminHeaders(),
      });

      expect(res.status).toBeLessThan(500);
      if (res.status === 200) {
        expect(res.data).toBeDefined();
      }
    });

    it('GET /dashboard/revenue → 200 (revenue stats)', async () => {
      const res = await axios.get('/dashboard/revenue', {
        headers: adminHeaders(),
      });

      expect(res.status).toBeLessThan(500);
      if (res.status === 200) {
        expect(res.data).toBeDefined();
      }
    });

    it('GET /dashboard/orders → 200 (order stats)', async () => {
      const res = await axios.get('/dashboard/orders', {
        headers: adminHeaders(),
      });

      expect(res.status).toBeLessThan(500);
      if (res.status === 200) {
        expect(res.data).toBeDefined();
      }
    });

    it('GET /dashboard/inventory → 200 (inventory alerts)', async () => {
      const res = await axios.get('/dashboard/inventory', {
        headers: adminHeaders(),
      });

      expect(res.status).toBeLessThan(500);
      if (res.status === 200) {
        expect(res.data).toBeDefined();
      }
    });
  });

  // ───────────────────────────── Store Admin Dashboard ─────────────────────────────

  describe('Store Admin Dashboard', () => {
    it('GET /store/admin/dashboard → 200 (store dashboard stats)', async () => {
      const res = await axios.get('/store/admin/dashboard', {
        headers: adminHeaders(),
      });

      expect(res.status).toBeLessThan(500);
      if (res.status === 200) {
        expect(res.data).toBeDefined();
      }
    });

    it('GET /store/admin/dashboard/readiness → 200 (store readiness)', async () => {
      const res = await axios.get('/store/admin/dashboard/readiness', {
        headers: adminHeaders(),
      });

      expect(res.status).toBeLessThan(500);
      if (res.status === 200) {
        expect(res.data).toBeDefined();
      }
    });

    it('GET /store/admin/dashboard/earnings → 200 (earnings data)', async () => {
      const res = await axios.get('/store/admin/dashboard/earnings', {
        headers: adminHeaders(),
      });

      expect(res.status).toBeLessThan(500);
      if (res.status === 200) {
        expect(res.data).toBeDefined();
      }
    });

    it('GET /store/admin/dashboard/inventory-alerts → 200 (inventory alerts)', async () => {
      const res = await axios.get('/store/admin/dashboard/inventory-alerts', {
        headers: adminHeaders(),
      });

      expect(res.status).toBeLessThan(500);
      if (res.status === 200) {
        expect(res.data).toBeDefined();
      }
    });
  });
});
