import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const cartLatency = new Trend('cart_latency');
const checkoutLatency = new Trend('checkout_latency');

// Test configuration
export const options = {
  stages: [
    { duration: '1m', target: 10 },   // Ramp up to 10 users
    { duration: '3m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% under 500ms, 99% under 1s
    http_req_failed: ['rate<0.01'],                  // Less than 1% failures
    errors: ['rate<0.05'],                           // Less than 5% error rate
    cart_latency: ['p(95)<300'],                     // Cart operations under 300ms
    checkout_latency: ['p(95)<1000'],                // Checkout under 1s
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api/v1';

// Test data
const products = [
  { slug: 'product-1', quantity: 1 },
  { slug: 'product-2', quantity: 2 },
  { slug: 'product-3', quantity: 1 },
];

export function setup() {
  // Warm up - create a test customer
  const res = http.post(`${BASE_URL}/store/auth/register`, JSON.stringify({
    email: `loadtest+${Date.now()}@example.com`,
    password: 'LoadTest123!',
    firstName: 'Load',
    lastName: 'Test',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  return { 
    token: res.json('token'),
    customerId: res.json('customer.id'),
  };
}

export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (data.token) {
    headers['Authorization'] = `Bearer ${data.token}`;
  }

  // Scenario 1: Browse Products
  group('Browse Products', () => {
    // List products
    let res = http.get(`${BASE_URL}/store/products?limit=20`);
    check(res, {
      'products list status 200': (r) => r.status === 200,
      'products list has items': (r) => r.json('items.length') > 0,
    }) || errorRate.add(1);

    sleep(1);

    // Get product detail
    res = http.get(`${BASE_URL}/store/products/${products[0].slug}`);
    check(res, {
      'product detail status 200': (r) => r.status === 200,
    }) || errorRate.add(1);

    sleep(0.5);
  });

  // Scenario 2: Shopping Cart Flow
  group('Shopping Cart', () => {
    const startTime = Date.now();

    // Create cart
    let res = http.post(`${BASE_URL}/store/cart`, null, { headers });
    check(res, {
      'cart created': (r) => r.status === 201 || r.status === 200,
    }) || errorRate.add(1);

    const cartId = res.json('id');
    if (!cartId) {
      errorRate.add(1);
      return;
    }

    // Add items to cart
    const product = products[Math.floor(Math.random() * products.length)];
    res = http.post(`${BASE_URL}/store/cart/${cartId}/items`, JSON.stringify({
      productSlug: product.slug,
      quantity: product.quantity,
    }), { headers });
    
    check(res, {
      'item added to cart': (r) => r.status === 200 || r.status === 201,
    }) || errorRate.add(1);

    // Get cart
    res = http.get(`${BASE_URL}/store/cart/${cartId}`, { headers });
    check(res, {
      'cart retrieved': (r) => r.status === 200,
      'cart has items': (r) => r.json('items.length') > 0,
    }) || errorRate.add(1);

    cartLatency.add(Date.now() - startTime);

    sleep(1);
  });

  // Scenario 3: Checkout Flow (10% of users)
  if (Math.random() < 0.1) {
    group('Checkout', () => {
      const startTime = Date.now();

      // Create cart with items
      let res = http.post(`${BASE_URL}/store/cart`, null, { headers });
      const cartId = res.json('id');
      
      if (cartId) {
        http.post(`${BASE_URL}/store/cart/${cartId}/items`, JSON.stringify({
          productSlug: products[0].slug,
          quantity: 1,
        }), { headers });

        // Create checkout
        res = http.post(`${BASE_URL}/store/checkout`, JSON.stringify({
          cartId,
          email: `loadtest+${Date.now()}@example.com`,
          shippingAddress: {
            firstName: 'Load',
            lastName: 'Test',
            addressLine1: '123 Test St',
            city: 'Test City',
            state: 'TS',
            postalCode: '12345',
            country: 'US',
          },
          billingAddress: {
            firstName: 'Load',
            lastName: 'Test',
            addressLine1: '123 Test St',
            city: 'Test City',
            state: 'TS',
            postalCode: '12345',
            country: 'US',
          },
        }), { headers });

        check(res, {
          'checkout created': (r) => r.status === 200 || r.status === 201,
        }) || errorRate.add(1);

        checkoutLatency.add(Date.now() - startTime);
      }

      sleep(2);
    });
  }

  // Scenario 4: API Health Check
  group('Health Check', () => {
    const res = http.get(`${BASE_URL.replace('/api/v1', '')}/health`);
    check(res, {
      'health check OK': (r) => r.status === 200,
    }) || errorRate.add(1);
  });

  sleep(Math.random() * 2 + 1); // Random sleep 1-3 seconds
}

export function teardown(data) {
  // Cleanup if needed
}

export function handleSummary(data) {
  return {
    'tests/load/summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  const { metrics } = data;
  let summary = '\n========== Load Test Summary ==========\n\n';

  // Key metrics
  summary += '📊 Performance Metrics:\n';
  summary += `   HTTP Request Duration (p95): ${metrics.http_req_duration?.values?.['p(95)']?.toFixed(2) || 'N/A'}ms\n`;
  summary += `   HTTP Request Duration (p99): ${metrics.http_req_duration?.values?.['p(99)']?.toFixed(2) || 'N/A'}ms\n`;
  summary += `   HTTP Request Failed: ${(metrics.http_req_failed?.values?.rate * 100 || 0).toFixed(2)}%\n`;
  summary += `   Error Rate: ${(metrics.errors?.values?.rate * 100 || 0).toFixed(2)}%\n`;
  summary += `   Cart Latency (p95): ${metrics.cart_latency?.values?.['p(95)']?.toFixed(2) || 'N/A'}ms\n`;
  summary += `   Checkout Latency (p95): ${metrics.checkout_latency?.values?.['p(95)']?.toFixed(2) || 'N/A'}ms\n`;

  // Throughput
  summary += '\n📈 Throughput:\n';
  summary += `   Total Requests: ${metrics.http_reqs?.values?.count || 0}\n`;
  summary += `   Requests/sec: ${metrics.http_reqs?.values?.rate?.toFixed(2) || 'N/A'}\n`;

  // Thresholds
  summary += '\n✅ Threshold Results:\n';
  for (const [name, threshold] of Object.entries(data.thresholds || {})) {
    const passed = threshold.ok ? '✅' : '❌';
    summary += `   ${passed} ${name}\n`;
  }

  summary += '\n=========================================\n';
  return summary;
}
