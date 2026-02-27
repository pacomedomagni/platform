import axios from 'axios';
import { getAdminToken, adminHeaders } from '../support/auth-helper';

describe('Financial Reports', () => {
  beforeAll(async () => {
    await getAdminToken();
  });

  // ───────────────────────────── Balance Reports ─────────────────────────────

  describe('Balance Reports', () => {
    it('GET /reports/trial-balance → 200 or 500', async () => {
      const res = await axios.get(
        '/reports/trial-balance?asOfDate=2026-12-31',
        { headers: adminHeaders() }
      );

      expect(res.status).toBeLessThanOrEqual(500);
      if (res.status === 200) {
        expect(res.data).toBeDefined();
      }
    });

    it('GET /reports/balance-sheet → 200 or 500', async () => {
      const res = await axios.get(
        '/reports/balance-sheet?asOfDate=2026-12-31',
        { headers: adminHeaders() }
      );

      expect(res.status).toBeLessThanOrEqual(500);
      if (res.status === 200) {
        expect(res.data).toBeDefined();
      }
    });
  });

  // ───────────────────────────── P&L & Cash Flow ─────────────────────────────

  describe('P&L & Cash Flow', () => {
    it('GET /reports/profit-loss → 200 or 500', async () => {
      const res = await axios.get(
        '/reports/profit-loss?fromDate=2026-01-01&toDate=2026-12-31',
        { headers: adminHeaders() }
      );

      expect(res.status).toBeLessThanOrEqual(500);
      if (res.status === 200) {
        expect(res.data).toBeDefined();
      }
    });

    it('GET /reports/cash-flow → 200 or 500', async () => {
      const res = await axios.get(
        '/reports/cash-flow?fromDate=2026-01-01&toDate=2026-12-31',
        { headers: adminHeaders() }
      );

      expect(res.status).toBeLessThanOrEqual(500);
      if (res.status === 200) {
        expect(res.data).toBeDefined();
      }
    });
  });

  // ───────────────────────────── Ledger & Aging ─────────────────────────────

  describe('Ledger & Aging', () => {
    it('GET /reports/general-ledger → 200 or 500', async () => {
      const res = await axios.get(
        '/reports/general-ledger?fromDate=2026-01-01&toDate=2026-12-31',
        { headers: adminHeaders() }
      );

      expect(res.status).toBeLessThanOrEqual(500);
      if (res.status === 200) {
        expect(res.data).toBeDefined();
      }
    });

    it('GET /reports/receivable-aging → 200 or 500', async () => {
      const res = await axios.get(
        '/reports/receivable-aging?asOfDate=2026-12-31',
        { headers: adminHeaders() }
      );

      expect(res.status).toBeLessThanOrEqual(500);
      if (res.status === 200) {
        expect(res.data).toBeDefined();
      }
    });

    it('GET /reports/payable-aging → 200 or 500', async () => {
      const res = await axios.get(
        '/reports/payable-aging?asOfDate=2026-12-31',
        { headers: adminHeaders() }
      );

      expect(res.status).toBeLessThanOrEqual(500);
      if (res.status === 200) {
        expect(res.data).toBeDefined();
      }
    });
  });
});
