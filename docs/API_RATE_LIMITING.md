# API Rate Limiting

The NoSlag platform implements rate limiting to prevent abuse, ensure fair usage, and maintain system stability.

## Overview

Rate limiting is applied at **three levels**:

1. **Global Rate Limiting**: Applies to all endpoints
2. **Endpoint-Specific Rate Limiting**: Stricter limits on sensitive endpoints
3. **Tenant-Level Rate Limiting**: Fair usage across tenants (future)

## Global Rate Limits

All API requests are subject to these global limits:

| Window | Limit | Purpose |
|--------|-------|---------|
| 1 second | 10 requests | Prevent request bursts |
| 1 minute | 100 requests | General usage limit |
| 1 hour | 1,000 requests | Overall usage cap |

### Response Headers

When rate limited, you'll receive:

```
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1675123456
Retry-After: 42
```

- `X-RateLimit-Limit`: Maximum requests allowed in the window
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Unix timestamp when the window resets
- `Retry-After`: Seconds to wait before retrying

## Endpoint-Specific Limits

### Authentication Endpoints

**Purpose**: Prevent brute force attacks and account enumeration

| Endpoint | Limit | Window | Reason |
|----------|-------|--------|--------|
| `POST /store/auth/register` | 5 | 1 min | Prevent spam account creation |
| `POST /store/auth/login` | 10 | 1 min | Prevent password brute forcing |
| `POST /store/auth/forgot-password` | 3 | 1 min | Prevent email bombing |
| `POST /store/auth/reset-password` | 5 | 1 min | Prevent token brute forcing |

**Example**:
```bash
# After 5 login attempts in 1 minute
curl -X POST https://api.example.com/api/v1/store/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "wrong"}'

# Response:
HTTP/1.1 429 Too Many Requests
{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests",
  "error": "Too Many Requests"
}
```

### Cart Endpoints

**Purpose**: Prevent inventory checking abuse and cart spam

| Endpoint | Limit | Window | Reason |
|----------|-------|--------|--------|
| `GET /store/cart` | 30 | 1 min | Frequent cart checks allowed |
| `POST /store/cart/:id/items` | 20 | 1 min | Prevent add-to-cart spam |
| `PUT /store/cart/:id/items/:itemId` | 20 | 1 min | Prevent update spam |
| `DELETE /store/cart/:id/items/:itemId` | 20 | 1 min | Prevent remove spam |
| `POST /store/cart/:id/coupon` | **5** | 1 min | **Prevent coupon brute-forcing** |
| `DELETE /store/cart/:id/coupon` | 10 | 1 min | Normal usage |
| `POST /store/cart/merge` | 10 | 1 min | Prevent merge abuse |
| `DELETE /store/cart/:id` | 10 | 1 min | Prevent clear spam |

**Critical**: The coupon endpoint has a strict limit of **5 requests per minute** to prevent attackers from brute-forcing valid coupon codes.

### Checkout Endpoints

**Purpose**: Prevent checkout spam and payment abuse

| Endpoint | Limit | Window | Reason |
|----------|-------|--------|--------|
| `POST /store/checkout` | **10** | 1 min | Prevent checkout spam |
| `GET /store/checkout/:id` | 30 | 1 min | Frequent status checks allowed |
| `PUT /store/checkout/:id` | 10 | 1 min | Normal updates |
| `DELETE /store/checkout/:id` | **5** | 1 min | Strict limit on cancellations |

## Rate Limit Algorithms

### Token Bucket Algorithm

We use a **token bucket** algorithm:

1. Each user starts with a full bucket of tokens
2. Each request consumes 1 token
3. Tokens refill at a constant rate
4. When bucket is empty, requests are rejected with 429

**Benefits**:
- Allows short bursts (shopping cart updates)
- Prevents sustained abuse
- Fair across all users

### Keying Strategy

Rate limits are keyed by:

```
{IP Address}:{Tenant ID}:{Endpoint}
```

**Example**:
```
192.168.1.1:tenant-123:/store/cart/:id/coupon
```

This means:
- Different tenants don't affect each other's limits
- Different endpoints have independent limits
- IP address prevents single user from bypassing via multiple accounts

## Best Practices for API Clients

### 1. Implement Exponential Backoff

```typescript
async function apiCallWithRetry(url: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url);

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter
          ? parseInt(retryAfter) * 1000
          : Math.pow(2, i) * 1000; // Exponential backoff

        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      return response;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
    }
  }
}
```

### 2. Monitor Rate Limit Headers

```typescript
function checkRateLimitHeaders(response: Response) {
  const remaining = response.headers.get('X-RateLimit-Remaining');
  const reset = response.headers.get('X-RateLimit-Reset');

  if (remaining && parseInt(remaining) < 10) {
    console.warn(`Only ${remaining} requests remaining until ${new Date(parseInt(reset) * 1000)}`);
  }
}
```

### 3. Batch Requests When Possible

❌ **Bad**: Multiple sequential requests
```typescript
for (const item of items) {
  await addToCart(item); // 20 requests = 20 tokens
}
```

✅ **Good**: Single batched request
```typescript
await addMultipleItemsToCart(items); // 1 request = 1 token
```

### 4. Cache Responses

```typescript
const cartCache = new Map();

async function getCart(cartId: string) {
  if (cartCache.has(cartId)) {
    const cached = cartCache.get(cartId);
    if (Date.now() - cached.timestamp < 30000) { // 30 second cache
      return cached.data;
    }
  }

  const cart = await fetch(`/store/cart/${cartId}`);
  cartCache.set(cartId, { data: cart, timestamp: Date.now() });
  return cart;
}
```

## Handling Rate Limit Errors

### Client-Side

```typescript
async function handleApiCall(url: string, options?: RequestInit) {
  const response = await fetch(url, options);

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');

    // Show user-friendly message
    toast.error(
      `Too many requests. Please wait ${retryAfter} seconds before trying again.`
    );

    // Optionally retry automatically after wait period
    if (retryAfter) {
      await new Promise(resolve => setTimeout(resolve, parseInt(retryAfter) * 1000));
      return handleApiCall(url, options); // Retry
    }
  }

  return response;
}
```

### Server-Side (API Client)

```typescript
class ApiClient {
  private async callWithRetry(url: string, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const response = await fetch(url);

      if (response.status !== 429) {
        return response;
      }

      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`Rate limited. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('Max retries exceeded due to rate limiting');
  }
}
```

## Monitoring Your Usage

### Check Current Limits

```bash
curl -i https://api.example.com/api/v1/store/cart \
  -H "x-tenant-id: your-tenant-id"

# Check headers:
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 25
X-RateLimit-Reset: 1675123456
```

### Track Rate Limit Hits

Monitor your application logs for 429 responses:

```typescript
fetch(url)
  .then(response => {
    if (response.status === 429) {
      // Log to monitoring service
      analytics.track('rate_limit_hit', {
        endpoint: url,
        timestamp: Date.now(),
      });
    }
  });
```

## Requesting Limit Increases

If your legitimate use case requires higher limits:

1. **Document your use case**: Explain why you need higher limits
2. **Show historical usage**: Provide evidence of sustained traffic
3. **Describe mitigation**: Explain how you'll prevent abuse
4. **Contact support**: Email support@nosslag.com with above info

**We may approve increases for**:
- High-traffic stores (>10,000 daily users)
- Wholesale/B2B portals
- Mobile apps with offline sync
- Verified API integrations

## Internal API Endpoints (No Rate Limiting)

The following internal endpoints are **not rate limited**:

- Health checks: `/health`, `/metrics`
- Webhooks from verified sources (Stripe, SendGrid)
- System monitoring: `/monitoring/*`

However, these endpoints require authentication and are only accessible to authorized services.

## Future Enhancements

We're planning to add:

1. **Tenant-Level Quotas**: Fair usage across tenants
2. **Dynamic Rate Limiting**: Adjust limits based on system load
3. **Premium Tiers**: Higher limits for paid plans
4. **GraphQL Query Cost**: Limit based on query complexity
5. **WebSocket Rate Limiting**: Prevent real-time abuse

## FAQs

### Q: Why am I getting 429 errors even though I'm not making many requests?

**A**: Rate limits are per IP address + tenant + endpoint. If multiple users from the same IP (e.g., corporate network, VPN) are making requests, they share the same limit.

**Solution**: Implement request queuing on your client to stay within limits.

### Q: Can I whitelist my IP address?

**A**: No. Rate limiting is enforced for all clients to ensure fair usage. However, you can request higher limits for verified integrations.

### Q: What happens to requests in progress when the limit is reached?

**A**: Requests in progress continue. Only new requests are rejected with 429.

### Q: Do rate limits reset exactly at the timestamp?

**A**: Yes. The `X-RateLimit-Reset` header provides the exact Unix timestamp when your bucket refills.

### Q: Can I see my rate limit usage without making a real request?

**A**: Yes, make an OPTIONS request to any endpoint to see rate limit headers without consuming a token.

```bash
curl -X OPTIONS https://api.example.com/api/v1/store/cart \
  -H "x-tenant-id: your-tenant-id"
```

## Support

If you encounter issues with rate limiting:

- Email: support@nosslag.com
- Docs: https://docs.nosslag.com/rate-limiting
- Status: https://status.nosslag.com
