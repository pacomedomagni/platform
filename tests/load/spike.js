import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const dashboardLatency = new Trend('dashboard_latency');
const crudLatency = new Trend('crud_latency');

// Spike test configuration - sudden traffic surge
export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Normal load
    { duration: '10s', target: 200 },  // Spike to 200 users
    { duration: '1m', target: 200 },   // Hold spike
    { duration: '10s', target: 10 },   // Scale down
    { duration: '1m', target: 10 },    // Recovery
    { duration: '10s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'], // Relaxed for spike test
    http_req_failed: ['rate<0.05'],                   // Less than 5% failures
    errors: ['rate<0.1'],                             // Less than 10% error rate
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api/v1';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${AUTH_TOKEN}`,
  };

  // Scenario 1: Dashboard API (Heavy Query)
  group('Dashboard Load', () => {
    const startTime = Date.now();

    let res = http.get(`${BASE_URL}/dashboard/summary`, { headers });
    check(res, {
      'dashboard status 200': (r) => r.status === 200,
      'dashboard has data': (r) => r.json('revenue') !== undefined,
    }) || errorRate.add(1);

    dashboardLatency.add(Date.now() - startTime);

    sleep(1);
  });

  // Scenario 2: Attention Items (Quick Query)
  group('Attention Items', () => {
    const res = http.get(`${BASE_URL}/dashboard/attention`, { headers });
    check(res, {
      'attention status 200': (r) => r.status === 200,
    }) || errorRate.add(1);

    sleep(0.5);
  });

  // Scenario 3: Product List with Filters
  group('Product Queries', () => {
    const startTime = Date.now();

    // List with filters
    let res = http.get(`${BASE_URL}/store/products?limit=50&search=test`, { headers });
    check(res, {
      'products list status 200': (r) => r.status === 200,
    }) || errorRate.add(1);

    // Categories
    res = http.get(`${BASE_URL}/store/categories`, { headers });
    check(res, {
      'categories status 200': (r) => r.status === 200,
    }) || errorRate.add(1);

    crudLatency.add(Date.now() - startTime);

    sleep(0.5);
  });

  // Scenario 4: Order History
  group('Order Queries', () => {
    const res = http.get(`${BASE_URL}/store/orders?limit=20`, { headers });
    check(res, {
      'orders list status 200 or 401': (r) => r.status === 200 || r.status === 401,
    }) || errorRate.add(1);

    sleep(0.5);
  });

  // Scenario 5: Health Checks (Always quick)
  group('Health Checks', () => {
    let res = http.get(`${BASE_URL.replace('/api/v1', '')}/health`);
    check(res, {
      'health check OK': (r) => r.status === 200,
    }) || errorRate.add(1);

    res = http.get(`${BASE_URL.replace('/api/v1', '')}/health/ready`);
    check(res, {
      'ready check OK': (r) => r.status === 200,
    }) || errorRate.add(1);
  });

  sleep(Math.random() * 2 + 0.5);
}
