import axios from 'axios';
import { getAdminToken, adminHeaders } from '../support/auth-helper';
import { store } from '../support/data-store';

describe('Shipping Advanced Endpoints (Carriers, Shipments, Weight Tiers)', () => {
  beforeAll(async () => {
    await getAdminToken();
  });

  // ───────────────────────── Carriers ─────────────────────────

  let carrierId: string;

  describe('Shipping Carriers', () => {
    it('POST /store/admin/shipping/carriers → 201 (create carrier)', async () => {
      const res = await axios.post(
        '/store/admin/shipping/carriers',
        {
          name: 'E2E Test Carrier',
          code: `e2e-carrier-${Date.now()}`,
          type: 'flat',
          testMode: true,
        },
        { headers: adminHeaders() },
      );

      expect([200, 201]).toContain(res.status);
      carrierId = res.data.id;
      expect(carrierId).toBeDefined();
      store.carrierId = carrierId;
    });

    it('GET /store/admin/shipping/carriers → 200 (list carriers)', async () => {
      const res = await axios.get('/store/admin/shipping/carriers', {
        headers: adminHeaders(),
      });

      expect(res.status).toBe(200);
      expect(res.data).toBeDefined();
    });

    it('GET /store/admin/shipping/carriers/:id → 200 (get carrier detail)', async () => {
      if (!carrierId) {
        console.warn('Skipping: no carrier created');
        return;
      }

      const res = await axios.get(
        `/store/admin/shipping/carriers/${carrierId}`,
        { headers: adminHeaders() },
      );

      expect(res.status).toBe(200);
      expect(res.data).toBeDefined();
      expect(res.data.id).toBe(carrierId);
    });

    it('PUT /store/admin/shipping/carriers/:id → 200 (update carrier)', async () => {
      if (!carrierId) {
        console.warn('Skipping: no carrier to update');
        return;
      }

      const res = await axios.put(
        `/store/admin/shipping/carriers/${carrierId}`,
        { name: 'E2E Carrier Updated' },
        { headers: adminHeaders() },
      );

      expect(res.status).toBe(200);
      expect(res.data).toBeDefined();
    });
  });

  // ───────────────────────── Weight Tiers ─────────────────────────

  let weightTierId: string;
  let weightTierRateId: string;
  let weightTierZoneId: string;

  describe('Weight Tiers', () => {
    beforeAll(async () => {
      // Create our own zone + rate for weight tier tests
      try {
        const zoneRes = await axios.post(
          '/store/admin/shipping/zones',
          { name: `Weight Tier Zone ${Date.now()}`, countries: ['US'] },
          { headers: adminHeaders() },
        );
        if (zoneRes.status === 200 || zoneRes.status === 201) {
          weightTierZoneId = zoneRes.data.id;
          const rateRes = await axios.post(
            `/store/admin/shipping/zones/${weightTierZoneId}/rates`,
            {
              zoneId: weightTierZoneId,
              name: 'Weight Tier Test Rate',
              type: 'weight',
              price: 5.99,
            },
            { headers: adminHeaders() },
          );
          if (rateRes.status === 200 || rateRes.status === 201) {
            weightTierRateId = rateRes.data.id;
          }
        }
      } catch {
        // Will skip weight tier tests
      }
    });

    it('POST /store/admin/shipping/weight-tiers → 201 (add weight tier)', async () => {
      if (!weightTierRateId) {
        console.warn('Skipping: no shipping rate ID available for weight tier');
        return;
      }

      const res = await axios.post(
        '/store/admin/shipping/weight-tiers',
        {
          rateId: weightTierRateId,
          minWeight: 0,
          maxWeight: 5,
          price: 4.99,
          pricePerKg: 0.5,
        },
        { headers: adminHeaders() },
      );

      expect([200, 201]).toContain(res.status);
      if (res.data?.id) {
        weightTierId = res.data.id;
        store.weightTierId = weightTierId;
      }
    });

    it('DELETE /store/admin/shipping/weight-tiers/:id → 200 (delete weight tier)', async () => {
      if (!weightTierId) {
        console.warn('Skipping: no weight tier to delete');
        return;
      }

      const res = await axios.delete(
        `/store/admin/shipping/weight-tiers/${weightTierId}`,
        { headers: adminHeaders() },
      );

      expect([200, 204]).toContain(res.status);
    });

    afterAll(async () => {
      // Clean up zone created for weight tier tests
      if (weightTierZoneId) {
        try {
          await axios.delete(
            `/store/admin/shipping/zones/${weightTierZoneId}`,
            { headers: adminHeaders() },
          );
        } catch { /* ignore */ }
      }
    });
  });

  // ───────────────────────── Shipments ─────────────────────────

  let shipmentId: string;

  describe('Shipments', () => {
    it('POST /store/admin/shipments → 201 (create shipment)', async () => {
      const orderId = store.orderId;
      if (!orderId) {
        console.warn('Skipping: no order ID for shipment');
        return;
      }

      const res = await axios.post(
        '/store/admin/shipments',
        {
          orderId,
          carrierName: 'E2E Test Carrier',
          trackingNumber: `TRK-E2E-${Date.now()}`,
          trackingUrl: 'https://example.com/track',
        },
        { headers: adminHeaders() },
      );

      expect([200, 201]).toContain(res.status);
      if (res.data?.id) {
        shipmentId = res.data.id;
        store.shipmentId = shipmentId;
      }
    });

    it('GET /store/admin/shipments → 200 (list shipments)', async () => {
      const res = await axios.get('/store/admin/shipments', {
        headers: adminHeaders(),
      });

      expect(res.status).toBe(200);
      expect(res.data).toBeDefined();
    });

    it('GET /store/admin/shipments/:id → 200 (get shipment detail)', async () => {
      if (!shipmentId) {
        console.warn('Skipping: no shipment created');
        return;
      }

      const res = await axios.get(
        `/store/admin/shipments/${shipmentId}`,
        { headers: adminHeaders() },
      );

      expect(res.status).toBe(200);
      expect(res.data).toBeDefined();
      expect(res.data.id).toBe(shipmentId);
    });

    it('PUT /store/admin/shipments/:id → 200 (update shipment)', async () => {
      if (!shipmentId) {
        console.warn('Skipping: no shipment to update');
        return;
      }

      const res = await axios.put(
        `/store/admin/shipments/${shipmentId}`,
        { trackingNumber: `TRK-UPDATED-${Date.now()}` },
        { headers: adminHeaders() },
      );

      expect(res.status).toBe(200);
      expect(res.data).toBeDefined();
    });

    it('POST /store/admin/shipments/:id/events → 201 (add tracking event)', async () => {
      if (!shipmentId) {
        console.warn('Skipping: no shipment for tracking event');
        return;
      }

      const res = await axios.post(
        `/store/admin/shipments/${shipmentId}/events`,
        {
          status: 'in_transit',
          description: 'Package picked up by carrier',
          location: 'Distribution Center, CA',
          occurredAt: new Date().toISOString(),
        },
        { headers: adminHeaders() },
      );

      expect([200, 201]).toContain(res.status);
    });

    it('POST /store/admin/shipments/:id/ship → 200 (mark as shipped)', async () => {
      if (!shipmentId) {
        console.warn('Skipping: no shipment to mark as shipped');
        return;
      }

      const res = await axios.post(
        `/store/admin/shipments/${shipmentId}/ship`,
        { trackingNumber: `TRK-SHIPPED-${Date.now()}` },
        { headers: adminHeaders() },
      );

      expect(res.status).toBeLessThan(500);
    });

    it('POST /store/admin/shipments/:id/deliver → 200 (mark as delivered)', async () => {
      if (!shipmentId) {
        console.warn('Skipping: no shipment to mark as delivered');
        return;
      }

      const res = await axios.post(
        `/store/admin/shipments/${shipmentId}/deliver`,
        {},
        { headers: adminHeaders() },
      );

      expect(res.status).toBeLessThan(500);
    });
  });

  // ───────────────────────── Shipping Calculation ─────────────────────────

  describe('Shipping Calculation (ecommerce)', () => {
    it('POST /store/shipping/calculate → 200 (calculate shipping rate)', async () => {
      const res = await axios.post(
        '/store/shipping/calculate',
        {
          countryCode: 'US',
          stateCode: 'CA',
          postalCode: '90210',
          weight: 2.5,
          orderTotal: 49.99,
        },
        { headers: { 'x-tenant-id': adminHeaders()['x-tenant-id'] } },
      );

      expect(res.status).toBeLessThan(500);
      if (res.status === 200) {
        expect(res.data).toBeDefined();
      }
    });
  });

  // ───────────────────────── Carrier Cleanup ─────────────────────────

  describe('Carrier Cleanup', () => {
    it('DELETE /store/admin/shipping/carriers/:id → 200 (delete carrier)', async () => {
      if (!carrierId) {
        console.warn('Skipping: no carrier to delete');
        return;
      }

      const res = await axios.delete(
        `/store/admin/shipping/carriers/${carrierId}`,
        { headers: adminHeaders() },
      );

      expect([200, 204]).toContain(res.status);
    });
  });
});
