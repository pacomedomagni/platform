# Load Testing with k6

This directory contains load testing scripts using [k6](https://k6.io/).

## Prerequisites

Install k6:

```bash
# macOS
brew install k6

# Linux
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Docker
docker pull grafana/k6
```

## Test Scripts

### 1. Storefront Load Test (`storefront.js`)

Simulates typical customer behavior:
- Browsing products (list, detail)
- Shopping cart operations
- Checkout flow (10% of users)
- Health checks

```bash
# Run against local
k6 run tests/load/storefront.js

# Run against staging
k6 run -e BASE_URL=https://staging-api.example.com/api/v1 tests/load/storefront.js

# Run with fewer VUs for smoke test
k6 run --vus 5 --duration 30s tests/load/storefront.js
```

### 2. Spike Test (`spike.js`)

Tests system behavior under sudden traffic spikes:
- Ramps from 10 to 200 users in 10 seconds
- Tests dashboard, product queries, and health endpoints

```bash
k6 run tests/load/spike.js
```

### 3. Soak Test (`soak.js`)

Tests system stability over extended periods:
- 4-hour sustained load at 50 users
- Mixed workload simulating real traffic
- Detects memory leaks and resource exhaustion

```bash
# Warning: Takes 4+ hours
k6 run tests/load/soak.js

# Shorter version for CI
k6 run --stages "1m:20,30m:20,1m:0" tests/load/soak.js
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BASE_URL` | API base URL | `http://localhost:3000/api/v1` |
| `AUTH_TOKEN` | Bearer token for authenticated endpoints | (empty) |

## Thresholds

All tests define performance thresholds:

| Metric | Storefront | Spike | Soak |
|--------|------------|-------|------|
| p95 Response Time | <500ms | <2000ms | <500ms |
| p99 Response Time | <1000ms | <5000ms | <1000ms |
| Error Rate | <1% | <5% | <1% |
| Failed Requests | <1% | <5% | <2% |

## Interpreting Results

### Good Performance
```
✅ http_req_duration..............: p(95)=234.56ms
✅ http_req_failed................: 0.12%
✅ errors.........................: 0.05%
```

### Issues to Investigate
```
❌ http_req_duration..............: p(95)=1234.56ms  (> 500ms threshold)
❌ http_req_failed................: 2.34%            (> 1% threshold)
```

## CI Integration

Add to GitHub Actions:

```yaml
load-test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    
    - name: Run k6 smoke test
      uses: grafana/k6-action@v0.3.1
      with:
        filename: tests/load/storefront.js
        flags: --vus 10 --duration 1m
      env:
        BASE_URL: ${{ vars.STAGING_API_URL }}
```

## Grafana Cloud Integration

For real-time monitoring during tests:

```bash
K6_CLOUD_PROJECT_ID=<project_id> \
K6_CLOUD_TOKEN=<token> \
k6 run --out cloud tests/load/storefront.js
```

## Performance Optimization Tips

Based on load test results, common optimizations:

1. **Database Queries**
   - Add indexes for frequently filtered columns
   - Use pagination for list endpoints
   - Implement query caching with Redis

2. **API Response**
   - Enable gzip compression
   - Use HTTP/2
   - Implement response caching headers

3. **Application**
   - Scale horizontally during high load
   - Use connection pooling
   - Optimize N+1 queries

4. **Infrastructure**
   - Use CDN for static assets
   - Configure proper health check intervals
   - Auto-scale based on CPU/memory metrics
