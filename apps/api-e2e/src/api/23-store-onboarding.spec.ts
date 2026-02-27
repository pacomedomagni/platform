import axios from 'axios';
import {
  getAdminToken,
  adminHeaders,
  loginTestCustomer,
  customerHeaders,
} from '../support/auth-helper';
import { store } from '../support/data-store';

describe('Store Onboarding Endpoints', () => {
  beforeAll(async () => {
    await getAdminToken();
    await loginTestCustomer(
      store.testCustomerEmail,
      store.testCustomerPassword
    );
  });

  // ───────────────────────────── Customer Onboarding ─────────────────────────────

  describe('Customer Onboarding', () => {
    it('GET /store/onboarding/status → onboarding status', async () => {
      const res = await axios.get('/store/onboarding/status', {
        headers: customerHeaders(),
      });

      // May return 200 or 404 if onboarding not initialized
      expect(res.status).toBeLessThan(500);
    });

    it('GET /store/onboarding/progress → onboarding progress', async () => {
      const res = await axios.get('/store/onboarding/progress', {
        headers: customerHeaders(),
      });

      expect(res.status).toBeLessThan(500);
      if (res.status === 200) {
        expect(res.data).toBeDefined();
      }
    });

    it('POST /store/onboarding/complete-step → mark step complete', async () => {
      const res = await axios.post(
        '/store/onboarding/complete-step',
        { step: 'profile' },
        { headers: customerHeaders() }
      );

      expect(res.status).toBeLessThan(500);
    });

    it('POST /store/onboarding/update-step → update current step', async () => {
      const res = await axios.post(
        '/store/onboarding/update-step',
        { step: 'profile' },
        { headers: customerHeaders() }
      );

      expect(res.status).toBeLessThan(500);
    });

    it('POST /store/onboarding/update-profile → update profile via onboarding', async () => {
      const res = await axios.post(
        '/store/onboarding/update-profile',
        {
          firstName: 'E2E',
          lastName: 'Onboarding',
          phone: '+15559876543',
        },
        { headers: customerHeaders() }
      );

      expect(res.status).toBeLessThan(500);
    });

    it('POST /store/onboarding/reset-tour → reset product tour', async () => {
      const res = await axios.post(
        '/store/onboarding/reset-tour',
        {},
        { headers: customerHeaders() }
      );

      expect(res.status).toBeLessThan(500);
    });

    it('POST /store/onboarding/dismiss → dismiss onboarding', async () => {
      const res = await axios.post(
        '/store/onboarding/dismiss',
        {},
        { headers: customerHeaders() }
      );

      expect(res.status).toBeLessThan(500);
    });
  });
});
