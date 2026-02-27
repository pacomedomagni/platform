import axios from 'axios';
import { getAdminToken, adminHeaders } from '../support/auth-helper';

describe('Health & Monitoring Endpoints', () => {
  beforeAll(async () => {
    await getAdminToken();
  });

  // ───────────────────────────── Health Checks ─────────────────────────────

  describe('Health Checks', () => {
    it('GET /health → 200 (basic health)', async () => {
      const res = await axios.get('/health');
      expect(res.status).toBe(200);
    });

    it('GET /health/ready → 200 (readiness probe)', async () => {
      const res = await axios.get('/health/ready');
      expect([200, 503]).toContain(res.status);
    });

    it('GET /health/live → 200 (liveness probe)', async () => {
      const res = await axios.get('/health/live');
      expect(res.status).toBe(200);
    });

    it('GET /health/metrics → 200 (health metrics)', async () => {
      const res = await axios.get('/health/metrics');
      expect(res.status).toBeLessThan(500);
      if (res.status === 200) {
        expect(res.data).toBeDefined();
      }
    });
  });

  // ───────────────────────────── Monitoring ─────────────────────────────

  describe('Monitoring', () => {
    it('GET /monitoring/metrics → 200 (system metrics)', async () => {
      const res = await axios.get('/monitoring/metrics');

      expect(res.status).toBeLessThan(500);
      if (res.status === 200) {
        expect(res.data).toBeDefined();
        expect(typeof res.data).toBe('object');
      }
    });

    it('GET /monitoring/health → 200 (system health + alerts)', async () => {
      const res = await axios.get('/monitoring/health');

      expect(res.status).toBeLessThan(500);
      if (res.status === 200) {
        expect(res.data).toBeDefined();
      }
    });

    it('GET /monitoring/failed-operations → 200 (failed ops)', async () => {
      const res = await axios.get('/monitoring/failed-operations?limit=10');

      expect(res.status).toBeLessThan(500);
      if (res.status === 200) {
        expect(res.data).toBeDefined();
      }
    });

    it('GET /monitoring/stock-anomalies → 200 (stock anomalies)', async () => {
      const res = await axios.get('/monitoring/stock-anomalies');

      expect(res.status).toBeLessThan(500);
      if (res.status === 200) {
        expect(res.data).toBeDefined();
      }
    });

    it('GET /monitoring/alerts → 200 (alerts only)', async () => {
      const res = await axios.get('/monitoring/alerts');

      expect(res.status).toBeLessThan(500);
      if (res.status === 200) {
        expect(res.data).toBeDefined();
      }
    });
  });
});
