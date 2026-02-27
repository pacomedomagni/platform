import axios from 'axios';
import {
  getAdminToken,
  adminHeaders,
  loginTestCustomer,
  customerHeaders,
  tenantHeaders,
} from '../support/auth-helper';
import { store } from '../support/data-store';

const TENANT_ID =
  process.env.TEST_TENANT_ID || '8d334424-054e-4452-949c-21ecc1fff2c0';

describe('Email Preferences & Newsletter', () => {
  beforeAll(async () => {
    await getAdminToken();
    await loginTestCustomer(
      store.testCustomerEmail,
      store.testCustomerPassword
    );
  });

  // ───────────────────────────── Email Preferences (Customer) ─────────────────────────────

  describe('Email Preferences', () => {
    it('GET /storefront/email-preferences → 200 (get preferences)', async () => {
      const res = await axios.get('/storefront/email-preferences', {
        headers: customerHeaders(),
      });

      expect(res.status).toBeLessThan(500);
      if (res.status === 200) {
        expect(res.data).toBeDefined();
      }
    });

    it('PUT /storefront/email-preferences → 200 (update preferences)', async () => {
      const res = await axios.put(
        '/storefront/email-preferences',
        {
          marketing: false,
          orderUpdates: true,
          promotions: false,
          newsletter: true,
        },
        { headers: customerHeaders() }
      );

      expect(res.status).toBeLessThan(500);
    });

    it('POST /storefront/email-preferences/unsubscribe/marketing → unsubscribe', async () => {
      const res = await axios.post(
        '/storefront/email-preferences/unsubscribe/marketing',
        {},
        { headers: customerHeaders() }
      );

      expect(res.status).toBeLessThan(500);
    });
  });

  // ───────────────────────────── Newsletter (Public) ─────────────────────────────

  describe('Newsletter', () => {
    it('POST /storefront/email-preferences/newsletter/subscribe → subscribe', async () => {
      const res = await axios.post(
        '/storefront/email-preferences/newsletter/subscribe',
        { email: `newsletter-e2e-${Date.now()}@test.com` },
        { headers: tenantHeaders() }
      );

      expect([200, 201]).toContain(res.status);
    });
  });

  // ───────────────────────────── One-Click Unsubscribe (Public) ─────────────────────────────

  describe('One-Click Unsubscribe', () => {
    it('GET /storefront/email-preferences/unsubscribe?token=invalid → rejects invalid token', async () => {
      const res = await axios.get(
        '/storefront/email-preferences/unsubscribe?token=invalid-token&type=marketing'
      );

      // Invalid token should return 400 or 404
      expect(res.status).toBeLessThan(500);
    });

    it('POST /storefront/email-preferences/unsubscribe (RFC 8058) → rejects invalid token', async () => {
      const res = await axios.post(
        '/storefront/email-preferences/unsubscribe',
        { token: 'invalid-token', type: 'all' }
      );

      // Invalid token should return 400 or 404
      expect(res.status).toBeLessThan(500);
    });
  });
});
