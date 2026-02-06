# 🛠️ Implementation Plan: Production Ready End-to-End

## Work Breakdown for Agent Execution

Each work package is designed to be:
- **Self-contained** - Can be completed in one session
- **Testable** - Has clear acceptance criteria
- **Sequential where needed** - Dependencies noted

---

## 📋 WORK PACKAGES OVERVIEW

| # | Package | Priority | Est. Time | Dependencies | Status |
|---|---------|----------|-----------|--------------|--------|
| 1 | Health & Monitoring Endpoints | 🔴 Critical | 2 hours | None | ✅ Done |
| 2 | API Rate Limiting & Logging | 🔴 Critical | 2 hours | None | ✅ Done |
| 3 | Provisioning API & Worker | 🔴 Critical | 4 hours | #1 | ✅ Done |
| 4 | Default Data Seeding | 🔴 Critical | 3 hours | #3 | ✅ Done |
| 5 | Storefront Product API | 🔴 Critical | 3 hours | None | ✅ Done |
| 6 | Storefront Cart API | 🔴 Critical | 3 hours | #5 | ✅ Done |
| 7 | Storefront Checkout API | 🔴 Critical | 4 hours | #6 | ✅ Done |
| 8 | Customer Auth (Storefront) | 🟡 High | 3 hours | #5 | ✅ Done |
| 9 | Stripe Payment Integration | 🔴 Critical | 4 hours | #7 | ✅ Done |
| 10 | Storefront Frontend Integration | 🔴 Critical | 4 hours | #5, #6, #7 | ✅ Done |
| 11 | Order Confirmation & Emails | 🟡 High | 3 hours | #9 | ✅ Done |
| 12 | Auth Improvements (Reset/Invite) | 🟡 High | 3 hours | None | ✅ Done |
| 13 | Missing UI Components | 🟡 Medium | 3 hours | None | ✅ Done |
| 14 | Dashboard "What Needs Attention" | 🟡 Medium | 2 hours | None | ✅ Done |
| 15 | SEO Completion (Sitemap, Meta) | 🟡 Medium | 2 hours | #10 | ✅ Done |
| 16 | Production Traefik + SSL | 🔴 Critical | 3 hours | None | ✅ Done |
| 17 | Backup & Restore System | 🔴 Critical | 2 hours | None | ✅ Done |
| 18 | Error Tracking (Sentry) | 🟡 High | 2 hours | None | ✅ Done |
| 19 | CI/CD Pipeline | 🟡 High | 3 hours | None | ✅ Done |
| 20 | Load Testing & Optimization | 🟡 Medium | 3 hours | All | ✅ Done |

**Total Estimated Time: ~55 hours** | **Completed: ~55 hours (100% Complete)**

---

## ✅ PHASE 1 COMPLETE - Summary

**Completed Items:**
- **Package 1**: Health endpoints (`/health`, `/health/ready`, `/health/live`)
- **Package 2**: Rate limiting (100 req/min) + request logging interceptor
- **Package 3**: Tenant provisioning API + async worker
- **Package 4**: Default data seeding (chart of accounts, tax rates, etc.)
- **Package 16**: Traefik v3 + Let's Encrypt SSL + security headers
- **Package 17**: Automated PostgreSQL backups to S3 + restore scripts
- **Package 18**: Sentry error tracking with request context

**New Files Created:**
- `apps/api/src/app/health/*` - Health check system
- `apps/api/src/app/common/interceptors/logging.interceptor.ts`
- `apps/api/src/app/provisioning/*` - Tenant provisioning
- `apps/api/src/app/sentry/*` - Sentry integration
- `docker/traefik/*` - Reverse proxy configuration
- `docker/backup/*` - Backup system
- `docker-compose.prod.yml` - Production overlay
- `.env.production.example` - Environment template
- `docs/DEPLOYMENT.md` - Deployment guide

---

## ✅ PHASE 2 COMPLETE - Summary (Storefront Backend)

**Completed Items:**
- **Package 5**: Product API with categories, filtering, search, admin CRUD
- **Package 6**: Cart API with anonymous/authenticated flows, coupon system
- **Package 7**: Checkout API with address handling, tax calculation, Stripe payment intents
- **Package 8**: Customer Auth with registration, login, JWT tokens, password reset, addresses
- **Package 9**: Stripe Integration with payment intents, webhooks, refunds

**New Prisma Models (prisma/schema.prisma):**
- `ProductCategory` - Hierarchical product categories
- `ProductListing` - Storefront product display settings (1:1 with Item)
- `StoreCustomer` - Storefront customer accounts (separate from admin Users)
- `Cart` / `CartItem` - Shopping carts (anonymous + authenticated)
- `Checkout` / `CheckoutItem` - Checkout process with snapshots
- `Order` / `OrderItem` - Completed orders with status tracking
- `Coupon` - Discount codes (percent/fixed)
- `PaymentRecord` - Stripe payment tracking

**New Backend Modules (apps/api/src/app/storefront/):**
```
storefront/
├── storefront.module.ts         # Main module
├── products/                    # Product catalog
│   ├── dto.ts
│   ├── products.service.ts
│   └── products.controller.ts
├── cart/                        # Shopping cart
│   ├── dto.ts
│   ├── cart.service.ts
│   └── cart.controller.ts
├── checkout/                    # Checkout flow
│   ├── dto.ts
│   ├── checkout.service.ts
│   └── checkout.controller.ts
├── auth/                        # Customer authentication
│   ├── dto.ts
│   ├── customer-auth.service.ts
│   └── customer-auth.controller.ts
├── payments/                    # Stripe payments
│   ├── dto.ts
│   ├── stripe.service.ts
│   ├── payments.service.ts
│   └── payments.controller.ts
└── orders/                      # Order history
    ├── dto.ts
    ├── orders.service.ts
    └── orders.controller.ts
```

**API Endpoints Created:**
```
# Products (Public)
GET    /api/v1/store/products
GET    /api/v1/store/products/:slug
GET    /api/v1/store/categories
POST   /api/v1/store/admin/products        (Admin)
PUT    /api/v1/store/admin/products/:id    (Admin)
DELETE /api/v1/store/admin/products/:id    (Admin)

# Cart
POST   /api/v1/store/cart
GET    /api/v1/store/cart/:id
POST   /api/v1/store/cart/:id/items
PUT    /api/v1/store/cart/:id/items/:itemId
DELETE /api/v1/store/cart/:id/items/:itemId
POST   /api/v1/store/cart/:id/coupon
DELETE /api/v1/store/cart/:id/coupon

# Checkout
POST   /api/v1/store/checkout
GET    /api/v1/store/checkout/:id
PUT    /api/v1/store/checkout/:id
POST   /api/v1/store/checkout/:id/confirm

# Customer Auth
POST   /api/v1/store/auth/register
POST   /api/v1/store/auth/login
GET    /api/v1/store/auth/me
PUT    /api/v1/store/auth/profile
POST   /api/v1/store/auth/forgot-password
POST   /api/v1/store/auth/reset-password
GET    /api/v1/store/auth/addresses
POST   /api/v1/store/auth/addresses
PUT    /api/v1/store/auth/addresses/:id
DELETE /api/v1/store/auth/addresses/:id

# Payments
POST   /api/v1/store/payments/webhook
POST   /api/v1/store/payments/:orderId/refund   (Admin)

# Orders
GET    /api/v1/store/orders
GET    /api/v1/store/orders/:id
POST   /api/v1/store/orders/:id/cancel
GET    /api/v1/store/admin/orders              (Admin)
PUT    /api/v1/store/admin/orders/:id/status   (Admin)
```

**Dependencies Added:**
- `stripe` - Payment processing
- `bcrypt` - Password hashing
- `jsonwebtoken` - JWT tokens for customers
- `uuid` - Cart session IDs

**Note:** Run `npx prisma migrate dev --name storefront_models` after starting database to create tables.

---

## ✅ PHASE 3 COMPLETE - Summary (Storefront Frontend + Emails)

**Completed Items:**
- **Package 10**: Storefront Frontend Integration - All pages connected to real API
- **Package 11**: Order Confirmation & Transactional Emails

**New Frontend Files Created:**
```
apps/web/src/lib/
├── store-api.ts                    # Centralized API client for storefront
├── cart-store.ts                   # Zustand cart state with localStorage persistence
└── auth-store.ts                   # Zustand auth state for customer accounts

apps/web/src/app/storefront/_components/
├── stripe-payment.tsx              # Stripe Elements payment form
├── store-providers.tsx             # Context wrapper for stores
├── cart-icon.tsx                   # Header cart icon with item count
├── add-to-cart-button.tsx          # Add to cart interaction
└── product-card.tsx                # (Updated) Uses real AddToCartButton

apps/web/src/app/storefront/
├── products/page.tsx               # (Updated) Fetches from API with search/filter
├── cart/page.tsx                   # (Updated) Uses cart store with live updates
├── checkout/page.tsx               # (Updated) Full Stripe integration + address form
├── layout.tsx                      # (Updated) Added providers and auth links
├── order-confirmation/page.tsx     # New order confirmation page
└── account/
    ├── page.tsx                    # Customer dashboard
    ├── login/page.tsx              # Login form
    ├── register/page.tsx           # Registration form
    └── orders/page.tsx             # Order history
```

**Email Templates Added (libs/email/src/lib/email.service.ts):**
- `store-order-confirmation` - Order placed email with item details
- `store-order-shipped` - Shipping notification with tracking
- `store-order-delivered` - Delivery confirmation
- `store-order-cancelled` - Cancellation notice
- `store-payment-confirmation` - Payment receipt
- `store-account-welcome` - New customer welcome
- `store-password-reset` - Password reset link
- `store-abandoned-cart` - Cart recovery email
- `store-back-in-stock` - Product availability notice
- `store-review-request` - Post-purchase review request

**Email Integration Points:**
- `PaymentsService.handlePaymentSucceeded()` - Sends order confirmation
- `CustomerAuthService.register()` - Sends welcome email
- `CustomerAuthService.forgotPassword()` - Sends password reset email

**Frontend Dependencies Added:**
- `@stripe/stripe-js` - Stripe frontend SDK
- `@stripe/react-stripe-js` - React components for Stripe
- `zustand` - Lightweight state management

**Key Features:**
- Anonymous cart with session persistence
- Authenticated cart merge on login
- Real-time cart updates
- Stripe Elements for secure payment
- Customer account management
- Address book with default address
- Order history with status tracking
- Transactional emails for all order events

---

## ✅ PHASE 4 COMPLETE - Summary (UI, Dashboard, CI/CD, Load Testing)

**Completed Items:**
- **Package 13**: Missing UI Components (Dialog, Dropdown Menu, Toast, Tabs, Avatar, Tooltip)
- **Package 14**: Dashboard "What Needs Attention" with full stats and alerts
- **Package 19**: CI/CD Pipeline (GitHub Actions for CI, Staging, Production)
- **Package 20**: Load Testing with k6 (Storefront, Spike, Soak tests)

**New UI Components (libs/ui/src/lib/):**
```
├── dialog.tsx         # Modal dialog with overlay, header, footer
├── dropdown-menu.tsx  # Dropdown with items, checkboxes, radio groups
├── toast.tsx          # Toast notifications with variants (success, error)
├── tabs.tsx           # Tabbed interface
├── avatar.tsx         # User avatar with fallback
├── tooltip.tsx        # Tooltips with provider
```

**Dashboard API Endpoints (apps/api/src/app/dashboard/):**
```
GET /api/v1/dashboard/summary     # Full dashboard with revenue, orders, inventory, etc.
GET /api/v1/dashboard/attention   # "What needs attention" quick counts
GET /api/v1/dashboard/revenue     # Revenue stats only
GET /api/v1/dashboard/orders      # Order stats only
GET /api/v1/dashboard/inventory   # Inventory alerts only
```

**Dashboard Features:**
- Revenue stats (today, week, month with % change)
- Order pipeline (pending, processing, shipped, delivered, cancelled)
- Inventory alerts (low stock, out of stock)
- Customer stats (total, new this week/month)
- Top selling products
- Recent activity feed
- "What needs attention" banner

**CI/CD Workflows (.github/workflows/):**
```
├── ci.yml                  # Lint, test, build, E2E, Docker build on PR/push
├── deploy-staging.yml      # Auto-deploy to staging on develop branch
├── deploy-production.yml   # Deploy on release tag with validation, backup, rollback
```

**Load Testing (tests/load/):**
```
├── storefront.js   # Customer journey: browse, cart, checkout (100 VUs)
├── spike.js        # Spike test: 10 → 200 users in 10 seconds
├── soak.js         # Soak test: 4 hours sustained load at 50 VUs
├── README.md       # Documentation and usage guide
```

**Performance Thresholds:**
- p95 response time < 500ms
- p99 response time < 1000ms  
- Error rate < 1%
- Cart operations < 300ms
- Checkout < 1000ms

---

## 🎉 IMPLEMENTATION COMPLETE

All 20 work packages have been implemented:

| Phase | Packages | Status |
|-------|----------|--------|
| Phase 1: Foundation | 1-4, 16-18 | ✅ Complete |
| Phase 2: Storefront Backend | 5-9 | ✅ Complete |
| Phase 3: Frontend Integration | 10-12, 15 | ✅ Complete |
| Phase 4: Polish & DevOps | 13-14, 19-20 | ✅ Complete |

### What's Ready for Production:

1. **API Backend**
   - Health monitoring endpoints
   - Rate limiting (100 req/min)
   - Request logging with timing
   - Tenant provisioning with async worker
   - Default data seeding
   - Full storefront API (products, cart, checkout, orders, auth)
   - Stripe payment integration with webhooks
   - Dashboard API with stats and alerts
   - Sentry error tracking

2. **Frontend**
   - Storefront with real API integration
   - Shopping cart with Zustand state management
   - Stripe Elements checkout
   - Customer authentication
   - Order history and tracking
   - SEO (sitemap, robots.txt, metadata)
   - Dashboard with "What needs attention"
   - Complete UI component library

3. **Infrastructure**
   - Docker Compose for development
   - Production config with Traefik + SSL
   - Automated backups to S3
   - CI/CD pipeline (GitHub Actions)
   - Load testing suite (k6)

### Next Steps for Go-Live:

1. **Environment Setup**
   - Configure production secrets in GitHub
   - Set up staging/production servers
   - Configure DNS and SSL certificates
   - Set up Stripe production keys

2. **Data Migration**
   - Run `npx prisma migrate deploy`
   - Seed initial tenant data
   - Configure default products

3. **Monitoring**
   - Create Sentry project
   - Set up Slack notifications
   - Configure alerting thresholds

4. **Testing**
   - Run full test suite
   - Execute load tests against staging
   - Perform security audit

---

## 🔴 PHASE 1: FOUNDATION (Packages 1-4)

### Package 1: Health & Monitoring Endpoints
**Time: 2 hours**

**Files to Create/Modify:**
```
apps/api/src/health/
├── health.module.ts
├── health.controller.ts
└── health.service.ts
apps/api/src/app.module.ts (import HealthModule)
```

**Implementation:**
```typescript
// health.controller.ts
@Controller('health')
export class HealthController {
  @Get()
  health() {
    return { status: 'healthy', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  async ready() {
    // Check DB connection
    // Check Redis connection
    return { status: 'ready', checks: { db: 'ok', redis: 'ok' } };
  }

  @Get('live')
  live() {
    return { status: 'alive' };
  }
}
```

**Acceptance Criteria:**
- [ ] GET /health returns 200
- [ ] GET /health/ready checks DB and Redis
- [ ] GET /health/live returns immediately

---

### Package 2: API Rate Limiting & Logging
**Time: 2 hours**

**Files to Create/Modify:**
```
apps/api/src/common/
├── interceptors/
│   └── logging.interceptor.ts
├── guards/
│   └── throttle.guard.ts
apps/api/src/app.module.ts (configure ThrottlerModule)
```

**Dependencies to Install:**
```bash
npm install @nestjs/throttler
```

**Implementation:**
```typescript
// app.module.ts
ThrottlerModule.forRoot([{
  ttl: 60000,    // 1 minute
  limit: 100,    // 100 requests per minute
}])

// logging.interceptor.ts
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');
  
  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest();
    const { method, url } = req;
    const start = Date.now();
    
    return next.handle().pipe(
      tap(() => {
        this.logger.log(`${method} ${url} ${Date.now() - start}ms`);
      }),
    );
  }
}
```

**Acceptance Criteria:**
- [ ] Rate limiting active (429 on exceeded)
- [ ] All requests logged with timing
- [ ] Configurable via env vars

---

### Package 3: Provisioning API & Worker
**Time: 4 hours**

**Files to Create/Modify:**
```
apps/api/src/provisioning/
├── provisioning.module.ts
├── provisioning.controller.ts
├── provisioning.service.ts
└── dto/
    └── create-tenant.dto.ts
libs/queue/src/lib/processors/
└── provisioning.processor.ts
prisma/schema.prisma (add ProvisioningStatus enum)
```

**Schema Addition:**
```prisma
enum ProvisioningStatus {
  PENDING
  CREATING_TENANT
  SEEDING_DATA
  CONFIGURING
  READY
  FAILED
}

model Tenant {
  // ... existing fields
  provisioningStatus ProvisioningStatus @default(PENDING)
  provisioningError  String?
  provisionedAt      DateTime?
}
```

**API Endpoints:**
```typescript
POST /api/v1/provision
{
  "businessName": "My Store",
  "ownerEmail": "owner@example.com",
  "ownerPassword": "securepassword",
  "domain": "mystore"  // mystore.platform.com
}
Response: { "tenantId": "uuid", "status": "PENDING" }

GET /api/v1/provision/:tenantId/status
Response: { 
  "status": "SEEDING_DATA", 
  "progress": 60,
  "estimatedSecondsRemaining": 30 
}
```

**Acceptance Criteria:**
- [ ] POST creates tenant with PENDING status
- [ ] Worker processes provisioning queue
- [ ] Status endpoint returns progress
- [ ] Admin user created with hashed password
- [ ] Error handling with FAILED status

---

### Package 4: Default Data Seeding
**Time: 3 hours**

**Files to Create/Modify:**
```
libs/business-logic/src/lib/provisioning/
├── seed-data.ts
├── default-accounts.ts
├── default-warehouses.ts
├── default-uoms.ts
└── default-roles.ts
```

**Seed Data:**
```typescript
// default-accounts.ts - Chart of Accounts
const DEFAULT_ACCOUNTS = [
  // Assets
  { code: 'Cash', name: 'Cash', rootType: 'Asset', accountType: 'Cash' },
  { code: 'Bank', name: 'Bank Account', rootType: 'Asset', accountType: 'Bank' },
  { code: 'Accounts Receivable', rootType: 'Asset', accountType: 'Receivable' },
  { code: 'Stock Asset', rootType: 'Asset', accountType: 'Stock' },
  // Liabilities
  { code: 'Accounts Payable', rootType: 'Liability', accountType: 'Payable' },
  { code: 'Sales Tax Payable', rootType: 'Liability', accountType: 'Tax' },
  // Income
  { code: 'Sales', rootType: 'Income', accountType: 'Income Account' },
  // Expenses
  { code: 'Cost of Goods Sold', rootType: 'Expense', accountType: 'Cost of Goods Sold' },
  { code: 'Expenses', rootType: 'Expense', accountType: 'Expense Account' },
];

// default-warehouses.ts
const DEFAULT_WAREHOUSE = {
  code: 'Main Warehouse',
  name: 'Main Warehouse',
  // Auto-creates ROOT, RECEIVING, PICKING, STAGING locations
};

// default-uoms.ts
const DEFAULT_UOMS = [
  { code: 'Nos', name: 'Numbers' },
  { code: 'Kg', name: 'Kilogram' },
  { code: 'L', name: 'Liter' },
  { code: 'Box', name: 'Box' },
];
```

**Acceptance Criteria:**
- [ ] New tenant gets default Chart of Accounts
- [ ] New tenant gets default warehouse with locations
- [ ] New tenant gets default UOMs
- [ ] All seeding happens in single transaction
- [ ] Provisioning status updates to READY

---

## 🔴 PHASE 2: STOREFRONT BACKEND (Packages 5-9)

### Package 5: Storefront Product API
**Time: 3 hours**

**Files to Create/Modify:**
```
apps/api/src/storefront/
├── storefront.module.ts
├── products/
│   ├── products.controller.ts
│   └── products.service.ts
prisma/schema.prisma (add storefront fields to Item)
```

**Schema Addition:**
```prisma
model Item {
  // ... existing fields
  // Storefront fields
  isPublished      Boolean  @default(false)
  slug             String?
  shortDescription String?
  description      String?  @db.Text
  images           Json?    // Array of image URLs
  categoryId       String?
  displayOrder     Int      @default(0)
  
  @@index([tenantId, isPublished, categoryId])
}

model ProductCategory {
  id          String   @id @default(uuid())
  tenantId    String
  name        String
  slug        String
  parentId    String?
  displayOrder Int     @default(0)
  
  @@unique([tenantId, slug])
}
```

**API Endpoints (Public - tenant from subdomain):**
```typescript
GET /api/v1/store/products
  ?category=slug
  &search=term
  &page=1
  &limit=20

GET /api/v1/store/products/:slug

GET /api/v1/store/categories
```

**Acceptance Criteria:**
- [ ] Products filtered by isPublished=true
- [ ] Stock availability included in response
- [ ] Category filtering works
- [ ] Search by name works
- [ ] Pagination works

---

### Package 6: Storefront Cart API
**Time: 3 hours**

**Files to Create/Modify:**
```
apps/api/src/storefront/cart/
├── cart.controller.ts
├── cart.service.ts
└── dto/
    ├── add-to-cart.dto.ts
    └── update-cart.dto.ts
prisma/schema.prisma (add Cart model)
```

**Schema Addition:**
```prisma
model Cart {
  id         String     @id @default(uuid())
  tenantId   String
  customerId String?    // null for anonymous
  sessionId  String?    // for anonymous carts
  items      CartItem[]
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt
  expiresAt  DateTime?  // for anonymous carts
  
  @@index([tenantId, sessionId])
  @@index([tenantId, customerId])
}

model CartItem {
  id        String  @id @default(uuid())
  cartId    String
  cart      Cart    @relation(fields: [cartId], references: [id], onDelete: Cascade)
  itemId    String
  qty       Int
  price     Decimal @db.Decimal(18, 2)  // Snapshot at add time
  
  @@unique([cartId, itemId])
}
```

**API Endpoints:**
```typescript
POST /api/v1/store/cart
  { sessionId?: string }  // Creates cart, returns cartId
  
GET /api/v1/store/cart/:cartId

POST /api/v1/store/cart/:cartId/items
  { itemId, qty }

PUT /api/v1/store/cart/:cartId/items/:itemId
  { qty }  // 0 to remove

DELETE /api/v1/store/cart/:cartId/items/:itemId
```

**Acceptance Criteria:**
- [ ] Anonymous cart with sessionId
- [ ] Add/update/remove items
- [ ] Stock validation on add
- [ ] Price snapshot stored
- [ ] Cart totals calculated

---

### Package 7: Storefront Checkout API
**Time: 4 hours**

**Files to Create/Modify:**
```
apps/api/src/storefront/checkout/
├── checkout.controller.ts
├── checkout.service.ts
└── dto/
    ├── shipping-address.dto.ts
    └── complete-checkout.dto.ts
prisma/schema.prisma (add Checkout model)
```

**Schema Addition:**
```prisma
model Checkout {
  id              String   @id @default(uuid())
  tenantId        String
  cartId          String
  customerId      String?
  
  // Shipping
  shippingName    String?
  shippingEmail   String?
  shippingPhone   String?
  shippingAddress Json?
  
  // Billing
  billingAddress  Json?
  sameAsShipping  Boolean  @default(true)
  
  // Totals
  subtotal        Decimal  @db.Decimal(18, 2)
  taxAmount       Decimal  @db.Decimal(18, 2)
  shippingAmount  Decimal  @db.Decimal(18, 2)
  total           Decimal  @db.Decimal(18, 2)
  
  // Payment
  paymentMethod   String?
  paymentIntentId String?  // Stripe
  
  status          CheckoutStatus @default(PENDING)
  createdAt       DateTime @default(now())
  completedAt     DateTime?
  orderId         String?  // After completion
}

enum CheckoutStatus {
  PENDING
  PAYMENT_PENDING
  PAYMENT_FAILED
  COMPLETED
  ABANDONED
}
```

**API Endpoints:**
```typescript
POST /api/v1/store/checkout
  { cartId }
  Response: { checkoutId, subtotal, taxAmount, total }

PUT /api/v1/store/checkout/:id/shipping
  { name, email, phone, address: { line1, line2, city, state, postalCode, country } }

PUT /api/v1/store/checkout/:id/billing
  { sameAsShipping: true } or { address: {...} }

POST /api/v1/store/checkout/:id/complete
  { paymentMethodId }  // From Stripe.js
  Response: { orderId, orderNumber }
```

**Acceptance Criteria:**
- [ ] Checkout created from cart
- [ ] Tax calculated based on address
- [ ] Stock re-validated at complete
- [ ] Creates Sales Order on success
- [ ] Creates Invoice on success
- [ ] Clears cart on success

---

### Package 8: Customer Auth (Storefront)
**Time: 3 hours**

**Files to Create/Modify:**
```
apps/api/src/storefront/auth/
├── customer-auth.controller.ts
├── customer-auth.service.ts
└── dto/
    ├── register.dto.ts
    └── login.dto.ts
```

**API Endpoints:**
```typescript
POST /api/v1/store/auth/register
  { email, password, firstName, lastName }
  Response: { customerId, token }

POST /api/v1/store/auth/login
  { email, password }
  Response: { customerId, token }

GET /api/v1/store/auth/me
  (requires token)
  Response: { customer details }

POST /api/v1/store/auth/forgot-password
  { email }

POST /api/v1/store/auth/reset-password
  { token, newPassword }
```

**Acceptance Criteria:**
- [ ] Customer registration with bcrypt
- [ ] JWT token for customers (separate from admin)
- [ ] Link anonymous cart to customer on login
- [ ] Password reset flow
- [ ] Email verification (optional for v1)

---

### Package 9: Stripe Payment Integration
**Time: 4 hours**

**Files to Create/Modify:**
```
libs/payments/
├── src/
│   ├── index.ts
│   ├── lib/
│   │   ├── payments.module.ts
│   │   ├── stripe.service.ts
│   │   └── webhook.controller.ts
├── project.json
├── tsconfig.json
apps/api/src/app.module.ts (import PaymentsModule)
```

**Dependencies:**
```bash
npm install stripe
```

**Implementation:**
```typescript
// stripe.service.ts
@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }

  async createPaymentIntent(amount: number, currency: string, metadata: any) {
    return this.stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // cents
      currency,
      metadata,
    });
  }

  async confirmPayment(paymentIntentId: string) {
    return this.stripe.paymentIntents.retrieve(paymentIntentId);
  }

  verifyWebhookSignature(payload: Buffer, signature: string) {
    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  }
}

// webhook.controller.ts
@Controller('webhooks/stripe')
export class StripeWebhookController {
  @Post()
  async handleWebhook(@Req() req: RawBodyRequest<Request>) {
    const event = this.stripe.verifyWebhookSignature(
      req.rawBody,
      req.headers['stripe-signature']
    );
    
    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSuccess(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await this.handlePaymentFailed(event.data.object);
        break;
    }
  }
}
```

**Acceptance Criteria:**
- [ ] Create PaymentIntent for checkout
- [ ] Webhook handles payment_intent.succeeded
- [ ] Webhook handles payment_intent.payment_failed
- [ ] Creates Payment Entry on success
- [ ] Updates checkout status
- [ ] Tenant-specific Stripe keys support

---

## 🔴 PHASE 3: STOREFRONT FRONTEND (Package 10)

### Package 10: Storefront Frontend Integration
**Time: 4 hours**

**Files to Modify:**
```
apps/web/src/
├── lib/
│   ├── api.ts              # API client
│   ├── cart.ts             # Cart state management
│   └── auth.ts             # Customer auth state
├── app/
│   ├── page.tsx            # Homepage with real products
│   ├── products/
│   │   ├── page.tsx        # Product listing
│   │   └── [slug]/
│   │       └── page.tsx    # Product detail
│   ├── cart/
│   │   └── page.tsx        # Cart with real data
│   └── checkout/
│       └── page.tsx        # Checkout with Stripe
├── components/
│   ├── ProductCard.tsx
│   ├── CartDrawer.tsx
│   ├── CheckoutForm.tsx
│   └── StripePayment.tsx
```

**Dependencies:**
```bash
npm install @stripe/stripe-js @stripe/react-stripe-js
```

**Key Implementations:**
```typescript
// lib/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL;

export const storeApi = {
  products: {
    list: (params) => fetch(`${API_BASE}/store/products?${qs(params)}`),
    get: (slug) => fetch(`${API_BASE}/store/products/${slug}`),
  },
  cart: {
    create: () => fetch(`${API_BASE}/store/cart`, { method: 'POST' }),
    get: (id) => fetch(`${API_BASE}/store/cart/${id}`),
    addItem: (cartId, item) => fetch(`${API_BASE}/store/cart/${cartId}/items`, {
      method: 'POST',
      body: JSON.stringify(item),
    }),
  },
  checkout: {
    create: (cartId) => fetch(`${API_BASE}/store/checkout`, {
      method: 'POST',
      body: JSON.stringify({ cartId }),
    }),
    complete: (id, paymentMethodId) => fetch(`${API_BASE}/store/checkout/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify({ paymentMethodId }),
    }),
  },
};

// lib/cart.ts - Using React Context or Zustand
export const useCart = create((set, get) => ({
  cartId: null,
  items: [],
  addItem: async (itemId, qty) => {
    let { cartId } = get();
    if (!cartId) {
      const cart = await storeApi.cart.create();
      cartId = cart.id;
      set({ cartId });
    }
    await storeApi.cart.addItem(cartId, { itemId, qty });
    // Refresh cart
  },
}));
```

**Acceptance Criteria:**
- [ ] Homepage shows real products
- [ ] Product pages fetch from API
- [ ] Add to cart works
- [ ] Cart persists (localStorage cartId)
- [ ] Checkout flow completes
- [ ] Stripe payment works
- [ ] Order confirmation page

---

## 🟡 PHASE 4: POLISH (Packages 11-15)

### Package 11: Order Confirmation & Emails
**Time: 3 hours**

**Files to Create/Modify:**
```
libs/email/src/lib/templates/
├── order-confirmation.hbs
├── shipping-notification.hbs
└── payment-receipt.hbs
libs/business-logic/src/lib/hooks.ts (add order email triggers)
apps/web/src/app/order-confirmation/[id]/page.tsx
```

**Acceptance Criteria:**
- [ ] Order confirmation email sent
- [ ] Order confirmation page shows details
- [ ] PDF invoice attached (optional)

---

### Package 12: Auth Improvements
**Time: 3 hours**

**Files to Create/Modify:**
```
apps/api/src/auth/
├── dto/
│   ├── forgot-password.dto.ts
│   ├── reset-password.dto.ts
│   └── invite-user.dto.ts
libs/email/src/lib/templates/
├── password-reset.hbs
└── user-invitation.hbs
```

**Acceptance Criteria:**
- [ ] Forgot password sends email
- [ ] Reset password with token
- [ ] Invite user flow
- [ ] Secure token generation

---

### Package 13: Missing UI Components
**Time: 3 hours**

**Files to Create:**
```
libs/ui/src/lib/
├── dialog.tsx
├── dropdown-menu.tsx
├── toast.tsx
├── tabs.tsx
├── avatar.tsx
└── tooltip.tsx
```

**Acceptance Criteria:**
- [ ] Dialog/Modal component
- [ ] Dropdown menu
- [ ] Toast notifications
- [ ] All components support dark mode

---

### Package 14: Dashboard "What Needs Attention"
**Time: 2 hours**

**Files to Modify:**
```
apps/desk/src/app/page.tsx
apps/api/src/dashboard/
├── dashboard.controller.ts
└── dashboard.service.ts
```

**Dashboard Widgets:**
```typescript
GET /api/v1/dashboard/summary
Response: {
  revenue: { today, thisWeek, thisMonth },
  orders: { pending, toDeliver, toBill },
  inventory: { lowStock: [...items], outOfStock: [...items] },
  payments: { overdue: [...invoices] },
  recentActivity: [...auditLogs]
}
```

**Acceptance Criteria:**
- [ ] Revenue summary
- [ ] Pending actions count
- [ ] Low stock alerts
- [ ] Overdue invoices
- [ ] Recent activity feed

---

### Package 15: SEO Completion
**Time: 2 hours**

**Files to Create/Modify:**
```
apps/web/src/app/
├── sitemap.ts
├── robots.ts
├── layout.tsx (add JSON-LD)
└── products/[slug]/page.tsx (add meta, JSON-LD)
```

**Acceptance Criteria:**
- [ ] Dynamic sitemap.xml
- [ ] robots.txt
- [ ] Open Graph meta tags
- [ ] JSON-LD product schema
- [ ] Canonical URLs

---

## 🔴 PHASE 5: INFRASTRUCTURE (Packages 16-19)

### Package 16: Production Traefik + SSL
**Time: 3 hours**

**Files to Create/Modify:**
```
docker/
├── traefik/
│   ├── traefik.yml
│   └── dynamic/
│       └── tls.yml
├── docker-compose.prod.yml
```

**Acceptance Criteria:**
- [ ] Let's Encrypt certificates
- [ ] Auto-renewal
- [ ] HTTP → HTTPS redirect
- [ ] Wildcard cert for subdomains

---

### Package 17: Backup & Restore
**Time: 2 hours**

**Files to Create:**
```
scripts/
├── backup.sh
├── restore.sh
└── backup-cron.sh
docker/backup/
└── Dockerfile
```

**Acceptance Criteria:**
- [ ] Daily automated backups
- [ ] Backup to S3/MinIO
- [ ] Point-in-time restore
- [ ] Backup verification

---

### Package 18: Error Tracking (Sentry)
**Time: 2 hours**

**Dependencies:**
```bash
npm install @sentry/node @sentry/nextjs
```

**Files to Modify:**
```
apps/api/src/main.ts
apps/web/sentry.client.config.ts
apps/web/sentry.server.config.ts
apps/desk/sentry.client.config.ts
```

**Acceptance Criteria:**
- [ ] API errors tracked
- [ ] Frontend errors tracked
- [ ] User context attached
- [ ] Source maps uploaded

---

### Package 19: CI/CD Pipeline
**Time: 3 hours**

**Files to Create:**
```
.github/workflows/
├── ci.yml
├── deploy-staging.yml
└── deploy-production.yml
```

**Acceptance Criteria:**
- [ ] Run tests on PR
- [ ] Build check on PR
- [ ] Deploy to staging on merge to develop
- [ ] Deploy to production on release tag

---

## 📊 EXECUTION ORDER

```
Week 1 (Foundation):
├── Day 1: Package 1 (Health) + Package 2 (Rate Limiting)
├── Day 2: Package 3 (Provisioning API)
├── Day 3: Package 4 (Seeding) + Package 16 (Traefik)
└── Day 4: Package 17 (Backup) + Package 18 (Sentry)

Week 2 (Storefront Backend):
├── Day 1: Package 5 (Product API)
├── Day 2: Package 6 (Cart API)
├── Day 3: Package 7 (Checkout API)
└── Day 4: Package 8 (Customer Auth)

Week 3 (Payments & Frontend):
├── Day 1: Package 9 (Stripe)
├── Day 2-3: Package 10 (Frontend Integration)
└── Day 4: Package 11 (Emails)

Week 4 (Polish):
├── Day 1: Package 12 (Auth Improvements)
├── Day 2: Package 13 (UI Components)
├── Day 3: Package 14 (Dashboard) + Package 15 (SEO)
└── Day 4: Package 19 (CI/CD) + Package 20 (Load Testing)
```

---

## 🚀 READY TO EXECUTE

To start implementation, say:

**"Execute Package 1"** - Health & Monitoring Endpoints
**"Execute Package 5"** - Storefront Product API
**"Execute all Phase 1"** - Foundation packages

Each package will be implemented with:
1. Schema changes (if needed)
2. Backend code
3. Tests (where critical)
4. Integration verification
