import axios from 'axios';
import {
  getAdminToken,
  adminHeaders,
  registerTestCustomer,
  loginTestCustomer,
  customerHeaders,
  getCustomerId,
} from '../support/auth-helper';
import { store } from '../support/data-store';

describe('Customer Endpoints', () => {
  beforeAll(async () => {
    await getAdminToken();
  });

  // ─── Registration & Auth ───────────────────────────────────────────

  describe('Customer Registration & Auth', () => {
    describe('POST /store/auth/register', () => {
      it('should register a new customer and return 201', async () => {
        const res = await registerTestCustomer(
          store.testCustomerEmail,
          store.testCustomerPassword
        );

        expect(res.status).toBe(201);
        expect(res.data).toBeDefined();
        // Response format: {customer: {...}, token: "..."}
        if (res.data.customer?.id) {
          store.testCustomerId = res.data.customer.id;
        } else if (res.data.id) {
          store.testCustomerId = res.data.id;
        }
      });

      it('should handle duplicate email registration gracefully', async () => {
        const res = await registerTestCustomer(
          store.testCustomerEmail,
          store.testCustomerPassword
        );

        // API returns 201 with customer: null to prevent email enumeration
        // OR could return 400/409 depending on implementation
        expect(res.status).toBeLessThan(500);

        // If 201, the customer field should be null (duplicate)
        if (res.status === 201 && res.data.customer === null) {
          expect(res.data.token).toBeNull();
        }
      });
    });

    describe('POST /store/auth/login', () => {
      it('should login the customer and return 201 with token', async () => {
        const res = await loginTestCustomer(
          store.testCustomerEmail,
          store.testCustomerPassword
        );

        expect(res.status).toBe(201);
        // Response uses 'token' not 'access_token'
        expect(res.data).toHaveProperty('token');
        expect(typeof res.data.token).toBe('string');

        // Capture the customer ID if returned in the login response
        if (res.data.customer?.id) {
          store.testCustomerId = res.data.customer.id;
        }
      });
    });

    describe('GET /store/auth/me', () => {
      it('should return 200 with the authenticated customer profile', async () => {
        const res = await axios.get('/store/auth/me', {
          headers: customerHeaders(),
        });

        expect(res.status).toBe(200);
        expect(res.data).toBeDefined();
        expect(typeof res.data).toBe('object');

        // Capture customer ID from the profile if not yet stored
        if (res.data.id && !store.testCustomerId) {
          store.testCustomerId = res.data.id;
        }

        // Verify email matches
        if (res.data.email) {
          expect(res.data.email).toBe(store.testCustomerEmail);
        }
      });
    });

    describe('PUT /store/auth/me', () => {
      it('should update the customer profile and return 200', async () => {
        const res = await axios.put(
          '/store/auth/me',
          {
            firstName: 'Updated',
            lastName: 'Customer',
          },
          { headers: customerHeaders() }
        );

        expect(res.status).toBe(200);
        expect(res.data).toBeDefined();

        if (res.data.firstName) {
          expect(res.data.firstName).toBe('Updated');
        }
        if (res.data.lastName) {
          expect(res.data.lastName).toBe('Customer');
        }
      });
    });

    describe('POST /store/auth/change-password', () => {
      it('should change the customer password and return 200 or 201', async () => {
        const newPassword = 'NewTestPass456!';

        const res = await axios.post(
          '/store/auth/change-password',
          {
            currentPassword: store.testCustomerPassword,
            newPassword,
          },
          { headers: customerHeaders() }
        );

        // POST endpoints in NestJS return 201 by default
        expect([200, 201]).toContain(res.status);

        // Update stored password so subsequent tests use the new one
        store.testCustomerPassword = newPassword;

        // Re-login with the new password to verify it works and refresh the token
        const loginRes = await loginTestCustomer(
          store.testCustomerEmail,
          store.testCustomerPassword
        );
        expect(loginRes.status).toBe(201);
        expect(loginRes.data).toHaveProperty('token');
      });
    });
  });

  // ─── Address Management ────────────────────────────────────────────

  describe('Address Management', () => {
    let secondAddressId: string;

    describe('POST /store/auth/addresses', () => {
      it('should add a shipping address and return 201', async () => {
        const res = await axios.post(
          '/store/auth/addresses',
          {
            label: 'Home',
            firstName: 'Updated',
            lastName: 'Customer',
            addressLine1: '123 Test Street',
            addressLine2: 'Apt 4B',
            city: 'Testville',
            state: 'CA',
            postalCode: '90210',
            country: 'US',
            phone: '+15551234567',
            isDefault: true,
          },
          { headers: customerHeaders() }
        );

        expect(res.status).toBe(201);
        expect(res.data).toBeDefined();

        const addressId = res.data.id || res.data.addressId;
        expect(addressId).toBeDefined();
        store.addressId = addressId;
      });

      it('should add a second address', async () => {
        const res = await axios.post(
          '/store/auth/addresses',
          {
            label: 'Work',
            firstName: 'Updated',
            lastName: 'Customer',
            addressLine1: '456 Office Blvd',
            city: 'Worktown',
            state: 'NY',
            postalCode: '10001',
            country: 'US',
          },
          { headers: customerHeaders() }
        );

        expect(res.status).toBe(201);
        expect(res.data).toBeDefined();
        secondAddressId = res.data.id || res.data.addressId;
      });
    });

    describe('GET /store/auth/addresses', () => {
      it('should list customer addresses and return 200', async () => {
        const res = await axios.get('/store/auth/addresses', {
          headers: customerHeaders(),
        });

        expect(res.status).toBe(200);

        const addresses = Array.isArray(res.data)
          ? res.data
          : res.data.data || res.data.addresses || [];
        expect(addresses.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe('PUT /store/auth/addresses/:id', () => {
      it('should update an address and return 200', async () => {
        expect(store.addressId).toBeTruthy();

        const res = await axios.put(
          `/store/auth/addresses/${store.addressId}`,
          {
            addressLine1: '789 Updated Ave',
            city: 'Newtown',
          },
          { headers: customerHeaders() }
        );

        expect(res.status).toBe(200);
        expect(res.data).toBeDefined();
      });
    });

    describe('DELETE /store/auth/addresses/:id', () => {
      it('should delete the second address and return 200', async () => {
        expect(secondAddressId).toBeDefined();

        const res = await axios.delete(
          `/store/auth/addresses/${secondAddressId}`,
          { headers: customerHeaders() }
        );

        expect([200, 204]).toContain(res.status);
      });
    });
  });

  // ─── Admin Customer Management ─────────────────────────────────────

  describe('Admin Customer Management', () => {
    describe('GET /store/admin/customers', () => {
      it('should list all customers and return 200', async () => {
        const res = await axios.get('/store/admin/customers', {
          headers: adminHeaders(),
        });

        expect(res.status).toBe(200);
        expect(res.data).toBeDefined();

        const customers = Array.isArray(res.data)
          ? res.data
          : res.data.data || res.data.customers || [];
        expect(customers.length).toBeGreaterThanOrEqual(1);

        if (!store.testCustomerId) {
          const match = customers.find(
            (c: any) => c.email === store.testCustomerEmail
          );
          if (match) {
            store.testCustomerId = match.id;
          }
        }
      });
    });

    describe('GET /store/admin/customers/:id', () => {
      it('should return 200 with customer details', async () => {
        expect(store.testCustomerId).toBeTruthy();

        const res = await axios.get(
          `/store/admin/customers/${store.testCustomerId}`,
          { headers: adminHeaders() }
        );

        expect(res.status).toBe(200);
        expect(res.data).toBeDefined();
        expect(typeof res.data).toBe('object');
      });
    });

    describe('PUT /store/admin/customers/:id', () => {
      it('should update customer notes and return 200', async () => {
        expect(store.testCustomerId).toBeTruthy();

        const res = await axios.put(
          `/store/admin/customers/${store.testCustomerId}`,
          { notes: 'VIP test customer - created by E2E suite' },
          { headers: adminHeaders() }
        );

        expect(res.status).toBe(200);
        expect(res.data).toBeDefined();
      });
    });

    describe('PUT /store/admin/customers/:id/notes', () => {
      it('should update customer notes via dedicated endpoint', async () => {
        expect(store.testCustomerId).toBeTruthy();

        const res = await axios.put(
          `/store/admin/customers/${store.testCustomerId}/notes`,
          { notes: 'Updated notes via dedicated endpoint' },
          { headers: adminHeaders() }
        );

        expect(res.status).toBe(200);
        expect(res.data).toBeDefined();
      });
    });

    describe('GET /store/admin/customers/:id/orders', () => {
      it('should return customer orders and return 200', async () => {
        expect(store.testCustomerId).toBeTruthy();

        const res = await axios.get(
          `/store/admin/customers/${store.testCustomerId}/orders`,
          { headers: adminHeaders() }
        );

        expect(res.status).toBe(200);
        expect(res.data).toBeDefined();
      });
    });
  });

  // ─── Password Recovery (smoke tests) ─────────────────────────────

  describe('Password Recovery', () => {
    describe('POST /store/auth/forgot-password', () => {
      it('should accept forgot-password request and return 201', async () => {
        const res = await axios.post('/store/auth/forgot-password', {
          email: store.testCustomerEmail,
        });

        // Should succeed without error; actual email may not be sent in test env
        expect([200, 201]).toContain(res.status);
      });
    });

    describe('POST /store/auth/reset-password', () => {
      it('should reject invalid reset token with 400 or 401', async () => {
        const res = await axios.post('/store/auth/reset-password', {
          token: 'invalid-reset-token-e2e',
          newPassword: 'ShouldNotWork123!',
        });

        // Token is invalid so expect 400 or 401
        expect([400, 401, 404]).toContain(res.status);
      });
    });
  });
});
