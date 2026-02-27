import axios from 'axios';
import { getAdminToken, adminHeaders, tenantHeaders } from '../support/auth-helper';
import { store } from '../support/data-store';

describe('Shipping Endpoints', () => {
  beforeAll(async () => {
    await getAdminToken();
  });

  let zoneId: string;
  let rateId: string;

  // ───────────────────────────── Zones ─────────────────────────────

  describe('Shipping Zones', () => {
    it('POST /store/admin/shipping/zones → 201 (create zone)', async () => {
      const res = await axios.post(
        '/store/admin/shipping/zones',
        {
          name: `E2E Test Zone ${Date.now()}`,
          countries: ['US', 'CA'],
        },
        { headers: adminHeaders() }
      );

      expect(res.status).toBe(201);
      expect(res.data).toHaveProperty('id');
      zoneId = res.data.id;
      store.shippingZoneId = zoneId;
    });

    it('GET /store/admin/shipping/zones → 200 (list zones)', async () => {
      const res = await axios.get('/store/admin/shipping/zones', {
        headers: adminHeaders(),
      });

      expect(res.status).toBe(200);
      const items = res.data.data ?? res.data;
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThanOrEqual(1);
    });

    it('PUT /store/admin/shipping/zones/:zoneId → 200 (update zone)', async () => {
      expect(zoneId).toBeDefined();

      const res = await axios.put(
        `/store/admin/shipping/zones/${zoneId}`,
        { name: `E2E Updated Zone ${Date.now()}`, countries: ['US', 'CA', 'MX'] },
        { headers: adminHeaders() }
      );

      expect(res.status).toBe(200);
    });
  });

  // ───────────────────────────── Rates ─────────────────────────────

  describe('Shipping Rates', () => {
    it('POST /store/admin/shipping/zones/:zoneId/rates → 201 (create rate)', async () => {
      expect(zoneId).toBeDefined();

      const res = await axios.post(
        `/store/admin/shipping/zones/${zoneId}/rates`,
        {
          name: 'Standard Shipping',
          type: 'flat',
          price: 5.99,
          minOrderAmount: 0,
          estimatedDaysMin: 5,
          estimatedDaysMax: 7,
        },
        { headers: adminHeaders() }
      );

      expect(res.status).toBe(201);
      expect(res.data).toHaveProperty('id');
      rateId = res.data.id;
      store.shippingRateId = rateId;
    });

    it('GET /store/admin/shipping/zones/:zoneId/rates → 200 (list rates)', async () => {
      expect(zoneId).toBeDefined();

      const res = await axios.get(
        `/store/admin/shipping/zones/${zoneId}/rates`,
        { headers: adminHeaders() }
      );

      expect(res.status).toBe(200);
      const items = res.data.data ?? res.data;
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThanOrEqual(1);
    });

    it('PUT /store/admin/shipping/rates/:rateId → 200 (update rate)', async () => {
      expect(rateId).toBeDefined();

      const res = await axios.put(
        `/store/admin/shipping/rates/${rateId}`,
        { price: 6.99, estimatedDays: '3-5' },
        { headers: adminHeaders() }
      );

      expect(res.status).toBe(200);
    });

    it('DELETE /store/admin/shipping/rates/:rateId → 200 (delete rate)', async () => {
      expect(rateId).toBeDefined();

      const res = await axios.delete(
        `/store/admin/shipping/rates/${rateId}`,
        { headers: adminHeaders() }
      );

      expect([200, 204]).toContain(res.status);
    });
  });

  // ───────────────────────────── Calculate ─────────────────────────────

  describe('Shipping Calculate (Public)', () => {
    it('POST /store/shipping/calculate → calculate shipping', async () => {
      const res = await axios.post(
        '/store/shipping/calculate',
        {
          country: 'US',
          state: 'CA',
          postalCode: '90210',
          items: [{ productId: store.productIds?.[0] || 'test', quantity: 1 }],
        },
        { headers: tenantHeaders() }
      );

      // May return rates or empty if no zones match
      expect(res.status).toBeLessThan(500);
    });
  });

  // ───────────────────────────── Zone Cleanup ─────────────────────────────

  describe('Zone Cleanup', () => {
    it('DELETE /store/admin/shipping/zones/:zoneId → 200 (delete zone)', async () => {
      expect(zoneId).toBeDefined();

      const res = await axios.delete(
        `/store/admin/shipping/zones/${zoneId}`,
        { headers: adminHeaders() }
      );

      expect([200, 204]).toContain(res.status);
    });
  });
});
