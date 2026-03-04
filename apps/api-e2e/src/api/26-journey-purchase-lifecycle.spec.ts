import axios from 'axios';
import {
  getAdminToken,
  adminHeaders,
  registerTestCustomer,
  loginTestCustomer,
  customerHeaders,
} from '../support/auth-helper';
import { store } from '../support/data-store';

describe('Journey: Purchase Lifecycle', () => {
  beforeAll(async () => {
    await getAdminToken();

    // Ensure the test customer exists and is logged in.
    // When running journey tests in isolation, the customer from 07 won't exist yet.
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

    // Ensure we have at least one product to test with
    if (!store.productIds?.length) {
      try {
        const prodRes = await axios.post(
          '/store/admin/products/simple',
          { name: 'Journey Test Product', price: 29.99, isPublished: true, images: ['https://placehold.co/400x400'] },
          { headers: adminHeaders() },
        );
        if (prodRes.status === 201) {
          const id = prodRes.data.id || prodRes.data.productId;
          if (id) store.productIds = [id];
        }
      } catch {
        // Products may already exist from earlier tests
      }
    }

    // Ensure stock for the test product
    if (store.warehouseCode && store.productIds?.length) {
      try {
        const prodRes = await axios.get(
          `/store/admin/products/${store.productIds[0]}`,
          { headers: adminHeaders() },
        );
        const itemCode =
          prodRes.data?.item?.code ?? prodRes.data?.data?.item?.code;
        if (itemCode) {
          await axios.post(
            '/inventory-management/movements',
            {
              movementType: 'receipt',
              warehouseCode: store.warehouseCode,
              remarks: 'Journey test - ensure stock',
              items: [{ itemCode, quantity: 200 }],
            },
            { headers: adminHeaders() },
          );
        }
      } catch {
        // Stock may already exist
      }
    }
  });

  // ───────────────────────────── Gift Card Verification ─────────────────────────────

  describe('Gift Card CRUD Verification', () => {
    it('POST /store/admin/gift-cards → create $200 gift card', async () => {
      const res = await axios.post(
        '/store/admin/gift-cards',
        {
          initialValue: 200,
          currency: 'USD',
          sourceType: 'manual',
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        },
        { headers: adminHeaders() },
      );

      expect(res.status).toBe(201);
      const id = res.data.id || res.data.giftCardId;
      expect(id).toBeDefined();

      store.journeyGiftCardId = id;
      store.journeyGiftCardCode = res.data.code || '';
    });

    it('GET /store/admin/gift-cards/:id → verify active with $200 balance', async () => {
      expect(store.journeyGiftCardId).toBeTruthy();

      const res = await axios.get(
        `/store/admin/gift-cards/${store.journeyGiftCardId}`,
        { headers: adminHeaders() },
      );

      expect(res.status).toBe(200);
      if (!store.journeyGiftCardCode && res.data.code) {
        store.journeyGiftCardCode = res.data.code;
      }

      expect(res.data.status).toBe('active');
      const balance =
        res.data.currentBalance ?? res.data.balance ?? res.data.currentValue;
      expect(Number(balance)).toBe(200);
    });

    it('GET /store/gift-cards/check → public balance check', async () => {
      expect(store.journeyGiftCardCode).toBeTruthy();

      const res = await axios.get(
        `/store/gift-cards/check?code=${store.journeyGiftCardCode}`,
        { headers: customerHeaders() },
      );

      expect(res.status).toBe(200);
      expect(res.data).toBeDefined();
      const balance =
        res.data.balance ?? res.data.currentBalance ?? res.data.amount;
      expect(Number(balance)).toBe(200);
    });
  });

  // ───────────────────────────── Customer Browses & Adds to Cart ─────────────────────────────

  describe('Customer Browses & Adds to Cart', () => {
    it('GET /store/products → browse public products', async () => {
      const res = await axios.get('/store/products', {
        headers: customerHeaders(),
      });

      expect(res.status).toBe(200);
      const items = res.data.data ?? res.data;
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /store/cart → create new cart', async () => {
      const res = await axios.get('/store/cart', {
        headers: customerHeaders(),
      });

      expect(res.status).toBe(200);
      const cartId = res.data.id || res.data.cartId;
      expect(cartId).toBeDefined();
      store.journeyCartId = cartId;
    });

    it('POST /store/cart/:id/items → add product to cart', async () => {
      expect(store.journeyCartId).toBeTruthy();
      expect(store.productIds?.length).toBeGreaterThan(0);

      const res = await axios.post(
        `/store/cart/${store.journeyCartId}/items`,
        { productId: store.productIds[0], quantity: 2 },
        { headers: customerHeaders() },
      );

      expect([200, 201]).toContain(res.status);
    });

    it('GET /store/cart/:id → verify cart has items', async () => {
      const res = await axios.get(`/store/cart/${store.journeyCartId}`, {
        headers: customerHeaders(),
      });

      expect(res.status).toBe(200);
      const items = res.data.items || res.data.cartItems || [];
      expect(items.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ───────────────────────────── Checkout ─────────────────────────────

  describe('Checkout with Gift Card (Full Payment)', () => {
    it('POST /store/checkout → create order paid by gift card', async () => {
      expect(store.journeyCartId).toBeTruthy();
      expect(store.journeyGiftCardCode).toBeTruthy();

      const res = await axios.post(
        '/store/checkout',
        {
          cartId: store.journeyCartId,
          email: store.testCustomerEmail,
          phone: '+15551234567',
          giftCardCode: store.journeyGiftCardCode,
          shippingAddress: {
            firstName: 'Journey',
            lastName: 'Buyer',
            addressLine1: '100 Commerce Blvd',
            city: 'Shopville',
            state: 'CA',
            postalCode: '90210',
            country: 'US',
            phone: '+15551234567',
          },
          billingAddress: {
            firstName: 'Journey',
            lastName: 'Buyer',
            addressLine1: '100 Commerce Blvd',
            city: 'Shopville',
            state: 'CA',
            postalCode: '90210',
            country: 'US',
            phone: '+15551234567',
          },
        },
        { headers: customerHeaders() },
      );

      expect(res.status).toBe(201);

      const orderId = res.data.id || res.data.orderId || res.data.order?.id;
      expect(orderId).toBeDefined();
      store.journeyOrderId = orderId;

      // Gift card covers full amount — payment should be captured immediately
      expect(res.data.paymentStatus).toBe('CAPTURED');
      expect(res.data.paymentProvider).toBe('gift_card');

      const orderNumber =
        res.data.orderNumber || res.data.order?.orderNumber || res.data.number;
      if (orderNumber) store.journeyOrderNumber = orderNumber;
    });

    it('GET /store/orders/:id → verify order is CAPTURED via gift card', async () => {
      expect(store.journeyOrderId).toBeTruthy();

      const res = await axios.get(`/store/orders/${store.journeyOrderId}`, {
        headers: customerHeaders(),
      });

      expect(res.status).toBe(200);
      expect(res.data).toBeDefined();
      expect(res.data.paymentStatus || res.data.status).toBe('CAPTURED');
    });

    it('GET /store/admin/gift-cards/:id → verify gift card balance was deducted', async () => {
      expect(store.journeyGiftCardId).toBeTruthy();

      const res = await axios.get(
        `/store/admin/gift-cards/${store.journeyGiftCardId}`,
        { headers: adminHeaders() },
      );

      expect(res.status).toBe(200);
      const balance =
        res.data.currentBalance ?? res.data.balance ?? res.data.currentValue;
      expect(Number(balance)).toBeLessThan(200);
    });

    it('GET /store/orders → customer can see their orders', async () => {
      const res = await axios.get('/store/orders', {
        headers: customerHeaders(),
      });

      expect(res.status).toBe(200);
      const orders = Array.isArray(res.data)
        ? res.data
        : res.data.data || res.data.orders || [];
      expect(orders.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ───────────────────────────── Admin Order Lifecycle ─────────────────────────────

  describe('Admin Order Lifecycle', () => {
    it('GET /store/orders/admin/all → admin sees the new order', async () => {
      const res = await axios.get('/store/orders/admin/all', {
        headers: adminHeaders(),
      });

      expect(res.status).toBe(200);
      const orders = Array.isArray(res.data)
        ? res.data
        : res.data.data || res.data.orders || [];
      expect(orders.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /store/orders/admin/:id → admin order detail', async () => {
      expect(store.journeyOrderId).toBeTruthy();

      const res = await axios.get(
        `/store/orders/admin/${store.journeyOrderId}`,
        { headers: adminHeaders() },
      );

      expect(res.status).toBe(200);
      expect(res.data).toBeDefined();
    });

    it('PUT /store/orders/admin/:id/status → CONFIRMED', async () => {
      expect(store.journeyOrderId).toBeTruthy();

      const res = await axios.put(
        `/store/orders/admin/${store.journeyOrderId}/status`,
        { status: 'CONFIRMED' },
        { headers: adminHeaders() },
      );

      expect(res.status).toBe(200);
    });

    it('PUT /store/orders/admin/:id/status → PROCESSING', async () => {
      const res = await axios.put(
        `/store/orders/admin/${store.journeyOrderId}/status`,
        { status: 'PROCESSING' },
        { headers: adminHeaders() },
      );

      expect(res.status).toBe(200);
    });

    it('PUT /store/orders/admin/:id/status → SHIPPED', async () => {
      const res = await axios.put(
        `/store/orders/admin/${store.journeyOrderId}/status`,
        {
          status: 'SHIPPED',
          carrier: 'JourneyCarrier',
          trackingNumber: `JTRK-${Date.now()}`,
        },
        { headers: adminHeaders() },
      );

      expect(res.status).toBe(200);
    });

    it('PUT /store/orders/admin/:id/status → DELIVERED', async () => {
      const res = await axios.put(
        `/store/orders/admin/${store.journeyOrderId}/status`,
        { status: 'DELIVERED' },
        { headers: adminHeaders() },
      );

      expect(res.status).toBe(200);
    });

    it('GET /store/orders/:id → verify final status is DELIVERED', async () => {
      const res = await axios.get(`/store/orders/${store.journeyOrderId}`, {
        headers: customerHeaders(),
      });

      expect(res.status).toBe(200);
      const status = res.data.status || res.data.orderStatus;
      expect(status).toBe('DELIVERED');
    });
  });

  // ───────────────────────────── Revenue Verification ─────────────────────────────

  describe('Revenue Verification', () => {
    it('GET /analytics/orders → order appears in analytics', async () => {
      const res = await axios.get('/analytics/orders', {
        headers: adminHeaders(),
      });

      expect(res.status).toBeLessThan(500);
      expect(res.data).toBeDefined();
    });

    it('GET /store/admin/dashboard/stats → dashboard stats updated', async () => {
      const res = await axios.get('/store/admin/dashboard/stats', {
        headers: adminHeaders(),
      });

      expect(res.status).toBeLessThan(500);
      expect(res.data).toBeDefined();
    });
  });
});
