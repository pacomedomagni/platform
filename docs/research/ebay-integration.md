# eBay Market Integration — Deep Research Document

> **Goal**: Enable noslag tenants to manage their entire eBay store without employees needing direct access to the owner's eBay account. Full feature matching with proper RBAC.

---

## Table of Contents

1. [Authentication & Access Control Architecture](#1-authentication--access-control-architecture)
2. [API Catalog & Endpoint Map](#2-api-catalog--endpoint-map)
3. [Listing Management](#3-listing-management)
4. [Inventory Management](#4-inventory-management)
5. [Order Management & Fulfillment](#5-order-management--fulfillment)
6. [Shipping & Logistics](#6-shipping--logistics)
7. [Returns, Cases & Disputes](#7-returns-cases--disputes)
8. [Messaging & Communication](#8-messaging--communication)
9. [Marketing & Promotions](#9-marketing--promotions)
10. [Store Management](#10-store-management)
11. [Analytics & Reporting](#11-analytics--reporting)
12. [Financial Management](#12-financial-management)
13. [Notifications & Webhooks](#13-notifications--webhooks)
14. [Bulk Operations](#14-bulk-operations)
15. [Compliance & Feedback](#15-compliance--feedback)
16. [Noslag RBAC Design](#16-noslag-rbac-design)
17. [Feature Matching Matrix](#17-feature-matching-matrix)
18. [Implementation Phases](#18-implementation-phases)

---

## 1. Authentication & Access Control Architecture

### 1.1 OAuth 2.0 Flows

eBay uses OAuth 2.0 exclusively. Two grant types:

#### Authorization Code Grant (User Tokens) — PRIMARY FOR NOSLAG

```
Tenant Owner → eBay Consent Screen → Authorization Code → Exchange for Tokens
```

| Step | Detail |
|------|--------|
| Consent URL | `https://auth.ebay.com/oauth2/authorize?client_id=<APP_ID>&redirect_uri=<RuName>&response_type=code&scope=<scopes>&state=<csrf>` |
| Token Exchange | `POST https://api.ebay.com/identity/v1/oauth2/token` with `grant_type=authorization_code` |
| Access Token TTL | **2 hours** (7,200 seconds) |
| Refresh Token TTL | **18 months** (47,304,000 seconds) |
| Auth Header | `Basic Base64(client_id:client_secret)` |

#### Client Credentials Grant (Application Tokens) — PUBLIC DATA ONLY

```
POST https://api.ebay.com/identity/v1/oauth2/token
grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope
```

Used for: Browse API search, Taxonomy, Catalog, public metadata.

### 1.2 Token Minting Rate Limits

| Grant Type | Daily Limit |
|------------|------------|
| `client_credentials` | 1,000/day |
| `authorization_code` | 10,000/day |
| `refresh_token` | 50,000/day |

### 1.3 Complete OAuth Scopes

#### Sell Scopes (User Tokens)

| Scope | Description | Used For |
|-------|-------------|----------|
| `sell.account` | Manage account settings | Policies, programs, KYC |
| `sell.account.readonly` | View account settings | Read-only policy access |
| `sell.inventory` | Manage inventory & offers | Listings, inventory, publishing |
| `sell.inventory.readonly` | View inventory & offers | Read-only inventory |
| `sell.fulfillment` | Manage order fulfillment | Orders, shipping, refunds, disputes |
| `sell.fulfillment.readonly` | View order fulfillment | Read-only order access |
| `sell.marketing` | Manage marketing activities | Campaigns, promotions, email |
| `sell.marketing.readonly` | View marketing activities | Read-only marketing |
| `sell.analytics.readonly` | View selling analytics | Traffic, performance, metrics |
| `sell.finances` | Manage financial data | Payouts, transactions, refunds |
| `sell.item_draft` | Manage item drafts | Draft creation |
| `sell.logistics` | Manage shipping logistics | Labels, quotes |
| `sell.stores` | Manage store | Store categories |
| `sell.marketplace.insights.readonly` | View product selling data | Pricing insights |

#### Commerce Scopes (User Tokens)

| Scope | Description |
|-------|-------------|
| `commerce.identity.readonly` | Basic user info |
| `commerce.identity.name.readonly` | First/last name |
| `commerce.identity.email.readonly` | Email |
| `commerce.identity.phone.readonly` | Phone |
| `commerce.identity.address.readonly` | Address |
| `commerce.notification.subscription` | Webhook subscriptions |

#### Application Scopes (Client Credentials)

| Scope | Description |
|-------|-------------|
| `api_scope` | Public eBay data |
| `buy.item.feed` | Item feeds |
| `buy.marketing` | Marketing data |
| `buy.marketplace.insights` | Historical sales |
| `commerce.catalog.readonly` | Product catalog |

### 1.4 Token Revocation Triggers

Refresh tokens are revoked when:
- User changes eBay **username**
- User changes eBay **password**
- User explicitly **revokes** app access
- eBay detects **security compromise**
- Token naturally expires after ~18 months

**Critical**: Noslag must implement graceful re-authorization flows.

### 1.5 RuName (Redirect URL Name)

eBay does NOT use standard redirect URIs. Each app gets:
- **Sandbox RuName** — for testing
- **Production RuName** — for live
- Configuration requires: Display Title, Privacy Policy URL, Auth Accepted URL, Auth Declined URL

### 1.6 Noslag Multi-Tenant Access Pattern

```
Employee A ─┐
Employee B ─┤──► Noslag RBAC Layer ──► Stored eBay Token ──► eBay API
Employee C ─┘    (permissions,          (per tenant's
Manager    ─┘     audit logging)         eBay account)
```

**Key principles**:
- ONE OAuth connection per eBay seller account
- Noslag stores the token pair (access + refresh) per connected account
- Noslag enforces its own RBAC — employees never see eBay tokens
- All API calls go through Noslag's server
- Full audit trail: which employee did what, when

This is the **Solutions Provider Model** — standard for platforms like ChannelAdvisor, Sellbrite, Linnworks.

### 1.7 Token Storage Requirements

- Access tokens: in-memory cache, reuse until expiry
- Refresh tokens: encrypted at rest (AES-256), server-side only
- Never in version control, client-side storage, or logs
- Proactive refresh before 2-hour expiry window

---

## 2. API Catalog & Endpoint Map

### 2.1 Complete API Summary

eBay provides **28 REST APIs** with **~350+ endpoints**.

| API Family | API | Base Path | Endpoints | Daily Limit |
|------------|-----|-----------|-----------|-------------|
| **Sell** | Inventory | `/sell/inventory/v1` | ~46 | 2,000,000 |
| | Fulfillment | `/sell/fulfillment/v1` | 15 | 100,000 (orders) / 250,000 (disputes) |
| | Marketing | `/sell/marketing/v1` | 97 | 100,000 (promos) / 10,000 (ads) |
| | Account | `/sell/account/v1` | ~37 | 25,000 |
| | Analytics | `/sell/analytics/v1` | 4 | 100-400 |
| | Finances | `/sell/finances/v1` | 8 | 15,000 |
| | Feed | `/sell/feed/v1` | 23 | 100,000 |
| | Metadata | `/sell/metadata/v1` | 28 | 5,000 |
| | Negotiation | `/sell/negotiation/v1` | 2 | 1,000,000 |
| | Recommendation | `/sell/recommendation/v1` | 1 | 5,000 |
| | Logistics | `/sell/logistics/v1_beta` | 6 | 2,500,000 |
| | Compliance | `/sell/compliance/v1` | 2 | 5,000 |
| | Listing | `/sell/listing/v1_beta` | 1 | — |
| | Stores | `/sell/stores/v1` | 8 | — |
| **Buy** | Browse | `/buy/browse/v1` | 7 | 5,000 |
| | Deal | `/buy/deal/v1` | 4 | 5,000 |
| | Feed | `/buy/feed/v1` | 5-7 | 10,000-75,000 |
| | Marketing | `/buy/marketing/v1_beta` | 3 | 5,000 |
| | Marketplace Insights | `/buy/marketplace_insights/v1_beta` | 1 | 5,000 |
| | Offer | `/buy/offer/v1_beta` | 2 | 5,000 |
| | Order | `/buy/order/v1_beta` | 7+ | 5,000 |
| **Commerce** | Catalog | `/commerce/catalog/v1_beta` | 2 | 10,000 |
| | Charity | `/commerce/charity/v1` | 2 | — |
| | Identity | `/commerce/identity/v1` | 1 | — |
| | Media | `/commerce/media/v1_beta` | 10 | 1,000,000 |
| | Notification | `/commerce/notification/v1` | 20 | 10,000 |
| | Taxonomy | `/commerce/taxonomy/v1` | 9 | 5,000 |
| | Translation | `/commerce/translation/v1_beta` | 1 | — |
| **Developer** | Analytics | `/developer/analytics/v1_beta` | 2 | — |

### 2.2 Legacy APIs Still Required

Some features are only available via the **Trading API** (SOAP/XML):

| Feature | Trading API Call |
|---------|-----------------|
| Buyer-Seller Messaging | `GetMyMessages`, `AddMemberMessageAAQToPartner`, `AddMemberMessageRTQ` |
| Feedback Management | `LeaveFeedback`, `GetFeedback`, `RespondToFeedback`, `GetBestOffers` |
| Best Offer Management | `GetBestOffers`, `RespondToBestOffer` |
| Store Customization | `SetStore`, `GetStore`, `SetStoreCustomPage` |
| Store Vacation Mode | `SetStore` (StoreVacationPreferences) |
| User Preferences | `SetUserPreferences`, `GetUserPreferences` |
| Category Features | `GetCategoryFeatures` |
| Image Upload | `UploadSiteHostedPictures` |

> **Note (Q4 2025)**: New REST **Feedback API** and **Message API** are being released to replace these Trading API calls.

### 2.3 Post-Order API (REST but separate)

Base URL: `https://api.ebay.com/post-order/v2`

Used for: Cancellations, Returns, Inquiries (INR), Case Management.

---

## 3. Listing Management

### 3.1 Listing Types

| Type | API | Duration | Multi-Variation | Best Offer |
|------|-----|----------|-----------------|------------|
| **Fixed Price** | Inventory API / Trading API | GTC only | Yes (up to 250 variations) | Yes (single items only) |
| **Auction** | Inventory API / Trading API | 1, 3, 5, 7, 10 days | No | No |
| **Classified Ad** | Trading API only | 30 days | No | No |

### 3.2 Listing Creation Workflow (Inventory API — Recommended)

```
1. createOrReplaceInventoryItem(sku)     → Inventory item (product data)
2. createOffer(sku, marketplace, policies) → Offer (listing config)
3. publishOffer(offerId)                   → Live eBay listing
```

For multi-variation:
```
1. createOrReplaceInventoryItem(sku1)  → Variation 1
2. createOrReplaceInventoryItem(sku2)  → Variation 2
3. createOrReplaceInventoryItemGroup(groupKey, [sku1, sku2])
4. createOffer(sku1), createOffer(sku2)
5. publishOfferByInventoryItemGroup(groupKey)
```

### 3.3 Item Specifics / Aspects

Retrieved via **Taxonomy API**: `getItemAspectsForCategory`

| Constraint | Meaning |
|------------|---------|
| `aspectRequired: true` | Listing fails without this |
| `aspectUsage: RECOMMENDED` | Strongly encouraged, may become required |
| `aspectUsage: OPTIONAL` | Nice to have |
| `aspectMode: FREE_TEXT` | Seller enters any value |
| `aspectMode: SELECTION_ONLY` | Must pick from predefined list |
| `itemToAspectCardinality: MULTI` | Multiple values allowed |

### 3.4 Item Conditions

| Condition ID | Enum | Name |
|-------------|------|------|
| 1000 | `NEW` | New |
| 1500 | `NEW_OTHER` | New Other / Open Box |
| 1750 | `NEW_WITH_DEFECTS` | New with Defects |
| 2000 | `CERTIFIED_REFURBISHED` | Certified Refurbished |
| 2010 | `EXCELLENT_REFURBISHED` | Excellent - Refurbished |
| 2020 | `VERY_GOOD_REFURBISHED` | Very Good - Refurbished |
| 2030 | `GOOD_REFURBISHED` | Good - Refurbished |
| 2500 | `SELLER_REFURBISHED` | Seller Refurbished |
| 3000 | `USED_EXCELLENT` | Used / Pre-owned |
| 4000 | `USED_VERY_GOOD` | Very Good |
| 5000 | `USED_GOOD` | Good |
| 6000 | `USED_ACCEPTABLE` | Acceptable |
| 7000 | `FOR_PARTS_OR_NOT_WORKING` | For Parts |

Valid conditions per category: **Metadata API** `getItemConditionPolicies`

### 3.5 Multi-Variation Listings

| Limit | Value |
|-------|-------|
| Max variations | 250 |
| Max variation specs | 5 (e.g., Color, Size, Material, Pattern, Style) |
| Max values per spec | 30 |
| Max images per variation | 12 |

### 3.6 Product Catalog Matching

```
Catalog API: search(GTIN/keywords) → ePID
Inventory API: product.epid = <ePID> → Auto-fills item specifics
```

Product identifiers: **ePID**, **UPC**, **EAN**, **ISBN**, **MPN**

### 3.7 Images / Photos

| Requirement | Value |
|-------------|-------|
| Max per listing | 24 |
| Max per variation | 12 |
| Max file size | 12 MB |
| Max dimensions | Height + Width ≤ 15,000px |
| Min for zoom | 500px longest side |
| Formats | JPG, PNG, GIF, BMP, TIFF, AVIF, HEIC, WEBP |
| Protocol | HTTPS only |

Upload via **Media API**: `createImageFromFile` (multipart) or `createImageFromUrl` (URL-based)

### 3.8 Listing Description

- Max 500,000 characters
- HTML allowed: structural tags, text formatting, images, lists
- **Banned**: JavaScript, `<script>`, `<form>`, Flash, event handlers, external CSS/JS
- External `<a href>` links only to eBay pages (limited exceptions)

### 3.9 Listing Upgrades

| Upgrade | API Field | Fee |
|---------|-----------|-----|
| Bold Title | `ListingEnhancement = Bold` | Paid |
| Subtitle | `SubTitle` | Paid |
| Gallery Plus | `GalleryType = Plus` | Paid |
| Store Categories | `StoreCategoryID`, `StoreCategory2ID` | Free |
| Secondary Category | `SecondaryCategory` | Paid |
| Charity Donation | `Charity` | Free |

### 3.10 Best Offer

- Enable: `bestOffer.bestOfferEnabled = true` in offer
- Auto-accept threshold: `BestOfferAutoAcceptPrice`
- Auto-decline threshold: `MinimumBestOfferPrice`
- Offers expire after 48 hours
- NOT available for multi-variation listings
- Manage via Trading API: `GetBestOffers`, `RespondToBestOffer`

### 3.11 Scheduled Listings

- `Item.ScheduleTime` — up to 3 weeks in advance
- Fee: $0.10 per scheduled listing

### 3.12 Out-of-Stock Control

- Enable via `SetUserPreferences`: `OutOfStockControlPreference = true`
- GTC listings stay alive at 0 quantity but hidden from search
- Auto-ended after 3 consecutive billing months at 0
- Preserves sales history and SEO ranking

### 3.13 Pricing

| Type | Details |
|------|---------|
| Fixed Price | `pricingSummary.price` in offer |
| Auction Start | `Item.StartPrice` |
| Reserve Price | `Item.ReservePrice` (fee: $5 or 7.5%) |
| Buy It Now | `Item.BuyItNowPrice` |
| Strikethrough | `originalRetailPrice` (restricted to existing sellers) |
| Volume Pricing | Marketing API `VOLUME_DISCOUNT` promotion |

---

## 4. Inventory Management

### 4.1 Inventory API Model

```
InventoryItem (SKU-based)
    ├── product (title, description, aspects, images, epid)
    ├── condition / conditionDescription
    ├── availability (quantity, fulfillment time)
    └── packageWeightAndSize

Offer (per marketplace)
    ├── sku → InventoryItem
    ├── marketplaceId
    ├── format (FIXED_PRICE / AUCTION)
    ├── pricingSummary
    ├── listingPolicies (payment, fulfillment, return policy IDs)
    └── storeCategoryNames

InventoryItemGroup (multi-variation)
    ├── variantSKUs[]
    ├── commonAspects
    └── variantAspects
```

### 4.2 Key Inventory Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `createOrReplaceInventoryItem` | `PUT /inventory_item/{sku}` | Create/update item |
| `getInventoryItem` | `GET /inventory_item/{sku}` | Get item |
| `getInventoryItems` | `GET /inventory_item` | List all items |
| `deleteInventoryItem` | `DELETE /inventory_item/{sku}` | Delete item |
| `bulkCreateOrReplaceInventoryItem` | `POST /bulk_create_or_replace_inventory_item` | Bulk create (25 max) |
| `bulkGetInventoryItem` | `POST /bulk_get_inventory_item` | Bulk get (25 max) |
| `bulkUpdatePriceQuantity` | `POST /bulk_update_price_quantity` | Bulk price/qty (25 max) |
| `createOffer` | `POST /offer` | Create offer |
| `updateOffer` | `PUT /offer/{offerId}` | Update offer |
| `publishOffer` | `POST /offer/{offerId}/publish` | Publish listing |
| `withdrawOffer` | `POST /offer/{offerId}/withdraw` | End listing |
| `getListingFees` | `POST /offer/get_listing_fees` | Estimate fees |
| `bulkCreateOffer` | `POST /bulk_create_offer` | Bulk create (25 max) |
| `bulkPublishOffer` | `POST /bulk_publish_offer` | Bulk publish (25 max) |

### 4.3 Inventory Locations

```
createInventoryLocation(merchantLocationKey, address, type)
  type: WAREHOUSE | STORE
  Required before publishing offers
```

### 4.4 Inventory Constraints

- Max 250 listing revisions per calendar day (Inventory API)
- SKU must be unique across entire seller inventory
- Items created via Inventory API CANNOT be edited via Trading API or Seller Hub

---

## 5. Order Management & Fulfillment

### 5.1 Fulfillment API — Order Retrieval

| Method | Endpoint | Details |
|--------|----------|---------|
| `getOrders` | `GET /order` | Up to 200 per page, 90-day default window |
| `getOrder` | `GET /order/{orderId}` | Full order with nested data |

**Filters**: `creationdate`, `lastmodifieddate`, `orderfulfillmentstatus` (NOT_STARTED / IN_PROGRESS / FULFILLED)

### 5.2 Order Data Model

```
Order
├── orderId
├── buyer (username, tax info)
├── buyerCheckoutNotes
├── creationDate / lastModifiedDate
├── orderFulfillmentStatus: NOT_STARTED | IN_PROGRESS | FULFILLED
├── orderPaymentStatus: PENDING | PAID | PARTIALLY_REFUNDED | FULLY_REFUNDED | FAILED
├── lineItems[]
│   ├── lineItemId, title, sku, quantity
│   ├── lineItemCost, discountedLineItemCost, total
│   ├── taxes[], appliedPromotions[]
│   ├── deliveryCost
│   ├── variationAspects[]
│   ├── lineItemFulfillmentStatus
│   └── refunds[]
├── fulfillmentStartInstructions[] (ship-to address, delivery window)
├── pricingSummary
├── paymentSummary (payments, refunds)
├── cancelStatus
└── totalMarketplaceFee
```

### 5.3 Shipping Fulfillment

```
POST /order/{orderId}/shipping_fulfillment
{
  "lineItems": [{ "lineItemId": "...", "quantity": 1 }],
  "shippedDate": "2026-01-15T10:00:00.000Z",
  "shippingCarrierCode": "USPS",
  "trackingNumber": "9400111899223..."
}
```

- Multiple fulfillments per order (split shipments)
- `trackingNumber` and `shippingCarrierCode` are mutually dependent
- Only alphanumeric characters in tracking numbers

### 5.4 Refunds

```
POST /order/{orderId}/issue_refund
```

- Order-level or line-item-level
- Full or partial amounts
- Processed asynchronously (initial status: PENDING)

### 5.5 Order Cancellation (Post-Order API)

| Scenario | Endpoint | Defect? |
|----------|----------|---------|
| Buyer cancels (within 1 hour) | `POST /cancellation` | No |
| Seller cancels (buyer asked) | `POST /cancellation` + reason=BUYER_ASKED_CANCEL | No |
| Seller cancels (out of stock) | `POST /cancellation` + reason=OUT_OF_STOCK | **Yes** |

Seller approves/rejects: `POST /cancellation/{cancelId}/approve` or `/reject`

---

## 6. Shipping & Logistics

### 6.1 Fulfillment Policies (Account API)

```
POST /sell/account/v1/fulfillment_policy
{
  "name": "Standard Domestic",
  "marketplaceId": "EBAY_US",
  "handlingTime": { "value": 1, "unit": "DAY" },
  "shippingOptions": [{
    "optionType": "DOMESTIC",
    "costType": "FLAT_RATE",
    "shippingServices": [{
      "shippingCarrierCode": "USPS",
      "shippingServiceCode": "USPSPriority",
      "shippingCost": { "value": "5.99", "currency": "USD" },
      "freeShipping": false
    }]
  }]
}
```

### 6.2 Shipping Types

| Type | API Field | Details |
|------|-----------|---------|
| Flat Rate | `costType: FLAT_RATE` | Fixed cost per item |
| Calculated | `costType: CALCULATED` | Based on weight/dims/ZIP |
| Free Shipping | `freeShipping: true` | First domestic service only |
| Freight | `freightShipping: true` | Items > 150 lbs |

### 6.3 International Shipping

| Program | Details |
|---------|---------|
| **Direct** | Seller handles customs/shipping |
| **Global Shipping Program (GSP)** | Seller ships to eBay hub, eBay handles international leg |
| **eBay International Shipping (eIS)** | Newer program, US sellers only, requires Above Standard |

### 6.4 Logistics API (Shipping Labels)

**Limited Release** — USPS only, requires whitelisting.

```
1. POST /shipping_quote          → Get live USPS rates
2. POST /shipment/create_from_shipping_quote → Purchase label
3. GET  /shipment/{id}/download_label_file   → Download PDF
4. POST /shipment/{id}/cancel                → Cancel/refund
```

### 6.5 Package Details

- Weight: major (lbs/kg) + minor (oz/grams)
- Dimensions: length, width, depth
- Measurement units: English (lbs/in) or Metric (kg/cm)

### 6.6 Handling Time

- Set in fulfillment policy
- Top Rated sellers: 0-1 business days required
- Excludes weekends/holidays

---

## 7. Returns, Cases & Disputes

### 7.1 Return Policies (Account API)

```
POST /sell/account/v1/return_policy
{
  "name": "30-Day Returns",
  "marketplaceId": "EBAY_US",
  "returnsAccepted": true,
  "returnPeriod": { "value": 30, "unit": "DAY" },
  "returnShippingCostPayer": "BUYER",
  "refundMethod": "MONEY_BACK"
}
```

Restocking fees are **deprecated** — no longer allowed.

### 7.2 Return Management (Post-Order API)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/return/{returnId}` | GET | Get return details |
| `/return/{returnId}/decide` | POST | Approve/decline/counter |
| `/return/{returnId}/issue_refund` | POST | Issue refund |
| `/return/{returnId}/mark_as_received` | POST | Mark item received |
| `/return/{returnId}/add_shipping_label` | POST | Add return label |
| `/return/{returnId}/send_message` | POST | Message about return |
| `/return/{returnId}/escalate` | POST | Escalate to eBay case |
| `/return/search` | GET | Search returns |
| `/return/preference` | GET/POST | Get/set return preferences |

**Decide options**: Approve with refund, approve without item return, offer partial refund, provide RMA, decline, offer replacement.

### 7.3 Inquiries — Item Not Received (INR)

| Endpoint | Purpose |
|----------|---------|
| `POST /inquiry` | Create INR inquiry |
| `GET /inquiry/{id}` | Get details |
| `POST /inquiry/{id}/escalate` | Escalate to case |
| `POST /inquiry/{id}/issue_refund` | Issue refund |
| `POST /inquiry/{id}/provide_shipment_info` | Provide tracking |
| `POST /inquiry/{id}/send_message` | Send message |
| `GET /inquiry/search` | Search (filter: `inquiry_status=WAITING_SELLER_RESPONSE`) |

### 7.4 Case Management

| Endpoint | Purpose |
|----------|---------|
| `GET /casemanagement/{caseId}` | Get case details |
| `POST /casemanagement/{caseId}/appeal` | Appeal decision |
| `GET /casemanagement/search` | Search cases |

### 7.5 Payment Disputes (Fulfillment API)

Chargebacks from buyer's payment provider.

| Method | Endpoint |
|--------|----------|
| `getPaymentDispute` | `GET /payment_dispute/{id}` |
| `getPaymentDisputeSummaries` | `GET /payment_dispute_summary` |
| `acceptPaymentDispute` | `POST /payment_dispute/{id}/accept` |
| `contestPaymentDispute` | `POST /payment_dispute/{id}/contest` |
| `uploadEvidenceFile` | `POST /payment_dispute/{id}/upload_evidence_file` |
| `addEvidence` | `POST /payment_dispute/{id}/add_evidence` |
| `updateEvidence` | `POST /payment_dispute/{id}/update_evidence` |
| `fetchEvidenceContent` | `GET /payment_dispute/{id}/fetch_evidence_content` |
| `getActivities` | `GET /payment_dispute/{id}/activity` |

**Response deadline**: 5 calendar days. Evidence: JPEG/JPG/PNG, max 1.5 MB.

---

## 8. Messaging & Communication

### 8.1 Trading API Messaging (Current)

| Call | Purpose |
|------|---------|
| `GetMyMessages` | Retrieve inbox messages |
| `GetMemberMessages` | Messages about specific items |
| `AddMemberMessageAAQToPartner` | Message order partner (up to 90 days post-order) |
| `AddMemberMessageRTQ` | Respond to buyer question |
| `AddMemberMessagesAAQToBidder` | Message bidders (up to 10 per call) |
| `ReviseMyMessages` | Mark messages read/flagged |

### 8.2 REST Message API (New — Q4 2025)

Replaces: `GetMyMessages`, `GetMemberMessages`, `AddMemberMessageAAQToPartner`, `AddMemberMessageRTQ`, `AddMemberMessagesAAQToBidder`, `DeleteMyMessages`, `ReviseMyMessages`.

### 8.3 Post-Order Messaging

- `POST /return/{returnId}/send_message` — return-specific messages
- `POST /inquiry/{inquiryId}/send_message` — inquiry-specific messages

---

## 9. Marketing & Promotions

### 9.1 Promoted Listings

#### Standard (Cost-Per-Sale)

- Funding: `COST_PER_SALE` — charged only when buyer clicks AND purchases within 30 days
- Ad rate: 2%-100% of sale price
- Supports: Fixed-price, auction, auction with BIN

#### Advanced (Cost-Per-Click)

- Funding: `COST_PER_CLICK` — charged per click (second-price auction)
- Requires **daily budget** (eBay may spend up to 2x on any given day)
- Targeting: Smart (automatic) or Manual (keyword-based)
- Manual: Up to 500 ad groups/campaign, 1,000 listings/ad group

#### Express

- Flat upfront fee for auction-style listings only

#### Offsite (External Channels)

- `COST_PER_CLICK` on external search (Google)
- Requires daily budget

### 9.2 Campaign Management Endpoints

| Action | Method |
|--------|--------|
| Create | `POST /ad_campaign` |
| Clone | `POST /ad_campaign/{id}/clone` |
| Launch | `POST /ad_campaign/{id}/launch` |
| Pause | `POST /ad_campaign/{id}/pause` |
| Resume | `POST /ad_campaign/{id}/resume` |
| End | `POST /ad_campaign/{id}/end` |
| Delete | `DELETE /ad_campaign/{id}` |
| Update Budget | `POST /ad_campaign/{id}/update_campaign_budget` |
| Update Strategy | `POST /ad_campaign/{id}/update_ad_rate_strategy` |
| Suggest Budget | `GET /ad_campaign/suggest_budget` |
| Suggest Items | `GET /ad_campaign/{id}/suggest_items` |

### 9.3 Ad Reporting

1. `POST /ad_report_task` — schedule report
2. `GET /ad_report_task/{id}` — check status
3. `GET /ad_report/{id}` — download report

**Metrics**: Impressions, Clicks, CTR, CPC, Ad Fees, Sales, Quantity Sold, Conversion Rate, ROAS, ACoS.

### 9.4 Promotions & Discounts

| Type | API | Details |
|------|-----|---------|
| **Markdown Sales** | `POST /item_price_markdown` | Direct price reduction, scheduled |
| **Order Discounts** | `POST /item_promotion` (ORDER_DISCOUNT) | Threshold-based (e.g., "Spend $60, get 20% off") |
| **Volume Pricing** | `POST /item_promotion` (VOLUME_DISCOUNT) | Tiered (2-4 tiers) |
| **Coded Coupons** | `POST /item_promotion` (CODED_COUPON) | Public or private, configurable limits |

Coupon types: `PUBLIC_SINGLE_SELLER_COUPON`, `PRIVATE_SINGLE_SELLER_COUPON`

### 9.5 Keyword Management (Advanced Campaigns)

| Endpoint | Purpose |
|----------|---------|
| `POST /ad_campaign/{id}/keyword` | Create keyword |
| `POST /ad_campaign/{id}/bulk_create_keyword` | Bulk create |
| `POST /ad_campaign/{id}/ad_group/{id}/suggest_keywords` | Get suggestions |
| `POST /ad_campaign/{id}/ad_group/{id}/suggest_bids` | Get bid suggestions |
| `POST /negative_keyword` | Create negative keyword |
| `POST /bulk_create_negative_keyword` | Bulk create negative |

### 9.6 Email Campaigns (Store Newsletter)

Six campaign types: Welcome, New Products, Volume Pricing, Coupon, Sale Event, Order Discount.

Ten audience segments: All Subscribers, New Subscribers, First-time Buyers, Recent Buyers, Followers, etc.

| Method | Purpose |
|--------|---------|
| `POST /email_campaign` | Create |
| `GET /email_campaign` | List all |
| `PUT /email_campaign/{id}` | Update |
| `DELETE /email_campaign/{id}` | Delete |
| `GET /email_campaign/{id}/email_preview` | Preview |
| `GET /email_campaign/audience` | Get audiences |
| `GET /email_campaign/report` | Analytics |

---

## 10. Store Management

### 10.1 Store Tiers

| Tier | Monthly (Annual) | Free Listings | Key Benefits |
|------|-----------------|---------------|--------------|
| Starter | $4.95/mo | 250 | Basic storefront |
| Basic | $21.95/mo | 1,000 | Lower FVF (~12.35%) |
| Premium | — | 10,000 | Enhanced branding, analytics |
| Anchor | $299.95/mo | 25,000+ | Lowest fees, concierge support |
| Enterprise | $2,999.95/mo | Highest | Corporate sellers |

### 10.2 Store Categories (Stores API)

| Method | Endpoint |
|--------|----------|
| `getStore` | `GET /store` |
| `getStoreCategories` | `GET /store/categories` |
| `addStoreCategory` | `POST /store/categories` |
| `deleteStoreCategory` | `DELETE /store/categories/{id}` |
| `renameStoreCategory` | `PUT /store/categories/{id}` |
| `moveStoreCategory` | `POST /store/categories/move_category` |

- Max 300 categories, 3 levels of hierarchy
- Operations are async — use `getStoreTask` / `getStoreTasks` to check status

### 10.3 Store Vacation Mode (Trading API)

```
SetStore → StoreVacationPreferences
  OnVacation: true
  ReturnDate: "2026-04-01"
  MessageStoreCustomText: "Back in April!"
  DisplayMessageStoreCustomText: true
```

### 10.4 Custom Pages (Trading API)

`SetStoreCustomPage` — create custom HTML pages within the store.

---

## 11. Analytics & Reporting

### 11.1 Traffic Reports (Analytics API)

```
GET /sell/analytics/v1/traffic_report
  ?dimension=DAY,LISTING
  &metric=LISTING_VIEWS_TOTAL,CLICK_THROUGH_RATE,SALES_CONVERSION_RATE,TRANSACTION
  &filter=date_range:[2026-01-01..2026-03-06]
```

**Metrics Available**:
- `CLICK_THROUGH_RATE`
- `LISTING_IMPRESSION_SEARCH_RESULTS_PAGE`
- `LISTING_IMPRESSION_STORE`
- `LISTING_IMPRESSION_TOTAL`
- `LISTING_VIEWS_SOURCE_DIRECT` / `OFF_EBAY` / `OTHER_EBAY` / `SEARCH_RESULTS_PAGE` / `STORE`
- `LISTING_VIEWS_TOTAL`
- `SALES_CONVERSION_RATE`
- `TRANSACTION`

Up to **2 years** historical data.

### 11.2 Seller Standards

| Method | Purpose |
|--------|---------|
| `findSellerStandardsProfiles` | All profiles across marketplaces |
| `getSellerStandardsProfile` | Specific marketplace/cycle (CURRENT or PROJECTED) |

Levels: `TOP_RATED`, `ABOVE_STANDARD`, `BELOW_STANDARD`

### 11.3 Customer Service Metrics

```
GET /customer_service_metric/{type}/{evaluation_type}
  type: ITEM_NOT_RECEIVED | ITEM_NOT_AS_DESCRIBED
```

### 11.4 Recommendation API

`POST /sell/recommendation/v1/find` — returns optimization suggestions:
- Pricing & format
- Title optimization
- Picture quality
- Missing item specifics
- Missing product identifiers
- Shipping recommendations
- Promoted Listings eligibility

---

## 12. Financial Management

### 12.1 Finances API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `getPayout` | `GET /payout/{id}` | Single payout |
| `getPayouts` | `GET /payout` | All payouts (filterable) |
| `getPayoutSummary` | `GET /payout_summary` | Aggregated payout data |
| `getTransactions` | `GET /transaction` | Individual transactions |
| `getTransactionSummary` | `GET /transaction_summary` | Aggregated metrics |
| `getTransfer` | `GET /transfer/{id}` | Reimbursement transfers |
| `getSellerFundsSummary` | `GET /seller_funds_summary` | Pending/processing/held funds |
| `getBillingActivities` | `GET /billing_activity` | Billing records |

### 12.2 Transaction Types

`SALE`, `RETURN`, `REFUND`, `CREDIT`, `LOAN`, `REPAYMENT`, `SHIPPING`, `TRANSFER`

### 12.3 Payout Schedules

Daily (default, 2 business days), Weekly (Tuesdays), Bi-weekly, Monthly

### 12.4 Fee Structure (2025-2026)

| Seller Type | Final Value Fee | Per-Order Fee |
|-------------|----------------|---------------|
| No Store / Starter | ~13.25% (up to $7,500) | $0.30 (≤$10) / $0.40 (>$10) |
| Basic / Premium / Enterprise | ~9-15% by category | Same |
| International sales | +~1.65% additional | — |

### 12.5 Tax Handling

- eBay automatically collects/remits sales tax in applicable US jurisdictions
- `ebayCollectAndRemitTax` flag on orders
- `fieldGroups=TAX_BREAKDOWN` for detailed tax breakdown
- VAT handling via `VAT_WITHHOLDING` transaction type

---

## 13. Notifications & Webhooks

### 13.1 REST Notification API (Commerce)

**Setup Flow**:
1. `updateConfig` — create alert configuration
2. `createDestination` — register HTTPS endpoint (challenge-response verification required)
3. `createSubscription` — subscribe to topic
4. Enable subscription

### 13.2 Available Topics (17)

| Category | Topics |
|----------|--------|
| Orders | Order Confirmation |
| Items | Item Availability, Item Marked Shipped, Item Price Revision, Priority Listing Revision |
| Feedback | Feedback Left, Feedback Received, Feedback Star Rating |
| Messaging | Buyer Question, New Message |
| Marketing | PLA Campaign Budget Status |
| Performance | Seller Customer Service Metric, Seller Standards Profile |
| Account | Authorization Revocation, Marketplace Account Deletion, Listing Preview Creation Task |
| Buyer | Buyer Requested Purchase Quote |

### 13.3 Security

Every notification includes `X-EBAY-SIGNATURE` header with ECC signature. SDKs available: Java, Node.js, .NET, PHP, Go.

### 13.4 Trading API Platform Notifications (Legacy)

50+ event types including: `FixedPriceTransaction`, `AuctionCheckoutComplete`, `ItemSold`, `ItemListed`, `BestOffer`, `BidReceived`, `ReturnCreated`, `BuyerCancelRequested`, etc.

### 13.5 Mandatory: Marketplace Account Deletion

**Hard requirement** — failure to comply = API access termination.
- Must subscribe or explicitly opt out before first production call
- 30 days to fix delivery issues before non-compliance marking

### 13.6 Reliability Strategy

Webhook + Polling hybrid recommended:
- Webhooks for real-time event-driven processing
- Periodic polling as safety net for critical data (orders, payments)

---

## 14. Bulk Operations

### 14.1 Feed API

| Feed Type | Direction | Purpose |
|-----------|-----------|---------|
| `LMS_ADD_FIXED_PRICE_ITEM` | Upload | Bulk create fixed-price listings |
| `LMS_ADD_ITEM` | Upload | Bulk create any listing type |
| `LMS_REVISE_FIXED_PRICE_ITEM` | Upload | Bulk revise fixed-price |
| `LMS_REVISE_ITEM` | Upload | Bulk revise any type |
| `LMS_REVISE_INVENTORY_STATUS` | Upload | Lightweight price/qty updates |
| `LMS_END_FIXED_PRICE_ITEM` / `LMS_END_ITEM` | Upload | Bulk end listings |
| `LMS_RELIST_FIXED_PRICE_ITEM` / `LMS_RELIST_ITEM` | Upload | Bulk relist |
| `LMS_VERIFY_ADD_*` | Upload | Validate without publishing |
| `LMS_ORDER_REPORT` | Download | Unacknowledged orders |
| `LMS_ORDER_ACK` | Upload | Order acknowledgments |
| `LMS_ACTIVE_INVENTORY_REPORT` | Download | Active listing prices/quantities |
| `LMS_SET_SHIPMENT_TRACKING_INFO` | Upload | Bulk tracking upload |

**Workflow**: `createTask` → `uploadFile` (max 25 MB) → poll `getTask` → `getResultFile`

### 14.2 Scheduled Reports

`createSchedule` — automate recurring report generation (currently for `LMS_ORDER_REPORT`).

### 14.3 Inventory API Bulk Methods

| Method | Limit |
|--------|-------|
| `bulkCreateOrReplaceInventoryItem` | 25 items |
| `bulkGetInventoryItem` | 25 items |
| `bulkUpdatePriceQuantity` | 25 items |
| `bulkCreateOffer` | 25 offers |
| `bulkPublishOffer` | 25 offers |
| `bulkMigrateListing` | 25 listings |

---

## 15. Compliance & Feedback

### 15.1 Compliance API

| Method | Purpose |
|--------|---------|
| `getListingViolationsSummary` | Summary of violations by type |
| `getListingViolations` | Detailed violations list |

Violation types: aspects adoption, HTTPS, product adoption, return policy, etc.

### 15.2 Feedback (Trading API → REST Feedback API Q4 2025)

| Trading API Call | Purpose |
|------------------|---------|
| `LeaveFeedback` | Leave feedback (Positive/Neutral/Negative) |
| `GetFeedback` | Retrieve feedback |
| `GetItemsAwaitingFeedback` | Items needing feedback |
| `RespondToFeedback` | Reply to received feedback |

One feedback per order line item per user. Feedback revision only via eBay website (5 requests per 1,000 feedback/year).

### 15.3 Seller Performance Levels

| Level | Defect Rate | Cases Closed Without Resolution |
|-------|-------------|-------------------------------|
| **Top Rated** | ≤ 0.5% | ≤ 0.3% |
| **Above Standard** | ≤ 2% | ≤ 0.3% or ≤ 2 cases |
| **Below Standard** | > 2% | > 0.3% and > 2 cases |

Top Rated Plus benefits: seal in search, **10% FVF discount** (requires 1-day handling + 30-day free returns).

---

## 16. Noslag RBAC Design

### 16.1 Permission Domains

Based on eBay's full feature set, the noslag RBAC system should cover these permission domains:

| Domain | Sub-Permissions |
|--------|----------------|
| **Listings** | `listings.create`, `listings.edit`, `listings.delete`, `listings.publish`, `listings.view` |
| **Inventory** | `inventory.manage`, `inventory.view`, `inventory.bulk_update` |
| **Orders** | `orders.view`, `orders.fulfill`, `orders.cancel`, `orders.refund` |
| **Returns** | `returns.view`, `returns.process`, `returns.refund` |
| **Messages** | `messages.view`, `messages.respond` |
| **Marketing** | `marketing.campaigns.manage`, `marketing.promotions.manage`, `marketing.view` |
| **Store** | `store.categories.manage`, `store.settings.manage`, `store.vacation` |
| **Analytics** | `analytics.traffic`, `analytics.performance`, `analytics.financial` |
| **Finances** | `finances.payouts.view`, `finances.transactions.view` |
| **Disputes** | `disputes.view`, `disputes.respond`, `disputes.evidence` |
| **Feedback** | `feedback.view`, `feedback.leave`, `feedback.respond` |
| **Policies** | `policies.shipping.manage`, `policies.return.manage`, `policies.payment.manage` |
| **Bulk Ops** | `bulk.upload`, `bulk.download` |
| **Settings** | `settings.ebay_connection`, `settings.rbac` |

### 16.2 Suggested Role Templates

| Role | Permissions |
|------|------------|
| **Owner** | All permissions |
| **Store Manager** | All except `settings.ebay_connection`, `settings.rbac`, `finances.*` |
| **Listing Specialist** | `listings.*`, `inventory.*`, `bulk.*`, `analytics.traffic` |
| **Order Processor** | `orders.*`, `returns.*`, `messages.*`, `feedback.*` |
| **Marketing Manager** | `marketing.*`, `analytics.*`, `store.categories.manage` |
| **Customer Service** | `orders.view`, `returns.*`, `messages.*`, `disputes.*`, `feedback.*` |
| **Viewer** | `*.view` on all domains (read-only) |

### 16.3 Audit Trail Requirements

Every action must log:
- **Who**: employee ID + name
- **What**: action performed (e.g., "published listing SKU-123")
- **When**: timestamp
- **eBay entity**: orderId, listingId, SKU, etc.
- **Result**: success/failure + eBay API response code

### 16.4 Connection Management

- Owner connects eBay account via OAuth consent flow
- Noslag stores encrypted tokens
- Employees NEVER see tokens or eBay credentials
- Re-authorization flow when tokens are revoked
- Support for multiple eBay marketplace connections per tenant

---

## 17. Feature Matching Matrix

### eBay Feature → Noslag Coverage

| eBay Feature | eBay API | Noslag Module | Priority |
|-------------|----------|---------------|----------|
| Fixed Price Listings | Inventory API | Listings | P0 |
| Auction Listings | Inventory API | Listings | P1 |
| Multi-Variation Listings | Inventory API (ItemGroup) | Listings | P0 |
| Item Specifics | Taxonomy API | Listings | P0 |
| Product Catalog Matching | Catalog API | Listings | P1 |
| Image Management | Media API | Listings | P0 |
| Best Offer | Trading API / Inventory API | Listings | P1 |
| Scheduled Listings | Trading API | Listings | P2 |
| Out-of-Stock Control | Trading API | Inventory | P1 |
| Inventory Locations | Inventory API | Inventory | P1 |
| Bulk Inventory Updates | Inventory API + Feed API | Inventory | P0 |
| Order Retrieval | Fulfillment API | Orders | P0 |
| Shipping Fulfillment | Fulfillment API | Orders | P0 |
| Refunds | Fulfillment API | Orders | P0 |
| Order Cancellation | Post-Order API | Orders | P0 |
| Returns Processing | Post-Order API | Returns | P0 |
| INR Inquiries | Post-Order API | Returns | P0 |
| Payment Disputes | Fulfillment API | Disputes | P1 |
| Buyer-Seller Messaging | Trading API → Message API | Messages | P0 |
| Shipping Policies | Account API | Policies | P0 |
| Return Policies | Account API | Policies | P0 |
| Payment Policies | Account API | Policies | P0 |
| Promoted Listings Standard | Marketing API | Marketing | P1 |
| Promoted Listings Advanced | Marketing API | Marketing | P2 |
| Markdown Sales | Marketing API | Marketing | P1 |
| Volume Pricing | Marketing API | Marketing | P2 |
| Coded Coupons | Marketing API | Marketing | P2 |
| Email Campaigns | Marketing API | Marketing | P2 |
| Store Categories | Stores API | Store | P1 |
| Store Vacation Mode | Trading API | Store | P2 |
| Traffic Analytics | Analytics API | Analytics | P1 |
| Seller Standards | Analytics API | Analytics | P1 |
| Listing Recommendations | Recommendation API | Analytics | P2 |
| Financial Reports | Finances API | Finances | P1 |
| Payout Tracking | Finances API | Finances | P1 |
| Compliance Violations | Compliance API | Compliance | P1 |
| Feedback Management | Trading API → Feedback API | Feedback | P1 |
| Webhooks | Notification API | System | P0 |
| Bulk Upload/Download | Feed API | Bulk Ops | P1 |
| Shipping Labels | Logistics API | Shipping | P2 |
| Cross-Border Trade | Translation API | Listings | P3 |
| Negotiation Offers | Negotiation API | Sales | P2 |

---

## 18. Implementation Phases

### Phase 1: Foundation (P0)

**OAuth + Connection**
- eBay OAuth consent flow
- Token storage (encrypted), refresh, revocation handling
- Marketplace Account Deletion webhook (mandatory)
- Multi-marketplace support header (`X-EBAY-C-MARKETPLACE-ID`)

**Core Listings**
- Inventory item CRUD (single + multi-variation)
- Offer creation with policy references
- Publishing / withdrawing
- Image upload via Media API
- Item specifics via Taxonomy API
- Category selection + suggestions

**Core Orders**
- Order polling + webhook-based sync
- Order detail view
- Shipping fulfillment creation (tracking upload)
- Refund processing
- Order cancellation handling

**Core Policies**
- Fulfillment policy management
- Return policy management
- Payment policy management

**Core Messages**
- Inbox retrieval
- Reply to buyer questions

**RBAC**
- Permission system with domains
- Role templates
- Audit logging

### Phase 2: Operations (P1)

**Enhanced Listings**
- Auction support
- Best Offer support
- Product catalog matching
- Out-of-stock control

**Enhanced Orders**
- Returns processing (full workflow)
- INR inquiry handling
- Payment dispute management

**Marketing**
- Promoted Listings Standard campaigns
- Markdown sales / promotions

**Analytics**
- Traffic reports dashboard
- Seller standards monitoring
- Customer service metrics

**Finances**
- Payout tracking
- Transaction reports
- Funds summary

**Store**
- Store category management
- Compliance violation tracking

**Bulk**
- Bulk inventory updates (Inventory API bulk methods)
- Feed API integration for large-scale ops

### Phase 3: Advanced (P2)

- Promoted Listings Advanced (CPC + keywords)
- Volume pricing promotions
- Coded coupons
- Email campaigns
- Scheduled listings
- Shipping label generation (Logistics API)
- Negotiation offers to watchers
- Store vacation mode
- Listing recommendations
- Custom store pages

### Phase 4: Enterprise (P3)

- Cross-border trade (Translation API)
- Multi-marketplace listing sync
- Advanced analytics dashboards
- Terapeak-equivalent market research
- Automated repricing
- AI-powered listing optimization
- Feed API scheduled reports

---

## Technical Requirements

### API Base URLs

| Environment | URL |
|-------------|-----|
| Production | `https://api.ebay.com` |
| Sandbox | `https://api.sandbox.ebay.com` |
| Auth (Prod) | `https://auth.ebay.com` |
| Auth (Sandbox) | `https://auth.sandbox.ebay.com` |
| Post-Order | `https://api.ebay.com/post-order/v2` |

### Required HTTP Headers

| Header | Value | When |
|--------|-------|------|
| `Authorization` | `Bearer <access_token>` | All API calls |
| `Content-Type` | `application/json` | POST/PUT requests |
| `X-EBAY-C-MARKETPLACE-ID` | e.g., `EBAY_US` | Most Sell API calls |
| `Accept-Language` | e.g., `en-US` | Localization |

### Global Marketplaces

| ID | Country |
|----|---------|
| `EBAY_US` | United States |
| `EBAY_GB` | United Kingdom |
| `EBAY_DE` | Germany |
| `EBAY_AU` | Australia |
| `EBAY_CA` | Canada |
| `EBAY_FR` | France |
| `EBAY_IT` | Italy |
| `EBAY_ES` | Spain |
| `EBAY_AT` | Austria |
| `EBAY_BE` | Belgium |
| `EBAY_CH` | Switzerland |
| `EBAY_IE` | Ireland |
| `EBAY_NL` | Netherlands |
| `EBAY_PL` | Poland |
| `EBAY_SG` | Singapore |

### Developer Program Requirements

1. Register at developer.ebay.com
2. Get App ID, Cert ID, Dev ID (separate for Sandbox + Production)
3. Configure RuName
4. **Mandatory**: Implement Marketplace Account Deletion handler before first production call
5. Complete **Application Growth Check** (free) to increase rate limits
6. Comply with API License Agreement (no AI/ML training on eBay data, no competing services)

### Data Compliance

- Delete user data within **30 days** of deletion trigger
- Item listing data must be refreshed within **6 hours**
- All API data must be destroyed within **10 days** of license termination
- GDPR: act as data processor, standard contractual clauses required
- Privacy policy must be publicly available

---

## Sources

### Official eBay Developer Documentation
- [eBay REST API Landing](https://developer.ebay.com/api-docs/static/ebay-rest-landing.html)
- [OAuth Overview](https://developer.ebay.com/api-docs/static/oauth-authorization-code-grant.html)
- [OAuth Scopes](https://developer.ebay.com/api-docs/static/oauth-scopes.html)
- [API Call Limits](https://developer.ebay.com/develop/get-started/api-call-limits)
- [Sell APIs Overview](https://developer.ebay.com/develop/apis/restful-apis/sell-apis)
- [Inventory API](https://developer.ebay.com/api-docs/sell/inventory/overview.html)
- [Fulfillment API](https://developer.ebay.com/api-docs/sell/fulfillment/overview.html)
- [Marketing API](https://developer.ebay.com/api-docs/sell/marketing/overview.html)
- [Account API](https://developer.ebay.com/api-docs/sell/account/overview.html)
- [Analytics API](https://developer.ebay.com/api-docs/sell/analytics/overview.html)
- [Finances API](https://developer.ebay.com/api-docs/sell/finances/overview.html)
- [Feed API](https://developer.ebay.com/api-docs/sell/feed/overview.html)
- [Metadata API](https://developer.ebay.com/api-docs/sell/metadata/overview.html)
- [Logistics API](https://developer.ebay.com/api-docs/sell/logistics/overview.html)
- [Stores API](https://developer.ebay.com/api-docs/sell/stores/overview.html)
- [Taxonomy API](https://developer.ebay.com/api-docs/commerce/taxonomy/overview.html)
- [Catalog API](https://developer.ebay.com/api-docs/commerce/catalog/overview.html)
- [Media API](https://developer.ebay.com/api-docs/commerce/media/overview.html)
- [Notification API](https://developer.ebay.com/api-docs/commerce/notification/overview.html)
- [Post-Order API](https://developer.ebay.com/devzone/post-order/index.html)
- [Trading API](https://developer.ebay.com/devzone/xml/docs/reference/ebay/index.html)
- [Compliance API](https://developer.ebay.com/api-docs/sell/compliance/overview.html)
- [Recommendation API](https://developer.ebay.com/api-docs/sell/recommendation/overview.html)
- [Negotiation API](https://developer.ebay.com/api-docs/sell/negotiation/overview.html)
- [Application Growth Check](https://developer.ebay.com/promote/passing-compatible-application-check)
- [Marketplace Account Deletion](https://developer.ebay.com/marketplace-account-deletion)
- [Q4 2025 Newsletter](https://developer.ebay.com/updates/newsletter/q4_2025)
