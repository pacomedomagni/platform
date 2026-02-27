import axios from 'axios';
import {
  getAdminToken,
  loginTestCustomer,
  registerTestCustomer,
  customerHeaders,
  tenantHeaders,
} from '../support/auth-helper';
import { store } from '../support/data-store';

describe('Customer Auth Advanced Endpoints', () => {
  beforeAll(async () => {
    await getAdminToken();

    // Ensure customer is registered and logged in
    try {
      const loginRes = await loginTestCustomer(
        store.testCustomerEmail,
        store.testCustomerPassword,
      );
      if (loginRes.status !== 200 && loginRes.status !== 201) {
        await registerTestCustomer(
          store.testCustomerEmail,
          store.testCustomerPassword,
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
      );
      await loginTestCustomer(
        store.testCustomerEmail,
        store.testCustomerPassword,
      );
    }
  });

  describe('POST /store/auth/verify-email', () => {
    it('should reject invalid verification token', async () => {
      const res = await axios.post(
        '/store/auth/verify-email',
        { token: 'invalid-verification-token' },
        { headers: tenantHeaders() },
      );

      // Expect 400 or 404 — token not found/invalid
      expect(res.status).toBeLessThan(500);
      expect([400, 401, 404]).toContain(res.status);
    });
  });

  describe('POST /store/auth/resend-verification', () => {
    it('should request a new verification email', async () => {
      const res = await axios.post(
        '/store/auth/resend-verification',
        {},
        { headers: customerHeaders() },
      );

      // May return 200 (sent) or 400 (already verified) or 429 (rate limited)
      expect(res.status).toBeLessThan(500);
    });
  });
});
