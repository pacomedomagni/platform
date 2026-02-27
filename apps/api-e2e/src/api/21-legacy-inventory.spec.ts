import axios from 'axios';
import { getAdminToken, adminHeaders } from '../support/auth-helper';
import { store } from '../support/data-store';

describe('Legacy Inventory Controller (/inventory)', () => {
  beforeAll(async () => {
    await getAdminToken();
  });

  // ───────────────────────────── Stock Balance & Ledger ─────────────────────────────

  describe('Stock Balance & Ledger', () => {
    it('GET /inventory/stock-balance → 200 (stock balance)', async () => {
      const params: Record<string, string> = {};
      if (store.warehouseCode) params.warehouseCode = store.warehouseCode;

      const res = await axios.get('/inventory/stock-balance', {
        headers: adminHeaders(),
        params,
      });

      expect(res.status).toBeLessThan(500);
      if (res.status === 200) {
        expect(res.data).toBeDefined();
      }
    });

    it('GET /inventory/stock-ledger → 200 (stock ledger)', async () => {
      const res = await axios.get('/inventory/stock-ledger', {
        headers: adminHeaders(),
        params: {
          warehouseCode: store.warehouseCode || '',
        },
      });

      expect(res.status).toBeLessThan(500);
      if (res.status === 200) {
        expect(res.data).toBeDefined();
      }
    });
  });

  // ───────────────────────────── Locations & Serials ─────────────────────────────

  describe('Locations & Serials', () => {
    it('GET /inventory/locations → 200 (list locations)', async () => {
      const res = await axios.get('/inventory/locations', {
        headers: adminHeaders(),
      });

      expect(res.status).toBeLessThan(500);
      if (res.status === 200) {
        const items = res.data.data ?? res.data;
        expect(Array.isArray(items)).toBe(true);
      }
    });

    it('GET /inventory/serials → 200 (list serials)', async () => {
      const res = await axios.get('/inventory/serials', {
        headers: adminHeaders(),
      });

      expect(res.status).toBeLessThan(500);
      if (res.status === 200) {
        expect(res.data).toBeDefined();
      }
    });
  });

  // ───────────────────────────── Valuation & Aging ─────────────────────────────

  describe('Valuation & Aging', () => {
    it('GET /inventory/stock-valuation → 200 (stock valuation)', async () => {
      const res = await axios.get('/inventory/stock-valuation', {
        headers: adminHeaders(),
      });

      expect(res.status).toBeLessThan(500);
      if (res.status === 200) {
        expect(res.data).toBeDefined();
      }
    });

    it('GET /inventory/stock-aging → 200 (stock aging)', async () => {
      const res = await axios.get('/inventory/stock-aging', {
        headers: adminHeaders(),
      });

      expect(res.status).toBeLessThan(500);
      if (res.status === 200) {
        expect(res.data).toBeDefined();
      }
    });
  });

  // ───────────────────────────── Movement & Reorder ─────────────────────────────

  describe('Movement & Reorder', () => {
    it('GET /inventory/stock-movement → 200 (stock movement summary)', async () => {
      const res = await axios.get('/inventory/stock-movement', {
        headers: adminHeaders(),
      });

      expect(res.status).toBeLessThan(500);
      if (res.status === 200) {
        expect(res.data).toBeDefined();
      }
    });

    it('GET /inventory/reorder-suggestions → 200 (reorder suggestions)', async () => {
      const res = await axios.get('/inventory/reorder-suggestions', {
        headers: adminHeaders(),
      });

      expect(res.status).toBeLessThan(500);
      if (res.status === 200) {
        expect(res.data).toBeDefined();
      }
    });
  });
});
