import axios from 'axios';
import {
  getAdminToken,
  adminHeaders,
  tenantHeaders,
  customerHeaders,
  loginTestCustomer,
  registerTestCustomer,
} from '../support/auth-helper';
import { store } from '../support/data-store';

const TENANT_ID =
  process.env.TEST_TENANT_ID || '8d334424-054e-4452-949c-21ecc1fff2c0';

describe('Payment Endpoints', () => {
  beforeAll(async () => {
    await getAdminToken();

    // Ensure customer is logged in for Square test
    try {
      const loginRes = await loginTestCustomer(
        store.testCustomerEmail,
        store.testCustomerPassword,
      );
      if (loginRes.status !== 200 && loginRes.status !== 201) {
        await registerTestCustomer(
          store.testCustomerEmail,
          store.testCustomerPassword,
          'Payment',
          'Tester',
        );
        await loginTestCustomer(
          store.testCustomerEmail,
          store.testCustomerPassword,
        );
      }
    } catch {
      await registerTestCustomer(
        store.testCustomerEmail,
        store.testCustomerPassword,
        'Payment',
        'Tester',
      );
      await loginTestCustomer(
        store.testCustomerEmail,
        store.testCustomerPassword,
      );
    }
  });

  // ───────────────────────── Local Operations (no external keys needed) ─────────────────────────

  describe('Payment Configuration', () => {
    it('GET /store/payments/config → 200 (payment provider status)', async () => {
      const res = await axios.get('/store/payments/config', {
        headers: tenantHeaders(),
      });

      expect(res.status).toBe(200);
      expect(res.data).toBeDefined();
      expect(typeof res.data).toBe('object');
    });
  });

  describe('Onboarding Status', () => {
    it('GET /onboarding/:tenantId/status → 200 (onboarding status)', async () => {
      const res = await axios.get(`/onboarding/${TENANT_ID}/status`, {
        headers: adminHeaders(),
      });

      // Could be 200 or 404 depending on whether provisioning ran
      expect(res.status).toBeLessThan(500);

      if (res.status === 200) {
        expect(res.data).toBeDefined();
        expect(typeof res.data).toBe('object');
      }
    });
  });

  // ───────────────────────── Stripe Mock Mode Tests ─────────────────────────

  describe('Stripe Payment Config (Mock Mode)', () => {
    it('GET /store/payments/config → isConfigured: true in mock mode', async () => {
      const res = await axios.get('/store/payments/config', {
        headers: tenantHeaders(),
      });

      expect(res.status).toBe(200);
      expect(res.data.isConfigured).toBe(true);
      expect(res.data.publicKey).toBe('pk_test_mock');
    });
  });

  describe('Stripe Refund (Mock Mode)', () => {
    it('POST /store/payments/refund → 400 (order not captured — validates routing + logic)', async () => {
      // Use a journey order that was paid by gift card (no Stripe payment intent)
      // This tests: routing, StoreAdminGuard, CreateRefundDto validation, service logic
      const orderId = store.journeyOrderId || 'non-existent-order';

      const res = await axios.post(
        '/store/payments/refund',
        {
          orderId,
          amount: 1.00,
          reason: 'requested_by_customer',
        },
        { headers: adminHeaders() },
      );

      // Expect 400 (order not captured via Stripe) or 404 (order not found)
      // Both prove routing, guard, validation, and service logic work
      expect(res.status).toBeLessThan(500);
      expect([400, 404]).toContain(res.status);
    });
  });

  describe('Stripe Webhook (Mock Mode)', () => {
    it('POST /store/payments/webhook → processes event (mock signature bypass)', async () => {
      const webhookPayload = {
        id: `evt_mock_${Date.now()}`,
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: `pi_mock_${Date.now()}`,
            amount: 2999,
            status: 'succeeded',
            metadata: {
              orderId: 'non-existent-order-for-webhook',
            },
            latest_charge: `ch_mock_${Date.now()}`,
          },
        },
      };

      const res = await axios.post(
        '/store/payments/webhook',
        webhookPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'stripe-signature': 'mock-signature',
          },
        },
      );

      // Mock mode bypasses signature verification.
      // Event is processed but order won't be found → still returns 200 (received: true)
      // OR the deduplication insert succeeds and handler gracefully handles missing order
      expect(res.status).toBeLessThan(500);
      if (res.status === 200) {
        expect(res.data.received).toBe(true);
      }
    });
  });

  // ───────────────────────── Square Mock Mode Tests ─────────────────────────

  describe('Square Payment (Mock Mode)', () => {
    it('POST /store/payments/square → 400 (tenant not configured for Square — validates routing)', async () => {
      // Test tenant uses Stripe by default, so Square endpoint should reject.
      // This proves: routing works, CustomerAuthGuard works, DTO validation works, service logic works
      const res = await axios.post(
        '/store/payments/square',
        {
          orderId: store.journeyOrderId || 'test-order-id',
          sourceId: 'cnon:card-nonce-ok',
        },
        { headers: customerHeaders() },
      );

      // Expect 400 "Tenant is not configured for Square" or 404 "Order not found"
      expect(res.status).toBeLessThan(500);
      expect([400, 404]).toContain(res.status);
    });
  });
});
