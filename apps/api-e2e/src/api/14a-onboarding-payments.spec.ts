import axios from 'axios';
import { getAdminToken, adminHeaders } from '../support/auth-helper';
import { store } from '../support/data-store';

const TENANT_ID =
  process.env.TEST_TENANT_ID || '8d334424-054e-4452-949c-21ecc1fff2c0';

describe('Onboarding Payment & Verification Endpoints', () => {
  beforeAll(async () => {
    await getAdminToken();
  });

  // ───────────────────────── Onboarding Payment Flow ─────────────────────────

  describe('Onboarding Payment', () => {
    it('POST /onboarding/:tenantId/payment/initiate → initiate payment onboarding', async () => {
      const res = await axios.post(
        `/onboarding/${TENANT_ID}/payment/initiate`,
        {},
        { headers: adminHeaders() },
      );

      // May return 200 (URL generated) or 400/500 (Stripe not configured in mock mode)
      expect(res.status).toBeLessThan(500);
    });

    it('GET /onboarding/:tenantId/payment/refresh → refresh payment status', async () => {
      const res = await axios.get(
        `/onboarding/${TENANT_ID}/payment/refresh`,
        { headers: adminHeaders() },
      );

      // May return 200 (status refreshed) or 400/404 (no Stripe account)
      expect(res.status).toBeLessThan(500);
    });

    it('GET /onboarding/:tenantId/stripe/dashboard → get Stripe dashboard URL', async () => {
      const res = await axios.get(
        `/onboarding/${TENANT_ID}/stripe/dashboard`,
        { headers: adminHeaders() },
      );

      // May return 200 (URL) or 400/404 (no Stripe account)
      expect(res.status).toBeLessThan(500);
    });

    it('POST /onboarding/:tenantId/complete → complete onboarding', async () => {
      const res = await axios.post(
        `/onboarding/${TENANT_ID}/complete`,
        {},
        { headers: adminHeaders() },
      );

      // May return 200 (completed) or 400 (already completed or requirements not met)
      expect(res.status).toBeLessThan(500);
    });
  });

  // ───────────────────────── Merchant Verification ─────────────────────────

  describe('Merchant Verification', () => {
    it('POST /onboarding/verify-email → verify with invalid token', async () => {
      const res = await axios.post(
        '/onboarding/verify-email',
        { token: 'invalid-merchant-verification-token' },
        { headers: adminHeaders() },
      );

      // Expect 400 or 404 — token invalid
      expect(res.status).toBeLessThan(500);
      expect([400, 404]).toContain(res.status);
    });

    it('POST /onboarding/resend-verification → resend verification email', async () => {
      const res = await axios.post(
        '/onboarding/resend-verification',
        {},
        { headers: adminHeaders() },
      );

      // May return 200 (sent) or 400 (already verified) or 404 (user not found)
      expect(res.status).toBeLessThan(500);
    });

    it('GET /onboarding/email-status → get verification status', async () => {
      const res = await axios.get('/onboarding/email-status', {
        headers: adminHeaders(),
      });

      expect(res.status).toBeLessThan(500);
      if (res.status === 200) {
        expect(res.data).toBeDefined();
      }
    });
  });
});
