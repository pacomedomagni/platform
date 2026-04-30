# NoSlag Platform — Tenant Features

A comprehensive reference of every feature available to tenants on the NoSlag platform.

---

## Table of Contents

1. [Dashboard](#1-dashboard)
2. [Onboarding & Getting Started](#2-onboarding--getting-started)
3. [Products](#3-products)
4. [Orders](#4-orders)
5. [Customers](#5-customers)
6. [Inventory Management](#6-inventory-management)
7. [Earnings & Payouts](#7-earnings--payouts)
8. [Marketplace Integration (eBay)](#8-marketplace-integration-ebay)
9. [Reviews](#9-reviews)
10. [Operations](#10-operations)
11. [Reports & Analytics](#11-reports--analytics)
12. [Themes](#12-themes)
13. [Settings](#13-settings)
14. [Storefront (Customer-Facing)](#14-storefront-customer-facing)
15. [Advanced ERP Mode](#15-advanced-erp-mode)

---

## 1. Dashboard

The home screen gives tenants a real-time snapshot of their business.

- **Stat cards** — Total Revenue, Total Orders, Published Products, and Payment Status (connected provider or "Not Set Up").
- **Earnings Quick View** — When payments are connected, displays available balance, pending balance, and a link to the full Earnings page.
- **Recent Orders** — A table of the 5 most recent orders with order number, customer email, amount, status, and date.
- **Store Status Badge** — Shows "Store is Live" with the publish date once the store has been published.
- **Getting Started Checklist** — Progress tracker (e.g. "3 of 6 done") that appears until every setup step is complete.
- **New Merchant Empty State** — Quick-action cards ("Add your first product", "Connect payments", "Customize your store") shown when the store has zero revenue, orders, and products.
- **Email Verification Banner** — Persistent warning until the tenant verifies their email, with a one-click "Resend Email" button.

---

## 2. Onboarding & Getting Started

A guided setup flow to take new tenants from sign-up to a live store.

### Setup Checklist Steps

| Step | Description |
|------|-------------|
| Verify your email | Confirmation link sent at sign-up; resend available from dashboard |
| Connect payments | Link a Stripe or Square account |
| Add your first product | Create the first product listing |
| Configure shipping & tax | Set tax rate, shipping rate, and free-shipping threshold |
| Add legal pages | Write Terms of Service, Privacy Policy, and Refund Policy |
| Publish your store | Make the storefront publicly accessible |

- The checklist is shown on both the Dashboard and a dedicated Getting Started page.
- Each step links directly to the relevant settings or creation page.
- The "Publish your store" step can be completed with a single click from the checklist.

---

## 3. Products

Full product catalog management.

### Core Capabilities

- **Create products** — Name, slug, short description, price, compare-at price, images, published/draft status, and featured flag.
- **Edit products** — Update any product field, manage images.
- **Delete products** — Remove products from the catalog.
- **Product search** — Server-side debounced search across all products.
- **Pagination** — Navigate through large catalogs with previous/next controls and "Showing X-Y of Z" counts.
- **Product import** — Bulk upload products from a file.

### Product Variants

- Manage variants per product (e.g. different sizes, colors).
- Each variant can have its own pricing and inventory.
- Variant attributes are fully configurable.

### Product Display

- Products show thumbnail image, name, description, price (with strikethrough for compare-at price), published/draft badge, featured badge, and stock status.

---

## 4. Orders

End-to-end order lifecycle management.

### Order Statuses

| Status | Description |
|--------|-------------|
| Pending | Order placed, awaiting confirmation |
| Confirmed | Order confirmed by the merchant |
| Processing | Order is being prepared |
| Shipped | Order has been shipped |
| Delivered | Order delivered to customer |
| Cancelled | Order was cancelled |
| Refunded | Payment has been refunded |

### Features

- **Order list** — Searchable, filterable table of all orders.
- **Stat cards** — Live counts for Pending, Processing, Shipped, and Delivered orders.
- **Filters** — Filter by order status and payment status; free-text search.
- **Auto-refresh** — Order list refreshes automatically every 30 seconds (toggleable).
- **Export to CSV** — Download filtered orders as a CSV file.
- **Order detail** — Click any order to view full details (items, customer info, payment, shipping).

---

## 5. Customers

Customer relationship management with segmentation.

### Customer Data

Each customer record includes: name, email (with verified badge), phone, active/inactive status, order count, total amount spent, last order date, segment badge, and join date.

### Segmentation

| Segment | Criteria |
|---------|----------|
| New | Account created within the last 30 days |
| High Value | Total spent exceeds $500 |
| VIP | Total spent exceeds $1,000 AND 5+ orders |
| At Risk | No order placed in the last 90 days |

### Features

- **Search** — Find customers by name or email.
- **Filter by segment** — New, High Value, VIP, At Risk, or All.
- **Export to CSV** — Download the full customer list.
- **Customer detail** — Click any customer to view their full profile, order history, and addresses.

---

## 6. Inventory Management

Track stock across warehouses with support for batches and serial numbers.

### Modules

| Module | Description |
|--------|-------------|
| Stock Movements | Track receipts, issues, transfers, and adjustments |
| Batch Tracking | Manage product batches with expiry dates |
| Serial Numbers | Track individual items with unique serial identifiers |

### Linked Reports

- **Stock Balance** — Current stock levels across all warehouses.
- **Stock Valuation** — Inventory value and cost-of-goods-sold analysis.
- **Reorder Suggestions** — Items that have fallen below reorder thresholds.

---

## 7. Earnings & Payouts

Revenue tracking and payout management via Stripe Connect.

### Balance Overview

| Card | Description |
|------|-------------|
| Available Balance | Funds ready for payout |
| Pending Balance | Funds still processing (typically 2–7 days) |
| Total Balance | Available + Pending |
| Next Payout | Amount and estimated arrival date of the next scheduled payout |

### Features

- **Platform fee disclosure** — Shows the percentage fee deducted from each transaction.
- **Payout history** — Table of all payouts with date, amount, status (Paid, Pending, In Transit, Canceled, Failed), and arrival date.
- **Stripe Dashboard link** — One-click access to the tenant's Stripe Express dashboard.
- **Refresh** — Manually reload balance and payout data.
- **How Payouts Work** — Visual explainer: Customer Pays → Processing Period → Automatic Payout.

---

## 8. Marketplace Integration (eBay)

List and sell products on eBay alongside your storefront. eBay is a separate
sales channel — storefront customers never see eBay listings, and eBay buyers
never see the storefront. The two channels meet only at the inventory layer
(see [Inventory model](#inventory-model) below).

> **In-depth tenant guide:** [ebay-integration-guide.md](ebay-integration-guide.md).
> **Developer architecture:** [apps/api/.../ebay/README.md](../apps/api/src/app/marketplace-integrations/ebay/README.md).

### Connections

- **Connect eBay stores** — OAuth flow for any of the major eBay marketplaces
  (US, UK, DE, FR, IT, ES, CA, AU). Multiple stores per tenant supported.
- **Scope validation** — If the seller de-selects a required permission on
  eBay's consent screen, the connect flow fails fast with a clear "missing
  scopes" message rather than failing opaquely later.
- **Business policies auto-fetch** — On successful connect, the platform pulls
  the seller's payment, shipping, and return policies plus inventory location
  from eBay and saves them as connection defaults.
- **Connection status badge** — Each connection shows whether OAuth is live,
  policies are set, and the store is ready to publish.
- **Default store** — Mark one connection as the default for new listings.
- **Disconnect** — Revokes the refresh token on eBay's side and clears local
  credentials. Best-effort: disconnection succeeds locally even if the remote
  revoke fails.
- **Reconnect** — Re-run OAuth on a disconnected connection without losing
  listing/order history.
- **Delete** — Removes the connection record. Blocked if any listings or orders
  exist (deactivate instead).

### Listings

- **Create listings** — SKU, title, description, photos (up to 24), condition,
  category, item specifics, price, quantity, package weight/dimensions.
- **Formats** — Fixed-price (GTC), Auction (with start price, reserve, Buy It
  Now), Best Offer.
- **Approval workflow** — Optional two-person rule: Inventory Manager creates
  drafts; Admin / System Manager approves before publish.
- **Publish to eBay** — Multi-step publish (image upload → inventory item →
  offer → publish). Full rollback on partial failure: the platform withdraws
  any offer it created and deletes the inventory item if the final publish
  step fails, so eBay never holds an orphaned half-listing.
- **Edit live listings** — Price, quantity, and description on a published
  listing can be edited via eBay's offer-update API. Subject to eBay's
  250-revisions-per-listing-per-day cap, which the platform tracks and
  surfaces clearly.
- **End listings** — Withdraw a live listing from eBay; the local record
  remains in **Ended** status.
- **Schedule publish** — Set a future publish date (within 3 weeks) for a
  draft or approved listing.
- **Multi-variation listings** — Group SKUs into a single eBay listing with
  variation aspects (size, color, …). All variants share images and
  description; each has its own SKU, price, and quantity.
- **Out-of-Stock Control** — Per-store toggle: when on, listings with 0
  quantity stay active (hidden from search) instead of auto-ending.
- **Vacation mode** — Per-store toggle (via eBay's Trading API): pause sales
  with an automated buyer message.

### Inventory model

How stock is shared between the storefront and eBay is one decision per
listing — the choice of warehouse:

- **Per-listing warehouse selection** — When you create an eBay listing, you
  pick which warehouse it sells against. eBay's "available quantity" is
  computed as that warehouse's actual stock minus reservations.
- **Shared warehouse strategy** — Pointing both the storefront and eBay at
  the same warehouse keeps a single stock pool. Trade-off: changes propagate
  to eBay on the 30-minute sync cycle, so a brief overselling window exists
  for fast-moving SKUs.
- **Dedicated eBay warehouse strategy** — Allocate a separate warehouse for
  eBay to isolate the channels entirely. No cross-channel overselling, but
  you manage two stock pools.
- **Push-to-eBay sync** — Every 30 minutes, a background job recomputes
  available quantity per published listing and pushes it to eBay via the
  Inventory API. Enabled per connection via `autoSyncInventory` (on by
  default).
- **Distributed locks** — Sync uses Redis-backed locks at both the connection
  and SKU level so multiple app instances never double-update the same
  listing.

### Orders

- **Order ingestion** — eBay orders flow into the platform every 15 minutes
  via the Fulfillment API, plus real-time webhook notifications. Incremental
  sync uses `lastModifiedDate` with a 5-minute overlap to avoid gaps.
- **Per-page checkpointing** — The sync watermark advances per-page, so a
  partial failure on page 7 of 10 doesn't replay every page on the next
  cycle.
- **Auto-create unified orders** — Paid eBay orders automatically create a
  matching `Order` record in the unified order system, prefixed `MKT-…`,
  surfacing in the regular Orders page alongside storefront orders.
- **Failed-operation queue** — Per-order sync failures are routed to the
  failed-operations queue for automated retry instead of blocking the rest
  of the sync.
- **Push fulfillment** — Tracking number + carrier from the platform's ship
  flow are pushed to eBay's Fulfillment API automatically.
- **Refunds** — Full-order, partial, or line-item-level refunds via eBay's
  refund API.
- **Returns & cancellations** — Buyer-initiated returns flow into the Returns
  page; approve, decline, or refund from there. Cancellations supported via
  the Post-Order API.
- **Order filtering** — Filter by store, fulfillment status, payment status,
  sync status.

### Webhooks & compliance

- **Notification handler** — eBay marketplace notifications (order created /
  updated, item sold, return created, …) are signature-verified using ECDSA
  against eBay's public-key endpoint, then routed to the appropriate sync
  handler.
- **Challenge handshake** — Both notification and account-deletion endpoints
  respond to eBay's verification GET with the spec-compliant SHA-256
  challenge.
- **Account-deletion compliance** — Required by eBay's program. When a seller
  deletes their eBay account, the webhook anonymizes every matching
  connection across all tenants.
- **Sandbox vs. production** — All eBay endpoints (auth, API, webhook key
  fetch) respect the `EBAY_SANDBOX` environment flag.

### Messaging, promotions, and analytics

- **Buyer-seller messaging** — Inbound messages flow into Marketplace →
  Messages; replies post back to eBay's messaging system.
- **Promotions & campaigns** — Create promotional discounts, item promotions,
  and email campaigns directly via eBay's Marketing API.
- **Store categories** — Manage your eBay store's custom category hierarchy
  from Marketplace → Settings.
- **Analytics** — Traffic, conversion, and seller-performance metrics from
  eBay's Analytics API.
- **Finances** — Payouts, transactions, and fee reporting from eBay's
  Finances API.
- **Negotiations, offers, disputes, inquiries, feedback** — Each surfaced as
  its own page under the Marketplace section.

### RBAC

- **Per-permission control** — Marketplace permissions
  (`marketplace.connections.manage`, `marketplace.listings.publish`, etc.)
  are managed under Marketplace → Settings → Permissions.
- **Default role templates** — Admin, System Manager, Inventory Manager,
  Customer Service templates ship with the platform; tenants can customize.

### Reliability

- **Token refresh serialization** — Redis distributed lock ensures only one
  app instance refreshes an expiring access token at a time, even across
  pods.
- **Token rate limiting** — Per-grant-type daily counters track eBay's OAuth
  quotas (10,000/day for auth code, 50,000/day for refresh) with Redis
  storage and in-memory fallback.
- **Mock mode** — `MOCK_EXTERNAL_SERVICES=true` disables every outbound eBay
  call for local dev and CI, returning deterministic mock responses.

---

## 9. Reviews

Customer review moderation and engagement.

### Features

- **Review list** — All reviews with star rating, title, content, pros/cons, images, reviewer name, customer email, date, and verified-purchase badge.
- **Status filtering** — View All, Pending, Approved, or Rejected reviews.
- **Search** — Search reviews by title, content, product name, or reviewer name.
- **Single moderation** — Approve or reject individual reviews.
- **Bulk moderation** — Select multiple reviews and approve or reject them all at once.
- **Admin response** — Write a public reply to any approved review.
- **Delete reviews** — Permanently remove reviews with confirmation dialog.
- **Pagination** — Navigate through reviews page by page.

---

## 10. Operations

System administration, integrations, and data management tools.

### Webhooks

- Configure webhook endpoints to receive real-time event notifications.
- Monitor delivery status and retry failed deliveries.

### Audit Logs

- View a complete history of system activity and changes.
- Filter by entity type and date range.

### Background Jobs

- Monitor scheduled and running background tasks.
- View job status, retry failed jobs, and cancel running ones.

### Notifications

- Manage notification templates and alert configurations.

### Import Data

- Bulk import products, customers, and other data from files.

### Export Data

- Export data in CSV, JSON, or Excel format.
- Dedicated export endpoints for orders and customers (also accessible from those pages).

---

## 11. Reports & Analytics

### Analytics Dashboard

A real-time business intelligence view with date-range filtering and day/week/month grouping.

**Sales KPIs:**
- Total Revenue (with growth % vs. previous period)
- Order Count (with growth % vs. previous period)
- Average Order Value
- Customer Count

**Inventory KPIs:**
- Total Inventory Value
- Low Stock Items count
- Dead Stock Items count

**Charts & Breakdowns:**
- Sales Trends bar chart (last 14 periods)
- Revenue by Category (with percentage bars)
- Top 5 Selling Products (ranked by revenue)
- Revenue by Payment Method

**Export:**
- Export Sales report to CSV
- Export Inventory report to CSV

### Financial Reports

| Report | Description |
|--------|-------------|
| Trial Balance | Account balances as of a specific date |
| Balance Sheet | Assets, liabilities, and equity snapshot |
| Profit & Loss | Revenue and expenses over a date range |
| Cash Flow | Cash inflows and outflows analysis |
| General Ledger | Detailed journal entries by account |
| Receivable Aging | Outstanding customer receivables by age bucket |
| Payable Aging | Outstanding supplier payables by age bucket |

### Inventory Reports

| Report | Description |
|--------|-------------|
| Stock Balance | Current quantities across all warehouses |
| Stock Ledger | Historical record of all stock movements |
| Stock Movement | Detailed movement transactions |
| Stock Valuation | Monetary value of current inventory |
| Stock Aging | How long stock has been held |
| Reorder Suggestions | Items needing replenishment |
| Serials | Serial number tracking and lookup |
| Locations | Stock data by warehouse/bin location |

---

## 12. Themes

Storefront appearance customization.

### Features

- **Browse themes** — View all available themes in a card grid.
- **Preset themes** — Platform-provided starter themes.
- **Custom themes** — Tenant-created themes.
- **Activate a theme** — Apply a theme to the live storefront with one click.
- **Create new themes** — Start from scratch or from a preset base.
- **Duplicate themes** — Clone an existing theme to use as a starting point.
- **Edit themes** — Customize theme settings (colors, typography, layout, etc.).
- **Delete themes** — Remove custom themes (with confirmation).
- **Search & filter** — Search by name/description; filter by All, Presets, or Custom.

---

## 13. Settings

Store configuration organized into four sections.

### Store Details

- Business name and store URL configuration.

### Payments

- **Connect a payment provider** — Stripe (via Stripe Connect) or Square (via OAuth).
- **Provider status** — View whether the provider is Active, Onboarding, or Disabled.
- **Stripe details** — Charges enabled/disabled, Payouts enabled/disabled, Details submitted status.
- **Square details** — Merchant ID and Location ID.
- **Platform fees** — View the percentage fee and fixed fee per transaction.
- **Stripe Dashboard** — Direct link to the Stripe Express dashboard.
- **Reconnect** — Re-initiate the onboarding flow if the connection is disabled.

### Shipping & Tax

- **Default tax rate** — Set a global tax percentage.
- **Default shipping rate** — Flat-rate fallback when no zones match.
- **Free shipping threshold** — Order amount above which shipping is free.
- **Shipping zones** — Create zones by country (ISO codes). Each zone can have multiple rates.
- **Shipping rates** — Add rates to zones with a name, price, and type (Flat Rate, Weight Based, or Price Based).
- **Manage zones & rates** — Add, edit, and delete zones and their rates.

### Legal Pages

- **Terms of Service** — Write and publish store terms.
- **Privacy Policy** — Write and publish a privacy policy.
- **Refund Policy** — Write and publish a refund policy.
- HTML content editor with publish/draft toggle per page.

---

## 14. Storefront (Customer-Facing)

The public online store that end customers interact with.

### Pages

- **Homepage** — Store landing page.
- **Product catalog** — Browse and search products.
- **Product detail** — View product info, images, variants, and reviews.
- **Cart** — Add/remove items, apply discount codes.
- **Checkout** — Enter shipping address, select shipping method, pay.
- **Order confirmation** — Post-purchase summary.
- **Custom pages** — Tenant-authored content pages (legal, about, etc.).

### Customer Accounts

- **Registration & login** — Create an account or sign in.
- **Email verification** — Confirm email address.
- **Password reset** — Self-service password recovery.
- **Profile management** — Update personal information.
- **Address book** — Manage saved shipping addresses.
- **Order history** — View past orders and statuses.
- **Email preferences** — Manage communication opt-in/out.
- **Wishlist** — Save products for later.
- **Unsubscribe** — One-click email unsubscribe.

---

## 15. Advanced ERP Mode

A toggleable sidebar section that unlocks full ERP capabilities. Accessed via the "Advanced (ERP)" button in the sidebar.

### Modules

| Module | Description |
|--------|-------------|
| Items | Product master data management |
| Warehouses | Warehouse configuration and management |
| UOM | Units of Measure definitions |
| Locations | Warehouse bin/location management |
| Purchase Orders | Create and manage purchase orders |
| Purchase Receipts | Record goods received from suppliers |
| Sales Orders | Formal sales order management |
| Invoices | Invoice generation and tracking |
| Delivery Notes | Shipping documentation |
| Stock Transfer | Move stock between warehouses |
| Studio Builder | Visual theme and UI builder |
| Users | User account management |
| Setup | DocType and system configuration |

### ERP Reports

All financial and inventory reports listed in [Reports & Analytics](#11-reports--analytics) are also accessible from this mode via dedicated sidebar links.
