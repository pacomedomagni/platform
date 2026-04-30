# eBay Integration — Tenant Guide

How the eBay integration works, end to end, and the decisions you need to make
when configuring it.

This guide is for tenants (store owners / operators). For the developer-facing
architecture, see
[apps/api/src/app/marketplace-integrations/ebay/README.md](../apps/api/src/app/marketplace-integrations/ebay/README.md).
For the API/feature catalog used during the design phase, see
[research/ebay-integration.md](research/ebay-integration.md).

---

## Table of contents

1. [What this integration does (and doesn't do)](#1-what-this-integration-does-and-doesnt-do)
2. [The two channels: eBay and your storefront](#2-the-two-channels-ebay-and-your-storefront)
3. [Connecting your eBay store](#3-connecting-your-ebay-store)
4. [Inventory: the shared-warehouse decision](#4-inventory-the-shared-warehouse-decision)
5. [Publishing a listing](#5-publishing-a-listing)
6. [Orders and fulfillment](#6-orders-and-fulfillment)
7. [Sync schedule reference](#7-sync-schedule-reference)
8. [Disconnecting and account deletion](#8-disconnecting-and-account-deletion)
9. [Roles and permissions](#9-roles-and-permissions)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. What this integration does (and doesn't do)

**Does:**

- Lets you publish products from your platform catalog to eBay as listings.
- Pulls eBay orders into the platform so you can fulfill them with your normal
  pick/pack/ship flow.
- Pushes tracking numbers back to eBay when you ship.
- Keeps eBay's view of stock in sync with the warehouse you point each listing
  at.
- Handles returns, refunds, buyer messages, promotions, and store categories
  via eBay's seller APIs.

**Doesn't:**

- Show eBay listings on your storefront. Your storefront is a separate sales
  channel, not a window into eBay.
- Automatically create eBay listings when you add a product. Publishing is
  always an explicit per-product action.
- Make decisions about which warehouse stock comes from. You configure that
  per listing.

---

## 2. The two channels: eBay and your storefront

The platform supports two independent ways for customers to buy from you:

| Channel | Buyer goes to | Stock comes from | Order shows up in |
|---|---|---|---|
| **Storefront** | `your-store.example.com` | Warehouse you pick at checkout | Orders page |
| **eBay** | `ebay.com/.../your-listing` | Warehouse you picked when you created the eBay listing | Marketplace → Orders, then mirrored into the unified Orders page |

These are deliberately separate. Storefront customers never see eBay branding,
prices, or inventory directly — they only see your catalog. eBay buyers never
see your storefront.

**Where the channels meet** is inventory. If both channels draw from the same
warehouse, a sale on either side reduces the same pool of stock. See
[§4](#4-inventory-the-shared-warehouse-decision).

---

## 3. Connecting your eBay store

> **Who can do this:** Admin, System Manager.

1. Go to **Marketplace → Connections**.
2. Click **Add eBay Store**.
3. Pick a name (e.g. "Main Store" or "Clearance Outlet"), the eBay marketplace
   region (US, UK, DE, …), and whether this should be the default store for new
   listings.
4. Click **Connect with eBay**. You'll be redirected to eBay to log in and
   approve the requested permissions.
5. eBay redirects you back. The connection is now ready.

You can connect more than one eBay account — agencies managing several sellers,
or a single seller with separate "Main" and "Clearance" stores, both work.

**During the redirect** the platform also fetches your eBay business policies
(payment, shipping, return) and the first inventory location on your eBay
account. These are saved on the connection and reused as defaults when you
publish listings. You can change them per listing later.

**If you decline a permission** on eBay's consent screen, the connection will
fail with a clear "missing scopes" message. Re-run the connect flow and accept
all requested permissions — the integration uses every one of them.

---

## 4. Inventory: the shared-warehouse decision

This is the most important configuration decision and it's worth understanding
before you publish your first listing.

### How inventory sync works

When you create an eBay listing, you pick a **warehouse** for it. From that
point on:

- eBay's view of "available quantity" for that listing is whatever the
  platform reports for that warehouse, minus reservations.
- Every 30 minutes, a background job recomputes available quantity for each
  published listing and pushes the latest number to eBay.
- A storefront sale reserves stock immediately in the same warehouse table eBay
  reads from.

That last point is the key one: **if your eBay listing and your storefront draw
from the same warehouse, they share a single stock pool.**

### The two strategies

You have two reasonable choices:

#### A. Shared warehouse (one stock pool, multi-channel)

Pick the same warehouse for storefront fulfillment and the eBay listing.

- ✅ One source of truth. You don't manage stock in two places.
- ✅ Stock counts stay roughly accurate across both channels.
- ⚠️ There's a sync window. If a storefront customer buys the last unit at
  12:01, eBay still shows that unit as available until the next sync (up to
  30 minutes later). An eBay buyer in that window can purchase a unit you no
  longer have, and you'll need to cancel — which counts against your eBay
  seller metrics.
- **Best for:** plenty of stock, slow-moving SKUs, or tenants comfortable with
  the occasional cancellation.

#### B. Dedicated eBay warehouse (separate stock pool)

Create a warehouse specifically for eBay (Operations → Warehouses), allocate
units to it, and point your eBay listings at it.

- ✅ No cross-channel overselling. Storefront and eBay are physically isolated.
- ✅ You can run different pricing/promotions per channel without leakage.
- ⚠️ You manage two stock pools. Allocation between them is a manual operations
  task.
- **Best for:** thin stock, fast-moving SKUs, or tenants who want zero
  cancellations.

### What if you pick "Default warehouse" (no specific warehouse)?

The listing sells against your default warehouse — same trade-offs as
**Shared warehouse** above. The sync window applies.

### Auto-sync toggles

On the connection record there are two settings: `autoSyncOrders` and
`autoSyncInventory`. Both are **on by default**.

- `autoSyncOrders` off → eBay orders won't pull into the platform automatically;
  you'd have to trigger a sync manually from **Marketplace → Orders → Sync**.
- `autoSyncInventory` off → stock changes won't push to eBay automatically;
  you'd have to publish quantity updates by hand.

For most tenants, leave both on. They are exposed via the API today
(`PATCH /api/v1/marketplace/connections/:id`) but the UI surface is in
progress — until then, contact support if you need them changed.

---

## 5. Publishing a listing

> **Who can do this:** Admin, System Manager, Inventory Manager (with the
> `marketplace.listings.publish` permission).

1. **Marketplace → Listings → New Listing.**
2. Pick the eBay store, the platform product, and the warehouse the listing
   should sell against (see [§4](#4-inventory-the-shared-warehouse-decision)).
3. Fill in title, description, photos (up to 24 — extras are ignored),
   condition, category, item specifics.
4. Optional: switch the format to Auction or enable Best Offer.
5. Save as **Draft**. If your tenant requires two-person approval for
   listings, an Admin or System Manager then **Approves** it.
6. Click **Publish**. The platform:
   - Uploads images to eBay's CDN.
   - Creates an eBay inventory item with your SKU.
   - Creates an offer with your price, policies, and category.
   - Publishes the offer. eBay returns a listing URL.
   - Saves all of that on the local record so you can find the live listing.

**If publish fails partway through** — say, eBay rejects your category — the
platform rolls back the inventory item and offer it created on eBay's side, so
you don't end up with orphaned half-listings. The local record is marked
**Error** with the eBay error message; fix the issue and republish.

### Editing a published listing

Price, quantity, and description on a live listing can be edited from the
listing detail page. eBay caps revisions at 250 per listing per day; once you
hit that cap you'll see a clear error and need to wait until the next day.

Category, format (auction vs fixed price), and most other fields can't be
changed on a live listing — eBay's API doesn't allow it. End the listing and
republish if you need to change those.

### Ending a listing

Click **End** on a published listing to withdraw the offer from eBay. The
listing record stays in your platform with status **Ended**.

---

## 6. Orders and fulfillment

### Orders flowing in

Every 15 minutes, the platform pulls new and modified eBay orders into the
**Marketplace → Orders** page. eBay also notifies us by webhook when orders
are created or updated, so the typical delay is seconds, not minutes — the
15-minute pull is a safety net.

When an eBay order is **paid**, the platform automatically creates a unified
**Order** for it. That order shows up in the regular Orders page alongside
storefront orders, with an `MKT-…` order number prefix and a note identifying
the eBay store and external order ID.

### Fulfilling

Use the same pick / pack / ship workflow you use for storefront orders. When
you mark the order shipped and enter a tracking number, the platform pushes
the tracking to eBay automatically — the buyer sees the same tracking in their
eBay account.

### Refunds and returns

- **Refund** from the order detail page. The platform calls eBay's refund API
  and updates the order's payment status.
- **Returns** initiated by the buyer on eBay flow into **Marketplace →
  Returns**. You approve, decline, or issue refunds from there.

### Buyer messages

Buyer-seller messages on eBay flow into **Marketplace → Messages**. Replies
sent from the platform post back to eBay's messaging system.

---

## 7. Sync schedule reference

| Flow | Direction | Trigger | Frequency |
|---|---|---|---|
| OAuth state cleanup | n/a | Cron | Every 10 min |
| Order sync (pull) | eBay → platform | Cron + webhook | Every 15 min, plus real-time webhooks |
| Inventory sync (push) | Platform → eBay | Cron | Every 30 min |
| Token refresh | Platform → eBay | On demand | When access token has < 60 s left |
| Webhook signature key cache | n/a | TTL | 1 hour |

All scheduled jobs run with Redis-backed distributed locks, so multiple app
instances don't double-process. If you scale horizontally, sync still runs
exactly once per tick across the cluster.

---

## 8. Disconnecting and account deletion

### Tenant-initiated disconnect

**Marketplace → Connections → Disconnect**:

1. The platform calls eBay's OAuth revoke endpoint with your refresh token, so
   eBay invalidates it on their side immediately.
2. Local copies of the access and refresh tokens are wiped from the database.
3. The connection stays in your account but in a disconnected state, with all
   its listing/order history intact. You can reconnect at any time.

If eBay rejects the revoke call (network blip, already-revoked token, etc.) the
local credentials are still cleared — disconnection always succeeds from your
perspective.

### Account deletion

**Delete** removes the connection record entirely. It's blocked if there are
any associated listings or orders (deactivate or disconnect instead).

### eBay-initiated account deletion

When an eBay seller deletes their account, eBay notifies all OAuth-connected
applications. The platform receives the notification, verifies eBay's
signature, and anonymizes any matching connection — clearing tokens and
disconnecting the integration. This is part of eBay's required compliance
program.

---

## 9. Roles and permissions

Default role mapping:

| Action | Admin | System Manager | Inventory Manager | Customer Service |
|---|---|---|---|---|
| Connect / disconnect store | ✅ | ✅ | — | — |
| Create / edit / delete listings | ✅ | ✅ | ✅ | — |
| Approve listings (two-person workflow) | ✅ | ✅ | — | — |
| Publish listings | ✅ | ✅ | ✅ (approved only) | — |
| Sync orders manually | ✅ | ✅ | ✅ | — |
| View orders | ✅ | ✅ | ✅ | ✅ |
| Mark orders shipped | ✅ | ✅ | ✅ | — |
| Issue refunds | ✅ | ✅ | — | ✅ |
| Manage store categories / inventory locations | ✅ | ✅ | — | — |
| Manage marketplace permissions | ✅ | ✅ | — | — |

Per-permission overrides are managed under **Marketplace → Settings →
Permissions** (Admin / System Manager only).

---

## 10. Troubleshooting

### "Connection is not fully configured" when publishing

The connection completed OAuth but is missing one of: fulfillment policy,
payment policy, return policy, or inventory location. Re-fetch business
policies from the connection settings, or set them on eBay first and reconnect.

### Listing is stuck in "PUBLISHING" status

Either the publish call is still in flight (give it a minute) or it crashed
before it could update the status. Check the listing's `errorMessage` field.
If empty, contact support — the platform's optimistic-lock mechanism may have
left the row in a transient state that needs manual recovery.

### eBay shows different stock than my warehouse

This is almost always the 30-minute inventory sync window. Wait for the next
sync, or trigger one manually from the listing detail page. If the discrepancy
persists past two sync cycles, the listing's `syncStatus` will show **Error**
with the reason.

### Buyer says they can't see my listing

Check the listing detail page in the platform: status should be **Published**
and the eBay listing URL should be live. If the URL 404s on eBay, the listing
was ended or removed on eBay's side (policy violation, expired, etc.) — the
platform will pick this up on the next sync and mark the listing accordingly.

### "eBay did not grant required scopes" error during connect

You de-selected one of the requested permissions on eBay's consent screen.
Re-run the connect flow and accept all requested permissions.

### Token revoked / "please reconnect"

Refresh tokens last 18 months. If yours was revoked early (eBay support
action, password change, or the connection was disconnected from a different
device), the next API call will surface as a re-connect prompt. Click
**Reconnect** on the connection card and re-do OAuth.

### Daily limits

eBay caps live-listing revisions at 250 per listing per day, and OAuth refresh
calls at 50,000 per day per app. The platform tracks both and will surface a
clear "limit reached" error rather than failing opaquely.

---

## See also

- [research/ebay-integration.md](research/ebay-integration.md) — full eBay API
  surface area and the design decisions behind which features the platform
  exposes.
- [apps/api/src/app/marketplace-integrations/ebay/README.md](../apps/api/src/app/marketplace-integrations/ebay/README.md) —
  developer-facing architecture (services, sync internals, RLS posture).
