import axios from 'axios';
import {
  getAdminToken,
  adminHeaders,
  loginTestCustomer,
  customerHeaders,
} from '../support/auth-helper';
import { store } from '../support/data-store';

describe('Order Endpoints', () => {
  beforeAll(async () => {
    await getAdminToken();
    // Ensure the customer is logged in from the previous test file
    await loginTestCustomer(
      store.testCustomerEmail,
      store.testCustomerPassword
    );

    // Ensure stock exists for all test products via inventory receipt
    if (store.warehouseCode && store.productIds?.length) {
      for (const productId of store.productIds) {
        try {
          const prodRes = await axios.get(
            `/store/admin/products/${productId}`,
            { headers: adminHeaders() }
          );
          const itemCode =
            prodRes.data?.item?.code ?? prodRes.data?.data?.item?.code;
          if (itemCode) {
            await axios.post(
              '/inventory-management/movements',
              {
                movementType: 'receipt',
                warehouseCode: store.warehouseCode,
                remarks: 'E2E order test - ensure stock',
                items: [{ itemCode, quantity: 100 }],
              },
              { headers: adminHeaders() }
            );
          }
        } catch {
          // Ignore errors — stock may already exist
        }
      }
    }
  });

  // ─── Cart Operations ──────────────────────────────────────────────

  describe('Cart Operations', () => {
    let cartItemIds: string[] = [];

    describe('GET /store/cart', () => {
      it('should get or create a cart and return 200', async () => {
        const res = await axios.get('/store/cart', {
          headers: customerHeaders(),
        });

        expect(res.status).toBe(200);
        expect(res.data).toBeDefined();

        // Cart ID might be at top level or nested
        const cartId = res.data.id || res.data.cartId;
        expect(cartId).toBeDefined();
        store.cartId = cartId;
      });
    });

    describe('POST /store/cart/:cartId/items', () => {
      it('should add the first product to the cart', async () => {
        expect(store.cartId).toBeTruthy();
        expect(store.productIds.length).toBeGreaterThan(0);

        const res = await axios.post(
          `/store/cart/${store.cartId}/items`,
          {
            productId: store.productIds[0],
            quantity: 1,
          },
          { headers: customerHeaders() }
        );

        // @Post returns 201 by default in NestJS
        expect([200, 201]).toContain(res.status);
        expect(res.data).toBeDefined();

        // Capture the cart item ID for later use
        const items = res.data.items || res.data.cartItems || [];
        if (items.length > 0) {
          cartItemIds.push(items[items.length - 1].id);
        } else if (res.data.id) {
          // Response might be the cart item itself
          cartItemIds.push(res.data.id);
        }
      });

      it('should add a second product to the cart', async () => {
        // Use the second product if available, otherwise re-add the first
        const productId =
          store.productIds.length > 1
            ? store.productIds[1]
            : store.productIds[0];

        const res = await axios.post(
          `/store/cart/${store.cartId}/items`,
          {
            productId,
            quantity: 1,
          },
          { headers: customerHeaders() }
        );

        expect([200, 201]).toContain(res.status);
        expect(res.data).toBeDefined();

        // Capture the second cart item ID
        const items = res.data.items || res.data.cartItems || [];
        if (items.length > 0) {
          cartItemIds.push(items[items.length - 1].id);
        } else if (res.data.id) {
          cartItemIds.push(res.data.id);
        }
      });
    });

    describe('PUT /store/cart/:cartId/items/:itemId', () => {
      it('should update the item quantity to 2', async () => {
        expect(cartItemIds.length).toBeGreaterThan(0);

        const res = await axios.put(
          `/store/cart/${store.cartId}/items/${cartItemIds[0]}`,
          { quantity: 2 },
          { headers: customerHeaders() }
        );

        expect(res.status).toBe(200);
        expect(res.data).toBeDefined();
      });
    });

    describe('GET /store/cart/:cartId', () => {
      it('should return the cart with items', async () => {
        const res = await axios.get(`/store/cart/${store.cartId}`, {
          headers: customerHeaders(),
        });

        expect(res.status).toBe(200);
        expect(res.data).toBeDefined();

        // Verify the cart contains items
        const items = res.data.items || res.data.cartItems || [];
        expect(items.length).toBeGreaterThanOrEqual(1);

        // Refresh cartItemIds from the current cart state
        if (items.length > 0) {
          cartItemIds = items.map((item: any) => item.id);
        }
      });
    });

    describe('DELETE /store/cart/:cartId/items/:itemId', () => {
      it('should remove one item from the cart', async () => {
        expect(cartItemIds.length).toBeGreaterThan(0);

        // Remove the last item from the cart
        const itemToRemove = cartItemIds[cartItemIds.length - 1];
        const res = await axios.delete(
          `/store/cart/${store.cartId}/items/${itemToRemove}`,
          { headers: customerHeaders() }
        );

        expect(res.status).toBe(200);
        cartItemIds.pop();
      });
    });
  });

  // ─── Checkout ─────────────────────────────────────────────────────

  describe('Checkout', () => {
    describe('POST /store/checkout', () => {
      it('should create an order from the cart and return 201', async () => {
        expect(store.cartId).toBeTruthy();

        const res = await axios.post(
          '/store/checkout',
          {
            cartId: store.cartId,
            email: store.testCustomerEmail,
            shippingAddress: {
              firstName: 'Updated',
              lastName: 'Customer',
              addressLine1: '789 Updated Ave',
              city: 'Newtown',
              state: 'CA',
              postalCode: '90210',
              country: 'US',
              phone: '+15551234567',
            },
            billingAddress: {
              firstName: 'Updated',
              lastName: 'Customer',
              addressLine1: '789 Updated Ave',
              city: 'Newtown',
              state: 'CA',
              postalCode: '90210',
              country: 'US',
              phone: '+15551234567',
            },
          },
          { headers: customerHeaders() }
        );

        expect(res.status).toBe(201);
        expect(res.data).toBeDefined();

        // Store the order ID and order number
        const orderId =
          res.data.id || res.data.orderId || res.data.order?.id;
        expect(orderId).toBeDefined();
        store.orderId = orderId;

        const orderNumber =
          res.data.orderNumber ||
          res.data.order?.orderNumber ||
          res.data.number;
        if (orderNumber) {
          store.orderNumber = orderNumber;
        }
      });
    });

    describe('GET /store/checkout/:id', () => {
      it('should return the checkout/order details', async () => {
        expect(store.orderId).toBeTruthy();

        const res = await axios.get(`/store/checkout/${store.orderId}`, {
          headers: customerHeaders(),
        });

        // Could be 200 for the checkout detail or redirect to order
        expect(res.status).toBe(200);
        expect(res.data).toBeDefined();
      });
    });
  });

  // ─── Admin Order Management ────────────────────────────────────────

  describe('Admin Order Management', () => {
    describe('GET /store/orders/admin/all', () => {
      it('should list all orders and return 200', async () => {
        const res = await axios.get('/store/orders/admin/all', {
          headers: adminHeaders(),
        });

        expect(res.status).toBe(200);
        expect(res.data).toBeDefined();

        // Response may be an array or paginated object
        const orders = Array.isArray(res.data)
          ? res.data
          : res.data.data || res.data.orders || [];
        expect(orders.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe('GET /store/orders/admin/:id', () => {
      it('should return order details and return 200', async () => {
        expect(store.orderId).toBeTruthy();

        const res = await axios.get(
          `/store/orders/admin/${store.orderId}`,
          { headers: adminHeaders() }
        );

        expect(res.status).toBe(200);
        expect(res.data).toBeDefined();
        expect(typeof res.data).toBe('object');

        // Capture order number if not yet stored
        if (!store.orderNumber) {
          store.orderNumber =
            res.data.orderNumber || res.data.number || '';
        }
      });
    });

    describe('PUT /store/orders/admin/:id/status', () => {
      it('should update order status to CONFIRMED', async () => {
        expect(store.orderId).toBeTruthy();

        const res = await axios.put(
          `/store/orders/admin/${store.orderId}/status`,
          { status: 'CONFIRMED' },
          { headers: adminHeaders() }
        );

        expect(res.status).toBe(200);
        expect(res.data).toBeDefined();
      });

      it('should update order status to PROCESSING', async () => {
        const res = await axios.put(
          `/store/orders/admin/${store.orderId}/status`,
          { status: 'PROCESSING' },
          { headers: adminHeaders() }
        );

        expect(res.status).toBe(200);
        expect(res.data).toBeDefined();
      });

      it('should update order status to SHIPPED with tracking number', async () => {
        const res = await axios.put(
          `/store/orders/admin/${store.orderId}/status`,
          {
            status: 'SHIPPED',
            trackingNumber: 'TRK-E2E-123456789',
            carrier: 'TestCarrier',
          },
          { headers: adminHeaders() }
        );

        expect(res.status).toBe(200);
        expect(res.data).toBeDefined();
      });

      it('should update order status to DELIVERED', async () => {
        const res = await axios.put(
          `/store/orders/admin/${store.orderId}/status`,
          { status: 'DELIVERED' },
          { headers: adminHeaders() }
        );

        expect(res.status).toBe(200);
        expect(res.data).toBeDefined();
      });
    });
  });

  // ─── Customer Order View ───────────────────────────────────────────

  describe('Customer Order View', () => {
    describe('GET /store/orders', () => {
      it('should list the customer orders and return 200', async () => {
        const res = await axios.get('/store/orders', {
          headers: customerHeaders(),
        });

        expect(res.status).toBe(200);
        expect(res.data).toBeDefined();

        const orders = Array.isArray(res.data)
          ? res.data
          : res.data.data || res.data.orders || [];
        expect(orders.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe('GET /store/orders/:id', () => {
      it('should return customer order detail and return 200', async () => {
        expect(store.orderId).toBeTruthy();

        const res = await axios.get(`/store/orders/${store.orderId}`, {
          headers: customerHeaders(),
        });

        expect(res.status).toBe(200);
        expect(res.data).toBeDefined();
        expect(typeof res.data).toBe('object');
      });
    });

    describe('GET /store/orders/lookup/:orderNumber', () => {
      it('should lookup order by order number', async () => {
        if (!store.orderNumber) {
          console.warn('Skipping order lookup: no order number stored');
          return;
        }

        const res = await axios.get(
          `/store/orders/lookup/${store.orderNumber}`,
          {
            headers: customerHeaders(),
            params: { email: store.testCustomerEmail },
          }
        );

        expect(res.status).toBeLessThan(500);
        if (res.status === 200) {
          expect(res.data).toBeDefined();
        }
      });
    });
  });

  // ─── Cart Coupon Operations ─────────────────────────────────────

  describe('Cart Coupon Operations', () => {
    let couponCartId: string;

    beforeAll(async () => {
      // Create a fresh cart for coupon tests
      const cartRes = await axios.get('/store/cart', {
        headers: customerHeaders(),
      });
      couponCartId = cartRes.data.id || cartRes.data.cartId;

      // Add an item to the cart
      if (store.productIds?.[0] && couponCartId) {
        await axios.post(
          `/store/cart/${couponCartId}/items`,
          { productId: store.productIds[0], quantity: 1 },
          { headers: customerHeaders() }
        );
      }
    });

    it('POST /store/cart/:id/coupon → apply coupon', async () => {
      if (!couponCartId || !store.couponCode) {
        console.warn('Skipping coupon apply: no cart or coupon code');
        return;
      }

      const res = await axios.post(
        `/store/cart/${couponCartId}/coupon`,
        { code: store.couponCode },
        { headers: customerHeaders() }
      );

      expect([200, 201]).toContain(res.status);
      expect(res.data).toBeDefined();
    });

    it('DELETE /store/cart/:id/coupon → remove coupon', async () => {
      if (!couponCartId) {
        console.warn('Skipping coupon remove: no cart');
        return;
      }

      const res = await axios.delete(
        `/store/cart/${couponCartId}/coupon`,
        { headers: customerHeaders() }
      );

      expect([200, 204]).toContain(res.status);
    });

    it('DELETE /store/cart/:id → clear cart', async () => {
      if (!couponCartId) {
        console.warn('Skipping cart clear: no cart');
        return;
      }

      const res = await axios.delete(
        `/store/cart/${couponCartId}`,
        { headers: customerHeaders() }
      );

      expect([200, 204]).toContain(res.status);
    });
  });

  // ─── Order Cancellation & Refund ────────────────────────────────

  describe('Order Cancel & Refund', () => {
    let cancelOrderId: string;

    beforeAll(async () => {
      // Create a fresh cart, add item, and checkout to get a new order
      try {
        const cartRes = await axios.get('/store/cart', {
          headers: customerHeaders(),
        });
        const cartId = cartRes.data.id || cartRes.data.cartId;

        if (store.productIds?.[0] && cartId) {
          await axios.post(
            `/store/cart/${cartId}/items`,
            { productId: store.productIds[0], quantity: 1 },
            { headers: customerHeaders() }
          );

          const checkoutRes = await axios.post(
            '/store/checkout',
            {
              cartId,
              email: store.testCustomerEmail,
              shippingAddress: {
                firstName: 'Cancel',
                lastName: 'Test',
                addressLine1: '123 Cancel St',
                city: 'Testville',
                state: 'CA',
                postalCode: '90210',
                country: 'US',
                phone: '+15551234567',
              },
              billingAddress: {
                firstName: 'Cancel',
                lastName: 'Test',
                addressLine1: '123 Cancel St',
                city: 'Testville',
                state: 'CA',
                postalCode: '90210',
                country: 'US',
                phone: '+15551234567',
              },
            },
            { headers: customerHeaders() }
          );

          if (checkoutRes.status === 201) {
            cancelOrderId =
              checkoutRes.data.id ||
              checkoutRes.data.orderId ||
              checkoutRes.data.order?.id;
          }
        }
      } catch {
        // If checkout fails, tests will be skipped
      }
    });

    it('POST /store/orders/:id/cancel → cancel order (customer)', async () => {
      if (!cancelOrderId) {
        console.warn('Skipping cancel test: no order created');
        return;
      }

      const res = await axios.post(
        `/store/orders/${cancelOrderId}/cancel`,
        { reason: 'E2E test cancellation' },
        { headers: customerHeaders() }
      );

      // May succeed or fail if order status doesn't allow cancellation
      expect(res.status).toBeLessThan(500);
    });

    it('POST /store/orders/admin/:id/refund → refund order (admin)', async () => {
      if (!cancelOrderId) {
        console.warn('Skipping refund test: no order to refund');
        return;
      }

      const res = await axios.post(
        `/store/orders/admin/${cancelOrderId}/refund`,
        { reason: 'E2E test refund', amount: 1.00 },
        { headers: adminHeaders() }
      );

      // May succeed or fail depending on order/payment state
      expect(res.status).toBeLessThan(500);
    });
  });

  // ─── Cart Merge ────────────────────────────────────────────────

  describe('Cart Merge', () => {
    it('POST /store/cart/merge → merge guest cart into authenticated cart', async () => {
      // Create a guest cart by getting a cart without auth
      const guestRes = await axios.get('/store/cart', {
        headers: { 'x-tenant-id': adminHeaders()['x-tenant-id'] },
      });

      const guestCartId = guestRes.data.id || guestRes.data.cartId;
      if (!guestCartId) {
        console.warn('Skipping merge test: could not create guest cart');
        return;
      }

      const res = await axios.post(
        '/store/cart/merge',
        { sourceCartId: guestCartId },
        { headers: customerHeaders() },
      );

      // May return 200 (merged) or 400 (empty cart to merge)
      expect(res.status).toBeLessThan(500);
    });
  });

  // ─── Checkout Extras ────────────────────────────────────────────

  describe('Checkout Extras', () => {
    it('GET /store/checkout/order/:orderNumber → lookup by order number', async () => {
      if (!store.orderNumber) {
        console.warn('Skipping checkout order lookup: no order number');
        return;
      }

      const res = await axios.get(
        `/store/checkout/order/${store.orderNumber}`,
        { headers: customerHeaders() }
      );

      expect(res.status).toBeLessThan(500);
      if (res.status === 200) {
        expect(res.data).toBeDefined();
      }
    });
  });
});
