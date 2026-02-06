import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Soak test - sustained load over long period
export const options = {
  stages: [
    { duration: '5m', target: 50 },    // Ramp up
    { duration: '4h', target: 50 },    // Sustained load for 4 hours
    { duration: '5m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.02'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api/v1';

export default function () {
  // Simulate realistic user behavior mix
  const scenario = Math.random();

  if (scenario < 0.5) {
    // 50% - Browse products
    browseProducts();
  } else if (scenario < 0.8) {
    // 30% - Add to cart
    addToCart();
  } else if (scenario < 0.95) {
    // 15% - View dashboard (authenticated users)
    viewDashboard();
  } else {
    // 5% - Checkout attempt
    attemptCheckout();
  }

  sleep(Math.random() * 5 + 2); // 2-7 seconds between actions
}

function browseProducts() {
  const res = http.get(`${BASE_URL}/store/products?limit=20&page=${Math.floor(Math.random() * 5) + 1}`);
  check(res, {
    'products list OK': (r) => r.status === 200,
  }) || errorRate.add(1);

  if (res.status === 200) {
    const products = res.json('items') || [];
    if (products.length > 0) {
      const product = products[Math.floor(Math.random() * products.length)];
      const detailRes = http.get(`${BASE_URL}/store/products/${product.slug}`);
      check(detailRes, {
        'product detail OK': (r) => r.status === 200,
      }) || errorRate.add(1);
    }
  }
}

function addToCart() {
  const headers = { 'Content-Type': 'application/json' };
  
  // Create cart
  let res = http.post(`${BASE_URL}/store/cart`, null, { headers });
  if (res.status !== 200 && res.status !== 201) {
    errorRate.add(1);
    return;
  }

  const cartId = res.json('id');
  
  // Get a product to add
  const productsRes = http.get(`${BASE_URL}/store/products?limit=5`);
  const products = productsRes.json('items') || [];
  
  if (products.length > 0) {
    const product = products[Math.floor(Math.random() * products.length)];
    res = http.post(`${BASE_URL}/store/cart/${cartId}/items`, JSON.stringify({
      productSlug: product.slug,
      quantity: Math.floor(Math.random() * 3) + 1,
    }), { headers });
    
    check(res, {
      'item added': (r) => r.status === 200 || r.status === 201,
    }) || errorRate.add(1);
  }
}

function viewDashboard() {
  // Note: This would need actual auth token in production
  const res = http.get(`${BASE_URL}/dashboard/attention`);
  // Allow 401 as we may not have valid auth
  check(res, {
    'dashboard accessible': (r) => r.status === 200 || r.status === 401,
  }) || errorRate.add(1);
}

function attemptCheckout() {
  const headers = { 'Content-Type': 'application/json' };
  
  // Create cart with item
  let res = http.post(`${BASE_URL}/store/cart`, null, { headers });
  const cartId = res.json('id');
  
  if (cartId) {
    const productsRes = http.get(`${BASE_URL}/store/products?limit=1`);
    const products = productsRes.json('items') || [];
    
    if (products.length > 0) {
      http.post(`${BASE_URL}/store/cart/${cartId}/items`, JSON.stringify({
        productSlug: products[0].slug,
        quantity: 1,
      }), { headers });

      // Create checkout (won't complete payment in test)
      res = http.post(`${BASE_URL}/store/checkout`, JSON.stringify({
        cartId,
        email: `soak+${Date.now()}@test.com`,
        shippingAddress: {
          firstName: 'Soak',
          lastName: 'Test',
          addressLine1: '123 Soak St',
          city: 'Test City',
          state: 'TS',
          postalCode: '12345',
          country: 'US',
        },
        billingAddress: {
          firstName: 'Soak',
          lastName: 'Test',
          addressLine1: '123 Soak St',
          city: 'Test City',
          state: 'TS',
          postalCode: '12345',
          country: 'US',
        },
      }), { headers });

      check(res, {
        'checkout created': (r) => r.status === 200 || r.status === 201,
      }) || errorRate.add(1);
    }
  }
}
