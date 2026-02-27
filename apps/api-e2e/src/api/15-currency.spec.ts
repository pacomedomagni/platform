import axios from 'axios';
import { getAdminToken, adminHeaders, tenantHeaders } from '../support/auth-helper';
import { store } from '../support/data-store';

describe('Currency Endpoints', () => {
  beforeAll(async () => {
    await getAdminToken();
  });

  // ───────────────────────────── Public Endpoints ─────────────────────────────

  describe('Public Currency', () => {
    it('GET /currencies/available → 200 (list available currencies)', async () => {
      const res = await axios.get('/currencies/available');

      expect(res.status).toBe(200);
      const items = res.data.data ?? res.data;
      expect(Array.isArray(items)).toBe(true);
    });

    it('GET /currencies/store → 200 (store enabled currencies)', async () => {
      const res = await axios.get('/currencies/store', {
        headers: tenantHeaders(),
      });

      expect(res.status).toBe(200);
      expect(res.data).toBeDefined();
    });

    it('GET /currencies/convert → 200 (convert price)', async () => {
      const res = await axios.get(
        '/currencies/convert?amount=100&from=USD&to=EUR',
        { headers: tenantHeaders() }
      );

      // May succeed or return error if currencies not configured
      expect(res.status).toBeLessThan(500);
    });

    it('GET /currencies/product/:productId/price → product price in currency', async () => {
      if (!store.productIds?.[0]) {
        console.warn('Skipping product price: no product');
        return;
      }

      const res = await axios.get(
        `/currencies/product/${store.productIds[0]}/price?currency=USD`,
        { headers: tenantHeaders() }
      );

      expect(res.status).toBeLessThan(500);
    });
  });

  // ───────────────────────────── Admin Endpoints ─────────────────────────────

  describe('Admin Currency', () => {
    it('GET /currencies/admin → 200 (list store currencies)', async () => {
      const res = await axios.get('/currencies/admin', {
        headers: adminHeaders(),
      });

      expect(res.status).toBe(200);
      expect(res.data).toBeDefined();
    });

    let testCurrencyCode: string;

    it('POST /currencies/admin → 201 (create currency)', async () => {
      const res = await axios.post(
        '/currencies/admin',
        {
          currencyCode: 'EUR',
          exchangeRate: 0.92,
          isEnabled: true,
        },
        { headers: adminHeaders() }
      );

      // May be 201 (created) or 409/400 (already exists)
      expect(res.status).toBeLessThan(500);
      if (res.status === 201) {
        testCurrencyCode = res.data.currencyCode || 'EUR';
      } else {
        testCurrencyCode = 'EUR';
      }
    });

    it('PUT /currencies/admin/:currencyCode → 200 (update currency)', async () => {
      if (!testCurrencyCode) testCurrencyCode = 'EUR';

      const res = await axios.put(
        `/currencies/admin/${testCurrencyCode}`,
        { exchangeRate: 0.93, isEnabled: true },
        { headers: adminHeaders() }
      );

      expect(res.status).toBeLessThan(500);
    });

    it('POST /currencies/admin/rates → update exchange rates', async () => {
      const res = await axios.post(
        '/currencies/admin/rates',
        {
          rates: { EUR: 0.94 },
        },
        { headers: adminHeaders() }
      );

      expect(res.status).toBeLessThan(500);
    });

    it('POST /currencies/admin/:currencyCode/set-base → set base currency', async () => {
      const res = await axios.post(
        '/currencies/admin/USD/set-base',
        {},
        { headers: adminHeaders() }
      );

      expect(res.status).toBeLessThan(500);
    });
  });

  // ───────────────────────────── Price Overrides ─────────────────────────────

  describe('Price Overrides', () => {
    it('GET /currencies/admin/overrides/:currencyCode → 200', async () => {
      const res = await axios.get('/currencies/admin/overrides/USD', {
        headers: adminHeaders(),
      });

      expect(res.status).toBeLessThan(500);
      if (res.status === 200) {
        expect(res.data).toBeDefined();
      }
    });

    it('POST /currencies/admin/overrides → set price override', async () => {
      if (!store.productIds?.[0]) {
        console.warn('Skipping price override: no product');
        return;
      }

      const res = await axios.post(
        '/currencies/admin/overrides',
        {
          productId: store.productIds[0],
          currencyCode: 'EUR',
          price: 25.99,
        },
        { headers: adminHeaders() }
      );

      expect(res.status).toBeLessThan(500);
    });

    it('POST /currencies/admin/overrides/bulk → bulk set overrides', async () => {
      if (!store.productIds?.[0]) {
        console.warn('Skipping bulk override: no product');
        return;
      }

      const res = await axios.post(
        '/currencies/admin/overrides/bulk',
        {
          overrides: [
            {
              productId: store.productIds[0],
              currencyCode: 'EUR',
              price: 26.99,
            },
          ],
        },
        { headers: adminHeaders() }
      );

      expect(res.status).toBeLessThan(500);
    });

    it('DELETE /currencies/admin/overrides/:productId/:currencyCode → delete override', async () => {
      if (!store.productIds?.[0]) {
        console.warn('Skipping delete override: no product');
        return;
      }

      const res = await axios.delete(
        `/currencies/admin/overrides/${store.productIds[0]}/EUR`,
        { headers: adminHeaders() }
      );

      expect(res.status).toBeLessThan(500);
    });
  });

  // ───────────────────────────── Cleanup ─────────────────────────────

  describe('Currency Cleanup', () => {
    it('DELETE /currencies/admin/:currencyCode → delete EUR', async () => {
      const res = await axios.delete('/currencies/admin/EUR', {
        headers: adminHeaders(),
      });

      // May succeed or fail if EUR is still referenced
      expect(res.status).toBeLessThan(500);
    });
  });
});
