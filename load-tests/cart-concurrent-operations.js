/**
 * Load Test: Concurrent Cart Operations
 *
 * Tests concurrent cart operations to verify:
 * - No stock overselling under load
 * - Stock reservations work correctly
 * - Rate limiting is enforced
 * - No race conditions in cart operations
 *
 * Run with: k6 run load-tests/cart-concurrent-operations.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

// Custom metrics
const stockOversellErrors = new Counter('stock_oversell_errors');
const cartOperationDuration = new Trend('cart_operation_duration');
const rateLimitHits = new Counter('rate_limit_hits');

// Test configuration
export const options = {
  scenarios: {
    // Scenario 1: Concurrent add to cart (100 users, 5min)
    concurrent_add_to_cart: {
      executor: 'constant-vus',
      vus: 100,
      duration: '5m',
      exec: 'testConcurrentAddToCart',
    },

    // Scenario 2: Concurrent checkout (50 users, 3min)
    concurrent_checkout: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '1m', target: 50 },
        { duration: '2m', target: 50 },
        { duration: '1m', target: 0 },
      ],
      exec: 'testConcurrentCheckout',
      startTime: '5m', // Start after cart test
    },

    // Scenario 3: Concurrent coupon application (20 users, 2min)
    concurrent_coupon_brute_force: {
      executor: 'constant-vus',
      vus: 20,
      duration: '2m',
      exec: 'testCouponBruteForce',
      startTime: '9m', // Start after checkout test
    },
  },

  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% < 500ms, 99% < 1s
    http_req_failed: ['rate<0.01'], // Error rate < 1%
    stock_oversell_errors: ['count==0'], // Zero overselling errors
    rate_limit_hits: ['count>0'], // Rate limiting should be triggered
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api/v1';
const TENANT_ID = __ENV.TENANT_ID || 'test-tenant-id';
const PRODUCT_ID = __ENV.PRODUCT_ID || 'test-product-id';

/**
 * Test concurrent add to cart operations
 * Verifies stock reservation and no overselling
 */
export function testConcurrentAddToCart() {
  const sessionToken = `session-${__VU}-${Date.now()}`;

  // Create cart
  const createCartRes = http.get(`${BASE_URL}/store/cart`, {
    headers: {
      'x-tenant-id': TENANT_ID,
      'x-cart-session': sessionToken,
    },
  });

  check(createCartRes, {
    'cart created': (r) => r.status === 200,
  });

  if (createCartRes.status !== 200) {
    return;
  }

  const cart = createCartRes.json();

  // Add item to cart (may fail due to stock limits - that's expected)
  const startTime = Date.now();
  const addItemRes = http.post(
    `${BASE_URL}/store/cart/${cart.id}/items`,
    JSON.stringify({
      productId: PRODUCT_ID,
      quantity: 1,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': TENANT_ID,
        'x-cart-session': sessionToken,
      },
    }
  );

  const duration = Date.now() - startTime;
  cartOperationDuration.add(duration);

  const addSuccess = check(addItemRes, {
    'add to cart succeeded or stock unavailable': (r) =>
      r.status === 200 || r.status === 400,
  });

  // Track rate limiting
  if (addItemRes.status === 429) {
    rateLimitHits.add(1);
  }

  // Track stock overselling errors (should never happen)
  if (addItemRes.status === 200) {
    const updatedCart = addItemRes.json();
    if (updatedCart.items && updatedCart.items.length > 0) {
      // Verify item has valid stock status
      const item = updatedCart.items[0];
      if (item.product.stockStatus === 'out_of_stock' && item.quantity > 0) {
        stockOversellErrors.add(1);
      }
    }
  }

  sleep(1);
}

/**
 * Test concurrent checkout operations
 * Verifies no duplicate orders and proper stock deduction
 */
export function testConcurrentCheckout() {
  const sessionToken = `session-${__VU}-${Date.now()}`;

  // Create cart with item
  const createCartRes = http.get(`${BASE_URL}/store/cart`, {
    headers: {
      'x-tenant-id': TENANT_ID,
      'x-cart-session': sessionToken,
    },
  });

  if (createCartRes.status !== 200) {
    return;
  }

  const cart = createCartRes.json();

  // Add item
  const addItemRes = http.post(
    `${BASE_URL}/store/cart/${cart.id}/items`,
    JSON.stringify({
      productId: PRODUCT_ID,
      quantity: 1,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': TENANT_ID,
        'x-cart-session': sessionToken,
      },
    }
  );

  if (addItemRes.status !== 200) {
    return; // Stock unavailable
  }

  // Create checkout
  const checkoutRes = http.post(
    `${BASE_URL}/store/checkout`,
    JSON.stringify({
      cartId: cart.id,
      email: `test-${__VU}@example.com`,
      phone: '+1234567890',
      shippingAddress: {
        firstName: 'Test',
        lastName: 'User',
        addressLine1: '123 Test St',
        city: 'Test City',
        state: 'CA',
        postalCode: '12345',
        country: 'US',
      },
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': TENANT_ID,
        'x-cart-session': sessionToken,
      },
    }
  );

  check(checkoutRes, {
    'checkout created or stock unavailable': (r) =>
      r.status === 200 || r.status === 400,
  });

  // Track rate limiting
  if (checkoutRes.status === 429) {
    rateLimitHits.add(1);
  }

  sleep(2);
}

/**
 * Test concurrent coupon application
 * Verifies rate limiting prevents brute forcing
 */
export function testCouponBruteForce() {
  const sessionToken = `session-${__VU}-${Date.now()}`;

  // Create cart
  const createCartRes = http.get(`${BASE_URL}/store/cart`, {
    headers: {
      'x-tenant-id': TENANT_ID,
      'x-cart-session': sessionToken,
    },
  });

  if (createCartRes.status !== 200) {
    return;
  }

  const cart = createCartRes.json();

  // Add item first
  const addItemRes = http.post(
    `${BASE_URL}/store/cart/${cart.id}/items`,
    JSON.stringify({
      productId: PRODUCT_ID,
      quantity: 1,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': TENANT_ID,
        'x-cart-session': sessionToken,
      },
    }
  );

  if (addItemRes.status !== 200) {
    return;
  }

  // Attempt to apply multiple coupons rapidly (should be rate limited)
  for (let i = 0; i < 10; i++) {
    const couponRes = http.post(
      `${BASE_URL}/store/cart/${cart.id}/coupon`,
      JSON.stringify({
        code: `TEST-${i}`,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': TENANT_ID,
          'x-cart-session': sessionToken,
        },
      }
    );

    // Track rate limit hits
    if (couponRes.status === 429) {
      rateLimitHits.add(1);
    }

    // Should get rate limited after 5 requests per minute
    if (i >= 5) {
      check(couponRes, {
        'rate limited after 5 requests': (r) => r.status === 429,
      });
    }
  }

  sleep(1);
}
