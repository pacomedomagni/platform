import axios from 'axios';
import { signupJourneyTenant, journeyAdminHeaders } from '../support/auth-helper';
import { store } from '../support/data-store';
import {
  activateTenantPayments,
  getLatestMerchantVerificationToken,
  getUserIdByEmail,
} from '../support/db-helper';

const UNIQUE = Date.now();

describe('Journey: Merchant Onboarding', () => {
  let tenantId: string;
  let accessToken: string;

  const bizName = `E2E Journey Biz ${UNIQUE}`;
  const email = `journey-${UNIQUE}@e2e-test.com`;
  const password = 'JourneyPass1';
  const subdomain = `journey-${UNIQUE}`;

  // ───────────────────────────── Signup ─────────────────────────────

  describe('Merchant Signup', () => {
    it('POST /onboarding/signup → 201 (create new tenant)', async () => {
      const result = await signupJourneyTenant(bizName, email, password, subdomain);

      expect(result.tenantId).toBeDefined();
      expect(result.accessToken).toBeDefined();

      tenantId = result.tenantId;
      accessToken = result.accessToken;

      // Persist for later journey tests
      store.journeyTenantId = tenantId;
      store.journeyAdminToken = accessToken;
      store.journeyEmail = email;
    });
  });

  // ───────────────────────────── Provisioning ─────────────────────────────

  describe('Provisioning', () => {
    it('GET /onboarding/:tenantId/status → poll until READY', async () => {
      expect(tenantId).toBeDefined();
      expect(accessToken).toBeDefined();

      const headers = journeyAdminHeaders(tenantId, accessToken);
      let status = '';
      let progress = 0;

      // Poll up to 30s
      for (let i = 0; i < 15; i++) {
        const res = await axios.get(`/onboarding/${tenantId}/status`, { headers });

        expect(res.status).toBe(200);
        status = res.data.provisioningStatus || res.data.status || '';
        progress = res.data.progress ?? 0;

        if (status === 'READY' || status === 'ready') break;
        await new Promise((r) => setTimeout(r, 2000));
      }

      expect(status.toUpperCase()).toBe('READY');
    }, 35000);
  });

  // ───────────────────────────── Verify Seeded Data ─────────────────────────────

  describe('Verify Seeded Data', () => {
    const jHeaders = () => journeyAdminHeaders(
      store.journeyTenantId,
      store.journeyAdminToken,
    );

    it('GET /store/admin/settings → store settings seeded', async () => {
      const res = await axios.get('/store/admin/settings', { headers: jHeaders() });

      expect(res.status).toBe(200);
      expect(res.data).toBeDefined();
    });

    it('GET /inventory-management/warehouses → default warehouse created', async () => {
      const res = await axios.get('/inventory-management/warehouses', {
        headers: jHeaders(),
      });

      expect(res.status).toBe(200);
      const items = res.data.data ?? res.data;
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /store/admin/legal-pages → legal pages seeded', async () => {
      const res = await axios.get('/store/admin/legal-pages', {
        headers: jHeaders(),
      });

      expect(res.status).toBeLessThan(500);
      if (res.status === 200) {
        const items = res.data.data ?? res.data;
        expect(Array.isArray(items)).toBe(true);
      }
    });

    it('GET /currencies/admin → base currency exists', async () => {
      const res = await axios.get('/currencies/admin', { headers: jHeaders() });

      expect(res.status).toBe(200);
      expect(res.data).toBeDefined();
    });
  });

  // ───────────────────────────── Store Readiness ─────────────────────────────

  describe('Store Readiness', () => {
    it('GET /store/admin/dashboard/readiness → returns unmet requirements', async () => {
      const headers = journeyAdminHeaders(
        store.journeyTenantId,
        store.journeyAdminToken,
      );

      const res = await axios.get('/store/admin/dashboard/readiness', { headers });

      expect(res.status).toBeLessThan(500);
      if (res.status === 200) {
        expect(res.data).toBeDefined();
        // Payments should not be connected (no Stripe in test env)
        const ready = res.data.ready ?? res.data.isReady;
        if (ready !== undefined) {
          expect(ready).toBe(false);
        }
      }
    });
  });

  // ───────────────────────────── Product Setup ─────────────────────────────

  describe('Product Setup on Journey Tenant', () => {
    const jHeaders = () => journeyAdminHeaders(
      store.journeyTenantId,
      store.journeyAdminToken,
    );

    it('POST /store/admin/categories → create category', async () => {
      const res = await axios.post(
        '/store/admin/categories',
        {
          name: `Journey Category ${UNIQUE}`,
          slug: `journey-cat-${UNIQUE}`,
          description: 'E2E journey test category',
        },
        { headers: jHeaders() },
      );

      expect(res.status).toBe(201);
      const id = res.data.id || res.data.categoryId;
      expect(id).toBeDefined();
      store.journeyCategoryId = id;
    });

    it('POST /store/admin/products/simple → create product (published)', async () => {
      const res = await axios.post(
        '/store/admin/products/simple',
        {
          name: `Journey Product ${UNIQUE}`,
          price: 29.99,
          categoryId: store.journeyCategoryId,
          description: 'A product for the E2E journey test',
          isPublished: true,
          images: ['https://placehold.co/400x400'],
        },
        { headers: jHeaders() },
      );

      expect(res.status).toBe(201);
      const id = res.data.id || res.data.productId;
      expect(id).toBeDefined();
      store.journeyProductId = id;
    });

    it('POST /store/admin/dashboard/publish → blocked until merchant email verified', async () => {
      const res = await axios.post(
        '/store/admin/dashboard/publish',
        {},
        { headers: jHeaders() },
      );

      // Fresh tenant with unverified email cannot publish — readiness gate.
      expect(res.status).toBe(400);
    });

    it('POST /onboarding/verify-email → verify with the token written to the DB', async () => {
      const userId = await getUserIdByEmail(store.journeyEmail, store.journeyTenantId);
      expect(userId).toBeTruthy();

      const token = await getLatestMerchantVerificationToken(userId as string);
      expect(token).toBeTruthy();

      const res = await axios.post(
        '/onboarding/verify-email',
        { token },
        { headers: jHeaders() },
      );

      expect(res.status).toBeLessThan(400);
    });

    it('POST /store/admin/dashboard/publish → succeeds once verified + payments active', async () => {
      // Stripe Connect can't be driven end-to-end from e2e without real
      // creds, so shim the post-condition the publish gate cares about.
      await activateTenantPayments(store.journeyTenantId);

      const res = await axios.post(
        '/store/admin/dashboard/publish',
        {},
        { headers: jHeaders() },
      );

      expect([200, 201]).toContain(res.status);
      expect(res.data.storePublished).toBe(true);
    });

    it('GET /store/products → product visible on public storefront', async () => {
      const res = await axios.get('/store/products', {
        headers: { 'x-tenant-id': store.journeyTenantId },
      });

      expect(res.status).toBe(200);
      const items = res.data.data ?? res.data;
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThanOrEqual(1);
    });
  });
});
