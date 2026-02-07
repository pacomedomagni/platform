# Load Testing Suite

This directory contains load tests to verify the platform handles concurrent operations correctly.

## Prerequisites

Install k6:
```bash
# macOS
brew install k6

# Linux
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D00
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Windows
choco install k6
```

## Running Tests

### 1. Cart Concurrent Operations Test

Tests concurrent cart operations (add to cart, checkout, coupon application):

```bash
# Basic run
k6 run load-tests/cart-concurrent-operations.js

# Custom configuration
BASE_URL=http://localhost:3000/api/v1 \
TENANT_ID=your-tenant-id \
PRODUCT_ID=your-product-id \
k6 run load-tests/cart-concurrent-operations.js

# With results output
k6 run --out json=results/cart-test.json load-tests/cart-concurrent-operations.js
```

**What it tests:**
- 100 concurrent users adding items to cart (5 minutes)
- 50 concurrent users creating checkouts (4 minutes)
- 20 concurrent users brute-forcing coupons (2 minutes)

**Success criteria:**
- Zero stock overselling errors
- Rate limiting triggered (confirming it works)
- 95% of requests < 500ms
- Error rate < 1%

### 2. Stock Movement Concurrency Test

Tests concurrent stock movements (receipts, issues, transfers):

```bash
# Requires authentication
JWT_TOKEN=your-jwt-token \
TENANT_ID=your-tenant-id \
WAREHOUSE_CODE=WH-001 \
ITEM_CODE=ITEM-001 \
k6 run load-tests/stock-movement-concurrency.js

# With detailed output
k6 run --out json=results/stock-test.json \
  load-tests/stock-movement-concurrency.js
```

**What it tests:**
- 50 concurrent stock receipts (3 minutes)
- 30 concurrent stock issues (3 minutes)
- 20 mixed concurrent operations (4 minutes)

**Success criteria:**
- Zero duplicate voucher numbers (CRITICAL)
- Zero balance corruption errors (CRITICAL)
- 95% of requests < 1s
- Error rate < 1%

## Test Scenarios

### Scenario 1: Black Friday Load (cart-concurrent-operations.js)

Simulates high traffic during a sale:
- 100 concurrent users shopping
- Items selling out rapidly
- Coupon codes being heavily used

**Expected behavior:**
- Some users get "out of stock" errors (expected when stock depletes)
- Coupon brute-force attempts are rate limited
- No user gets an item when stock = 0

### Scenario 2: Warehouse Operations (stock-movement-concurrency.js)

Simulates busy warehouse with multiple staff:
- Multiple receipts being processed simultaneously
- Multiple issues (sales) happening at once
- Mixed operations (real-world scenario)

**Expected behavior:**
- All voucher numbers are unique
- Stock balances remain accurate
- No race conditions cause data corruption

## Interpreting Results

### Good Results

```
✓ http_req_duration........: avg=245ms p(95)=450ms p(99)=800ms
✓ http_req_failed..........: 0.00%
✓ stock_oversell_errors....: 0
✓ duplicate_vouchers.......: 0
✓ balance_errors...........: 0
✓ rate_limit_hits..........: 45 (rate limiting working)
```

### Bad Results (Need Investigation)

```
✗ stock_oversell_errors....: 5     ← CRITICAL: Stock overselling detected
✗ duplicate_vouchers.......: 2     ← CRITICAL: Duplicate vouchers created
✗ balance_errors...........: 3     ← CRITICAL: Balance corruption
✗ http_req_failed..........: 5.2%  ← Too many errors
```

## Troubleshooting

### High Error Rate

If you see >1% error rate:
1. Check database connection limits
2. Review application logs
3. Verify advisory locks are working
4. Check for deadlocks in logs

### Slow Response Times

If p95 > 500ms for cart operations:
1. Check database query performance
2. Review transaction isolation levels
3. Consider adding database indexes
4. Profile slow queries

### Duplicate Vouchers (CRITICAL)

If any duplicate vouchers are detected:
1. **STOP PRODUCTION DEPLOYMENT**
2. Review posting marker logic
3. Check advisory lock implementation
4. Verify transaction isolation

### Stock Overselling (CRITICAL)

If any overselling is detected:
1. **STOP PRODUCTION DEPLOYMENT**
2. Review stock reservation logic
3. Check `actualQty - reservedQty` calculation
4. Verify transaction wrapping

## CI/CD Integration

Add to your CI pipeline:

```yaml
# .github/workflows/load-test.yml
name: Load Tests

on:
  pull_request:
    branches: [main]

jobs:
  load-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup database
        run: |
          npm install
          npx prisma migrate deploy
          npm run seed

      - name: Start API
        run: npm run start:prod &

      - name: Install k6
        run: |
          curl https://github.com/grafana/k6/releases/download/v0.47.0/k6-v0.47.0-linux-amd64.tar.gz -L | tar xvz
          sudo mv k6-v0.47.0-linux-amd64/k6 /usr/local/bin/

      - name: Run load tests
        run: |
          k6 run --out json=results.json load-tests/cart-concurrent-operations.js
          k6 run --out json=results.json load-tests/stock-movement-concurrency.js

      - name: Check for critical errors
        run: |
          # Fail if any critical metrics exceeded thresholds
          if grep -q '"stock_oversell_errors":.*[1-9]' results.json; then
            echo "CRITICAL: Stock overselling detected"
            exit 1
          fi
```

## Monitoring During Tests

While tests are running, monitor:

```bash
# Watch monitoring endpoint
watch -n 1 'curl -s http://localhost:3000/api/v1/monitoring/alerts | jq'

# Watch database connections
watch -n 1 'psql -c "SELECT count(*) FROM pg_stat_activity WHERE datname = '\''noslag_db'\'';"'

# Watch failed operations
watch -n 5 'curl -s http://localhost:3000/api/v1/monitoring/failed-operations?limit=10 | jq'
```

## Performance Baselines

Based on initial testing, expected performance:

| Operation | P95 | P99 | Max Acceptable |
|-----------|-----|-----|----------------|
| Get Cart | 50ms | 100ms | 200ms |
| Add to Cart | 200ms | 400ms | 500ms |
| Checkout | 300ms | 600ms | 1000ms |
| Stock Receipt | 400ms | 800ms | 1000ms |
| Stock Issue | 500ms | 900ms | 1500ms |

If you exceed these baselines, investigate query performance.
