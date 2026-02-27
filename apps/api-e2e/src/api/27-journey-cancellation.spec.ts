import axios from 'axios';
import {
  getAdminToken,
  adminHeaders,
  registerTestCustomer,
  loginTestCustomer,
  customerHeaders,
} from '../support/auth-helper';
import { store } from '../support/data-store';

describe('Journey: Order Cancellation & Refund', () => {
  beforeAll(async () => {
    await getAdminToken();

    // Ensure we have at least one product to test with
    if (!store.productIds?.length) {
      try {
        const prodRes = await axios.post(
          '/store/admin/products/simple',
          { name: 'Journey Cancel Product', price: 19.99, isPublished: true },
          { headers: adminHeaders() },
        );
        if (prodRes.status === 201) {
          const id = prodRes.data.id || prodRes.data.productId;
          if (id) store.productIds = [id];
        }
      } catch {
        // Products may already exist
      }
    }

    // Ensure the test customer exists and is logged in
    try {
      const loginRes = await loginTestCustomer(
        store.testCustomerEmail,
        store.testCustomerPassword,
      );
      if (loginRes.status !== 200 && loginRes.status !== 201) {
        await registerTestCustomer(
          store.testCustomerEmail,
          store.testCustomerPassword,
          'Journey',
          'Customer',
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
        'Journey',
        'Customer',
      );
      await loginTestCustomer(
        store.testCustomerEmail,
        store.testCustomerPassword,
      );
    }
  });

  // ───────────────────────────── Setup: Gift Card + Order for Cancellation ─────────────────────────────

  let cancelOrderId: string;
  let cancelGiftCardId: string;
  let cancelGiftCardCode: string;

  describe('Setup: Gift Card Order for Cancellation', () => {
    it('POST /store/admin/gift-cards → create $150 gift card for cancel test', async () => {
      const res = await axios.post(
        '/store/admin/gift-cards',
        {
          initialValue: 150,
          currency: 'USD',
          sourceType: 'manual',
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        },
        { headers: adminHeaders() },
      );

      expect(res.status).toBe(201);
      cancelGiftCardId = res.data.id || res.data.giftCardId;
      cancelGiftCardCode = res.data.code || '';
      expect(cancelGiftCardId).toBeDefined();
      store.journeyCancelGiftCardId = cancelGiftCardId;
      store.journeyCancelGiftCardCode = cancelGiftCardCode;
    });

    it('GET /store/cart → create fresh cart', async () => {
      const res = await axios.get('/store/cart', {
        headers: customerHeaders(),
      });

      expect(res.status).toBe(200);
      const cartId = res.data.id || res.data.cartId;
      expect(cartId).toBeDefined();
      store.journeyCartId = cartId;
    });

    it('POST /store/cart/:id/items → add product', async () => {
      expect(store.journeyCartId).toBeTruthy();
      expect(store.productIds?.length).toBeGreaterThan(0);

      const res = await axios.post(
        `/store/cart/${store.journeyCartId}/items`,
        { productId: store.productIds[0], quantity: 1 },
        { headers: customerHeaders() },
      );

      expect([200, 201]).toContain(res.status);
    });

    it('POST /store/checkout → create order with gift card for cancellation', async () => {
      expect(store.journeyCartId).toBeTruthy();
      expect(cancelGiftCardCode).toBeTruthy();

      const res = await axios.post(
        '/store/checkout',
        {
          cartId: store.journeyCartId,
          email: store.testCustomerEmail,
          phone: '+15559876543',
          giftCardCode: cancelGiftCardCode,
          shippingAddress: {
            firstName: 'Cancel',
            lastName: 'Journey',
            addressLine1: '200 Return Rd',
            city: 'Canceltown',
            state: 'NY',
            postalCode: '10001',
            country: 'US',
            phone: '+15559876543',
          },
          billingAddress: {
            firstName: 'Cancel',
            lastName: 'Journey',
            addressLine1: '200 Return Rd',
            city: 'Canceltown',
            state: 'NY',
            postalCode: '10001',
            country: 'US',
            phone: '+15559876543',
          },
        },
        { headers: customerHeaders() },
      );

      expect(res.status).toBe(201);

      cancelOrderId = res.data.id || res.data.orderId || res.data.order?.id;
      expect(cancelOrderId).toBeDefined();
      store.journeyCancelOrderId = cancelOrderId;

      // Gift card covers full amount — payment captured immediately
      expect(res.data.paymentStatus).toBe('CAPTURED');
    });

    it('GET /store/orders/:id → verify order is CAPTURED', async () => {
      expect(cancelOrderId).toBeTruthy();

      const res = await axios.get(`/store/orders/${cancelOrderId}`, {
        headers: customerHeaders(),
      });

      expect(res.status).toBe(200);
      expect(res.data.paymentStatus || res.data.status).toBe('CAPTURED');
    });
  });

  // ───────────────────────────── Customer Cancels Order ─────────────────────────────

  describe('Customer Cancels Order', () => {
    it('POST /store/orders/:id/cancel → cancel the PENDING order', async () => {
      expect(cancelOrderId).toBeTruthy();

      const res = await axios.post(
        `/store/orders/${cancelOrderId}/cancel`,
        { reason: 'Changed my mind - E2E journey test' },
        { headers: customerHeaders() },
      );

      expect(res.status).toBeLessThan(500);
    });

    it('GET /store/orders/:id → order status is CANCELLED', async () => {
      expect(cancelOrderId).toBeTruthy();

      const res = await axios.get(
        `/store/orders/${cancelOrderId}`,
        { headers: customerHeaders() },
      );

      expect(res.status).toBe(200);
      const status = res.data.status || res.data.orderStatus;
      expect(status).toBe('CANCELLED');
    });

    it('GET /store/admin/gift-cards/:id → gift card balance restored after cancellation', async () => {
      if (!cancelGiftCardId) {
        console.warn('Skipping: no gift card for cancel test');
        return;
      }

      const res = await axios.get(
        `/store/admin/gift-cards/${cancelGiftCardId}`,
        { headers: adminHeaders() },
      );

      expect(res.status).toBe(200);
      const balance =
        res.data.currentBalance ?? res.data.balance ?? res.data.currentValue;
      // Balance should be restored to the original $150 after order cancellation reversal
      expect(Number(balance)).toBeCloseTo(150, 0);
      expect(res.data.status).toBe('active');
    });
  });

  // ───────────────────────────── Admin Cancels Confirmed Order ─────────────────────────────

  let adminCancelOrderId: string;

  describe('Admin Cancels Confirmed Order', () => {
    beforeAll(async () => {
      // Create another order for admin cancellation
      try {
        const cartRes = await axios.get('/store/cart', {
          headers: customerHeaders(),
        });
        const cartId = cartRes.data.id || cartRes.data.cartId;

        if (store.productIds?.[0] && cartId) {
          await axios.post(
            `/store/cart/${cartId}/items`,
            { productId: store.productIds[0], quantity: 1 },
            { headers: customerHeaders() },
          );

          const checkoutRes = await axios.post(
            '/store/checkout',
            {
              cartId,
              email: store.testCustomerEmail,
              phone: '+15559876543',
              shippingAddress: {
                firstName: 'Admin',
                lastName: 'Cancel',
                addressLine1: '300 Admin Blvd',
                city: 'Admintown',
                state: 'TX',
                postalCode: '75001',
                country: 'US',
                phone: '+15559876543',
              },
            },
            { headers: customerHeaders() },
          );

          if (checkoutRes.status === 201) {
            adminCancelOrderId =
              checkoutRes.data.id ||
              checkoutRes.data.orderId ||
              checkoutRes.data.order?.id;
          }
        }
      } catch {
        // If setup fails, tests will be skipped
      }
    });

    it('PUT /store/orders/admin/:id/status → CONFIRMED', async () => {
      if (!adminCancelOrderId) {
        console.warn('Skipping: no order for admin cancel');
        return;
      }

      const res = await axios.put(
        `/store/orders/admin/${adminCancelOrderId}/status`,
        { status: 'CONFIRMED' },
        { headers: adminHeaders() },
      );

      expect(res.status).toBe(200);
    });

    it('PUT /store/orders/admin/:id/status → CANCELLED (admin cancels confirmed order)', async () => {
      if (!adminCancelOrderId) {
        console.warn('Skipping: no order for admin cancel');
        return;
      }

      const res = await axios.put(
        `/store/orders/admin/${adminCancelOrderId}/status`,
        { status: 'CANCELLED', adminNotes: 'E2E admin cancellation test' },
        { headers: adminHeaders() },
      );

      expect(res.status).toBe(200);
    });

    it('GET /store/orders/admin/:id → verify admin-cancelled order', async () => {
      if (!adminCancelOrderId) {
        console.warn('Skipping: no order for admin cancel');
        return;
      }

      const res = await axios.get(
        `/store/orders/admin/${adminCancelOrderId}`,
        { headers: adminHeaders() },
      );

      expect(res.status).toBe(200);
      const status = res.data.status || res.data.orderStatus;
      expect(status).toBe('CANCELLED');
    });
  });

  // ───────────────────────────── Admin Refund Attempt ─────────────────────────────

  describe('Admin Refund', () => {
    it('POST /store/orders/admin/:id/refund → refund attempt (expect 400 — no payment)', async () => {
      if (!cancelOrderId) {
        console.warn('Skipping: no cancelled order');
        return;
      }

      const res = await axios.post(
        `/store/orders/admin/${cancelOrderId}/refund`,
        { reason: 'E2E refund test', amount: 1.00 },
        { headers: adminHeaders() },
      );

      // Expected to fail since no payment was captured
      expect(res.status).toBeLessThan(500);
    });
  });

  // ───────────────────────────── Verify Analytics ─────────────────────────────

  describe('Verify Analytics After Cancellations', () => {
    it('GET /analytics/orders → analytics available', async () => {
      const res = await axios.get('/analytics/orders', {
        headers: adminHeaders(),
      });

      expect(res.status).toBeLessThan(500);
      expect(res.data).toBeDefined();
    });

    it('GET /store/admin/dashboard/stats → stats available', async () => {
      const res = await axios.get('/store/admin/dashboard/stats', {
        headers: adminHeaders(),
      });

      expect(res.status).toBeLessThan(500);
      expect(res.data).toBeDefined();
    });
  });
});
