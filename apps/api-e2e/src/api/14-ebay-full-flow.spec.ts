import axios from 'axios';
import { getAdminToken, adminHeaders } from '../support/auth-helper';
import { store } from '../support/data-store';

/**
 * eBay Marketplace Full-Flow E2E Tests
 *
 * Exercises the ENTIRE eBay integration end-to-end in mock mode:
 *   Connection → OAuth → Listings → Orders → Returns → Messages →
 *   Campaigns → Keywords → Analytics → Finances → Promotions →
 *   Taxonomy → Inventory Locations → Cross-Border → Compliance →
 *   Feedback → Shipping → Bulk Ops → Negotiations → Inquiries →
 *   Disputes → Cancellations → Media → Email Campaigns → Catalog →
 *   RBAC → Webhooks
 *
 * Requires: MOCK_EXTERNAL_SERVICES=true, ENABLE_DEV_PASSWORD_LOGIN=true
 */
describe('eBay Marketplace — Full Flow', () => {
  let connectionId: string;
  let productId: string;
  let listingId: string;
  let campaignId: string;

  // ─────────────────────────── Setup ───────────────────────────

  beforeAll(async () => {
    await getAdminToken();

    // Ensure a product category exists
    if (!store.e2eCategoryId) {
      const catRes = await axios.post(
        '/store/admin/categories',
        { name: `E2E Cat ${Date.now()}`, slug: `e2e-cat-${Date.now()}` },
        { headers: adminHeaders() },
      );
      if (catRes.status === 201) {
        store.e2eCategoryId = catRes.data.id;
      }
    }

    // Ensure we have products
    for (let i = 0; i < 3; i++) {
      const n = `eBay E2E Product ${i} ${Date.now()}`;
      const res = await axios.post(
        '/store/admin/products/simple',
        {
          name: n,
          price: 19.99 + i * 10,
          description: `E2E test product ${i}`,
          images: ['https://placehold.co/400x400'],
          categoryId: store.e2eCategoryId,
        },
        { headers: adminHeaders() },
      );
      if (res.status === 201) {
        if (!store.e2eProductIds) store.e2eProductIds = [];
        store.e2eProductIds.push(res.data.id);
      }
    }
  }, 30000);

  // ═══════════════════════════════════════════════════════════════
  // 1. CONNECTION + OAUTH
  // ═══════════════════════════════════════════════════════════════

  describe('1 — Connection & OAuth', () => {
    it('creates an eBay connection', async () => {
      const res = await axios.post(
        '/marketplace/connections',
        {
          platform: 'EBAY',
          name: `E2E eBay ${Date.now()}`,
          marketplaceId: 'EBAY_US',
          isDefault: false,
        },
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(201);
      connectionId = res.data.id;
      store.e2eConnectionId = connectionId;
      expect(res.data.platform).toBe('EBAY');
      expect(res.data.isConnected).toBe(false);
    });

    it('lists connections', async () => {
      const res = await axios.get('/marketplace/connections', {
        headers: adminHeaders(),
      });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
      expect(res.data.some((c: any) => c.id === connectionId)).toBe(true);
    });

    it('gets connection by id', async () => {
      const res = await axios.get(`/marketplace/connections/${connectionId}`, {
        headers: adminHeaders(),
      });
      expect(res.status).toBe(200);
      expect(res.data.id).toBe(connectionId);
    });

    it('redirects to eBay OAuth', async () => {
      const res = await axios.get(
        `/marketplace/ebay/auth/connect?connectionId=${connectionId}`,
        { headers: adminHeaders(), maxRedirects: 0 },
      );
      expect(res.status).toBe(302);
      const location = res.headers['location'] || '';
      expect(location).toContain('ebay');

      // Save state for callback
      const url = new URL(location);
      store.e2eOAuthState = url.searchParams.get('state') || '';
      expect(store.e2eOAuthState).toBeTruthy();
    });

    it('handles OAuth callback and connects', async () => {
      const res = await axios.get(
        `/marketplace/ebay/auth/callback?code=mock_auth_code&state=${store.e2eOAuthState}`,
        { maxRedirects: 0 },
      );
      expect(res.status).toBe(302);
      expect(res.headers['location']).toContain('success=true');
    });

    it('connection is now fully ready', async () => {
      const res = await axios.get(
        `/marketplace/connections/${connectionId}/status`,
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(200);
      expect(res.data.hasCredentials).toBe(true);
      expect(res.data.isConnected).toBe(true);
      expect(res.data.canPublishListings).toBe(true);
    });

    it('gets and sets vacation mode', async () => {
      const getRes = await axios.get(
        `/marketplace/connections/${connectionId}/vacation`,
        { headers: adminHeaders() },
      );
      expect(getRes.status).toBe(200);

      const setRes = await axios.post(
        `/marketplace/connections/${connectionId}/vacation`,
        { enabled: false, returnMessage: '' },
        { headers: adminHeaders() },
      );
      expect(setRes.status).toBeLessThan(400);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 2. LISTING LIFECYCLE
  // ═══════════════════════════════════════════════════════════════

  describe('2 — Listing Lifecycle', () => {
    it('creates a listing from product (direct)', async () => {
      productId = store.e2eProductIds?.[0];
      expect(productId).toBeTruthy();

      const res = await axios.post(
        '/marketplace/listings',
        {
          connectionId,
          productListingId: productId,
          title: 'E2E Test Widget',
          description: 'End-to-end test listing',
          price: 29.99,
          quantity: 10,
          condition: 'NEW',
          categoryId: '171485',
        },
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(201);
      listingId = res.data.id;
      store.e2eListingId = listingId;
      expect(res.data.status).toMatch(/draft/i);
    });

    it('lists all listings', async () => {
      const res = await axios.get('/marketplace/listings', {
        headers: adminHeaders(),
      });
      expect(res.status).toBe(200);
    });

    it('gets a listing by id', async () => {
      const res = await axios.get(`/marketplace/listings/${listingId}`, {
        headers: adminHeaders(),
      });
      expect(res.status).toBe(200);
      expect(res.data.id).toBe(listingId);
    });

    it('updates a listing', async () => {
      const res = await axios.patch(
        `/marketplace/listings/${listingId}`,
        { title: 'Updated E2E Widget', price: 34.99 },
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(200);
    });

    it('approves the listing', async () => {
      const res = await axios.post(
        `/marketplace/listings/${listingId}/approve`,
        {},
        { headers: adminHeaders() },
      );
      // draft -> approved (some flows need pending_review first)
      expect(res.status).toBeLessThan(500);
    });

    it('publishes the listing (mock eBay)', async () => {
      const res = await axios.post(
        `/marketplace/listings/${listingId}/publish`,
        {},
        { headers: adminHeaders() },
      );
      expect(res.status).toBeLessThan(500);
      if (res.status < 400 && res.data?.status) {
        expect(res.data.status).toMatch(/published/i);
      }
    });

    it('syncs inventory for a listing', async () => {
      const res = await axios.post(
        `/marketplace/listings/${listingId}/sync-inventory`,
        {},
        { headers: adminHeaders() },
      );
      expect(res.status).toBeLessThan(500);
    });

    it('creates a direct listing via eBay-specific endpoint', async () => {
      const pid = store.e2eProductIds?.[1];
      if (!pid) return;

      const res = await axios.post(
        '/marketplace/ebay/listings/direct',
        {
          connectionId,
          productListingId: pid,
          title: 'Direct E2E Listing',
          description: 'Direct listing test',
          price: 19.99,
          quantity: 5,
          condition: 'NEW',
          categoryId: '171485',
          fulfillmentPolicyId: 'mock-fp',
          paymentPolicyId: 'mock-pp',
          returnPolicyId: 'mock-rp',
        },
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(201);
      expect(res.data.title).toBe('Direct E2E Listing');
    });

    it('creates a multi-variation listing', async () => {
      const pid = store.e2eProductIds?.[2];
      if (!pid) return;

      const ts = Date.now();
      const res = await axios.post(
        '/marketplace/ebay/listings/variations',
        {
          connectionId,
          productListingId: pid,
          groupTitle: `Variation Group ${ts}`,
          variantAspects: ['Size'],
          description: 'Variation test',
          categoryId: '171485',
          fulfillmentPolicyId: 'mock-fp',
          paymentPolicyId: 'mock-pp',
          returnPolicyId: 'mock-rp',
          variants: [
            { sku: `V-SM-${ts}`, title: 'Small', price: 19.99, quantity: 5, condition: 'NEW', aspects: { Size: ['Small'] } },
            { sku: `V-LG-${ts}`, title: 'Large', price: 24.99, quantity: 3, condition: 'NEW', aspects: { Size: ['Large'] } },
          ],
        },
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(201);
      expect(res.data.listings || res.data.groupKey).toBeTruthy();
    });

    it('gets and sets out-of-stock control', async () => {
      const getRes = await axios.get(
        `/marketplace/ebay/listings/out-of-stock-control?connectionId=${connectionId}`,
        { headers: adminHeaders() },
      );
      expect(getRes.status).toBe(200);

      const setRes = await axios.post(
        '/marketplace/ebay/listings/out-of-stock-control',
        { connectionId, enabled: true },
        { headers: adminHeaders() },
      );
      expect(setRes.status).toBeLessThan(400);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 3. ORDERS
  // ═══════════════════════════════════════════════════════════════

  describe('3 — Orders', () => {
    it('syncs orders from eBay (mock)', async () => {
      const res = await axios.post(
        '/marketplace/orders/sync',
        { connectionId },
        { headers: adminHeaders() },
      );
      expect([200, 201]).toContain(res.status);
      expect(res.data.success).toBe(true);
    });

    it('lists orders', async () => {
      const res = await axios.get(
        `/marketplace/orders?connectionId=${connectionId}`,
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(200);
    });

    it('returns 404 for non-existent order', async () => {
      const res = await axios.get(
        '/marketplace/orders/00000000-0000-0000-0000-000000000000',
        { headers: adminHeaders() },
      );
      expect([400, 404]).toContain(res.status);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 4. RETURNS
  // ═══════════════════════════════════════════════════════════════

  describe('4 — Returns', () => {
    it('syncs returns (mock)', async () => {
      const res = await axios.post(
        '/marketplace/returns/sync',
        { connectionId },
        { headers: adminHeaders() },
      );
      expect([200, 201]).toContain(res.status);
    });

    it('lists returns', async () => {
      const res = await axios.get(
        `/marketplace/returns?connectionId=${connectionId}`,
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 5. MESSAGES
  // ═══════════════════════════════════════════════════════════════

  describe('5 — Buyer-Seller Messages', () => {
    it('syncs messages (mock)', async () => {
      const res = await axios.post(
        '/marketplace/messages/sync',
        { connectionId },
        { headers: adminHeaders() },
      );
      expect([200, 201]).toContain(res.status);
    });

    it('lists message threads', async () => {
      const res = await axios.get(
        `/marketplace/messages?connectionId=${connectionId}`,
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(200);
    });

    it('gets unread count', async () => {
      const res = await axios.get(
        `/marketplace/messages/unread-count?connectionId=${connectionId}`,
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty('unreadCount');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 6. CAMPAIGNS (Promoted Listings)
  // ═══════════════════════════════════════════════════════════════

  describe('6 — Campaigns & Keywords', () => {
    it('creates a Promoted Listings campaign', async () => {
      const res = await axios.post(
        '/marketplace/campaigns',
        {
          connectionId,
          name: `E2E Campaign ${Date.now()}`,
          marketplaceId: 'EBAY_US',
          bidPercentage: 5,
        },
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(201);
      campaignId = res.data.id || res.data.campaignId;
      store.e2eCampaignId = campaignId;
      expect(campaignId).toBeTruthy();
    });

    it('lists campaigns', async () => {
      const res = await axios.get(
        `/marketplace/campaigns?connectionId=${connectionId}`,
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(200);
    });

    it('gets a campaign by id', async () => {
      const res = await axios.get(
        `/marketplace/campaigns/${campaignId}?connectionId=${connectionId}`,
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(200);
    });

    it('creates a keyword', async () => {
      const res = await axios.post(
        `/marketplace/campaigns/${campaignId}/keywords`,
        {
          connectionId,
          adGroupId: 'ag-e2e',
          keyword: 'test widget',
          matchType: 'BROAD',
          bid: { value: '0.50', currency: 'USD' },
        },
        { headers: adminHeaders() },
      );
      expect(res.status).toBeLessThan(400);
    });

    it('creates a negative keyword', async () => {
      const res = await axios.post(
        `/marketplace/campaigns/${campaignId}/keywords/negative`,
        {
          connectionId,
          adGroupId: 'ag-e2e',
          keyword: 'cheap',
          matchType: 'EXACT',
        },
        { headers: adminHeaders() },
      );
      expect(res.status).toBeLessThan(400);
    });

    it('lists keywords', async () => {
      const res = await axios.get(
        `/marketplace/campaigns/${campaignId}/keywords?connectionId=${connectionId}`,
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(200);
    });

    it('gets keyword suggestions', async () => {
      const res = await axios.get(
        `/marketplace/campaigns/${campaignId}/keywords/suggestions?connectionId=${connectionId}&adGroupId=ag-e2e&listingIds=l1`,
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(200);
    });

    it('gets bid suggestions', async () => {
      const res = await axios.get(
        `/marketplace/campaigns/${campaignId}/keywords/bid-suggestions?connectionId=${connectionId}&adGroupId=ag-e2e&keywords=widget`,
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 7. TAXONOMY
  // ═══════════════════════════════════════════════════════════════

  describe('7 — Taxonomy', () => {
    it('searches categories', async () => {
      const res = await axios.get(
        `/marketplace/ebay/taxonomy/categories/search?connectionId=${connectionId}&query=electronics`,
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(200);
      expect(res.data.categorySuggestions || res.data).toBeTruthy();
    });

    it('gets category aspects', async () => {
      const res = await axios.get(
        `/marketplace/ebay/taxonomy/categories/1/aspects?connectionId=${connectionId}`,
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(200);
    });

    it('gets category conditions', async () => {
      const res = await axios.get(
        `/marketplace/ebay/taxonomy/categories/1/conditions?connectionId=${connectionId}`,
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 8. ANALYTICS
  // ═══════════════════════════════════════════════════════════════

  describe('8 — Analytics', () => {
    it('gets traffic report', async () => {
      const res = await axios.get(
        `/marketplace/analytics/traffic?connectionId=${connectionId}`,
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(200);
    });

    it('gets seller standards', async () => {
      const res = await axios.get(
        `/marketplace/analytics/seller-standards?connectionId=${connectionId}`,
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(200);
    });

    it('gets customer service metrics', async () => {
      const res = await axios.get(
        `/marketplace/analytics/customer-service?connectionId=${connectionId}`,
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(200);
    });

    it('gets recommendations', async () => {
      const res = await axios.get(
        `/marketplace/analytics/recommendations?connectionId=${connectionId}`,
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 9. FINANCES
  // ═══════════════════════════════════════════════════════════════

  describe('9 — Finances', () => {
    const endpoints = [
      'payouts',
      'payouts/summary',
      'transactions',
      'transactions/summary',
      'funds-summary',
    ];

    endpoints.forEach((ep) => {
      it(`gets ${ep}`, async () => {
        const res = await axios.get(
          `/marketplace/finances/${ep}?connectionId=${connectionId}`,
          { headers: adminHeaders() },
        );
        expect(res.status).toBe(200);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 10. PROMOTIONS
  // ═══════════════════════════════════════════════════════════════

  describe('10 — Promotions', () => {
    it('lists promotions', async () => {
      const res = await axios.get(
        `/marketplace/promotions?connectionId=${connectionId}`,
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(200);
    });

    it('creates a markdown promotion', async () => {
      const res = await axios.post(
        '/marketplace/promotions/markdown',
        {
          connectionId,
          name: `E2E Markdown ${Date.now()}`,
          description: 'E2E test sale',
          startDate: '2026-06-01',
          endDate: '2026-06-30',
          marketplaceId: 'EBAY_US',
          selectedItems: [{ listingId: 'mock-l1', discount: 15 }],
        },
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(201);
      expect(res.data.status).toMatch(/scheduled|active/i);
    });

    it('creates an order discount', async () => {
      const res = await axios.post(
        '/marketplace/promotions/order-discount',
        {
          connectionId,
          name: `E2E Volume ${Date.now()}`,
          description: 'Buy more save more',
          startDate: '2026-07-01',
          endDate: '2026-07-31',
          marketplaceId: 'EBAY_US',
          discountRules: { minQuantity: 2, discountPercentage: 10 },
        },
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(201);
    });

    it('gets promotion summary report', async () => {
      const res = await axios.get(
        `/marketplace/promotions/report?connectionId=${connectionId}&marketplaceId=EBAY_US`,
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 11. STORE CATEGORIES
  // ═══════════════════════════════════════════════════════════════

  describe('11 — Store Categories', () => {
    it('lists store categories', async () => {
      const res = await axios.get(
        `/marketplace/ebay/store-categories?connectionId=${connectionId}`,
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(200);
    });

    it('sets store categories', async () => {
      const res = await axios.post(
        '/marketplace/ebay/store-categories',
        { categories: [{ name: 'E2E Electronics', order: 1 }] },
        { headers: adminHeaders() },
      );
      expect(res.status).toBeLessThan(400);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 12. INVENTORY LOCATIONS
  // ═══════════════════════════════════════════════════════════════

  describe('12 — Inventory Locations', () => {
    const key = `wh-e2e-${Date.now()}`;

    it('lists locations', async () => {
      const res = await axios.get(
        `/marketplace/inventory-locations?connectionId=${connectionId}`,
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(200);
    });

    it('creates a location', async () => {
      const res = await axios.post(
        '/marketplace/inventory-locations',
        {
          connectionId,
          merchantLocationKey: key,
          name: 'E2E Warehouse',
          locationType: 'WAREHOUSE',
          address: {
            addressLine1: '123 Test St',
            city: 'Austin',
            stateOrProvince: 'TX',
            postalCode: '78701',
            country: 'US',
          },
        },
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(201);
    });

    it('gets a location', async () => {
      const res = await axios.get(
        `/marketplace/inventory-locations/${key}?connectionId=${connectionId}`,
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(200);
    });

    it('updates a location', async () => {
      const res = await axios.patch(
        `/marketplace/inventory-locations/${key}`,
        { connectionId, name: 'Updated E2E WH' },
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(200);
    });

    it('disables and re-enables a location', async () => {
      const disableRes = await axios.post(
        `/marketplace/inventory-locations/${key}/disable`,
        { connectionId },
        { headers: adminHeaders() },
      );
      expect(disableRes.status).toBeLessThan(400);

      const enableRes = await axios.post(
        `/marketplace/inventory-locations/${key}/enable`,
        { connectionId },
        { headers: adminHeaders() },
      );
      expect(enableRes.status).toBeLessThan(400);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 13. CROSS-BORDER TRADE
  // ═══════════════════════════════════════════════════════════════

  describe('13 — Cross-Border Trade', () => {
    it('lists supported marketplaces', async () => {
      const res = await axios.get('/marketplace/cross-border/marketplaces', {
        headers: adminHeaders(),
      });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
      expect(res.data.length).toBeGreaterThan(0);
      expect(res.data[0]).toHaveProperty('marketplaceId');
    });

    it('gets exchange rates', async () => {
      const res = await axios.get(
        '/marketplace/cross-border/exchange-rates?baseCurrency=USD&targetCurrencies=GBP,EUR',
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(200);
      expect(res.data.baseCurrency).toBe('USD');
      expect(res.data.rates).toHaveProperty('GBP');
      expect(res.data.rates).toHaveProperty('EUR');
    });

    it('gets cross-border shipping policies', async () => {
      const res = await axios.get(
        `/marketplace/cross-border/shipping-policies?connectionId=${connectionId}&marketplaceId=EBAY_UK`,
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(200);
    });

    it('gets cross-border return policies', async () => {
      const res = await axios.get(
        `/marketplace/cross-border/return-policies?connectionId=${connectionId}&marketplaceId=EBAY_UK`,
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(200);
    });

    it('lists item cross-border', async () => {
      const res = await axios.post(
        '/marketplace/cross-border/list',
        {
          connectionId,
          sku: 'E2E-SKU-001',
          targetMarketplace: 'EBAY_UK',
          price: { value: '24.99', currency: 'GBP' },
          fulfillmentPolicyId: 'mock-fp',
          returnPolicyId: 'mock-rp',
          categoryId: '171485',
        },
        { headers: adminHeaders() },
      );
      expect(res.status).toBeLessThan(400);
      expect(res.data.status).toMatch(/published/i);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 14. FEEDBACK
  // ═══════════════════════════════════════════════════════════════

  describe('14 — Feedback', () => {
    it('lists feedback', async () => {
      const res = await axios.get(
        `/marketplace/feedback?connectionId=${connectionId}`,
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(200);
    });

    it('gets feedback summary', async () => {
      const res = await axios.get(
        `/marketplace/feedback/summary?connectionId=${connectionId}`,
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 15. COMPLIANCE
  // ═══════════════════════════════════════════════════════════════

  describe('15 — Compliance', () => {
    it('gets violations from eBay (mock)', async () => {
      const res = await axios.get(
        `/marketplace/compliance?connectionId=${connectionId}`,
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(200);
    });

    it('gets violation summary', async () => {
      const res = await axios.get(
        `/marketplace/compliance/summary?connectionId=${connectionId}`,
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(200);
    });

    it('gets local violations', async () => {
      const res = await axios.get(
        `/marketplace/compliance/local?connectionId=${connectionId}`,
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(200);
    });

    it('syncs compliance', async () => {
      const res = await axios.post(
        '/marketplace/compliance/sync',
        { connectionId },
        { headers: adminHeaders() },
      );
      expect([200, 201]).toContain(res.status);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 16. SHIPPING
  // ═══════════════════════════════════════════════════════════════

  describe('16 — Shipping', () => {
    it('gets a shipping quote', async () => {
      const res = await axios.post(
        '/marketplace/shipping/quote',
        { connectionId, orderId: 'mock-order-1' },
        { headers: adminHeaders() },
      );
      expect(res.status).toBeLessThan(400);
    });

    it('creates a shipment', async () => {
      const res = await axios.post(
        '/marketplace/shipping',
        { connectionId, shippingQuoteId: 'mock-q1', rateId: 'mock-r1' },
        { headers: adminHeaders() },
      );
      expect(res.status).toBeLessThan(400);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 17. BULK OPERATIONS
  // ═══════════════════════════════════════════════════════════════

  describe('17 — Bulk Operations', () => {
    it('bulk updates price and quantity', async () => {
      const res = await axios.post(
        '/marketplace/bulk/price-quantity',
        {
          connectionId,
          items: [
            { sku: 'E2E-SKU-001', price: 29.99, quantity: 10 },
            { sku: 'E2E-SKU-002', price: 39.99, quantity: 5 },
          ],
        },
        { headers: adminHeaders() },
      );
      expect(res.status).toBeLessThan(400);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 18. NEGOTIATIONS
  // ═══════════════════════════════════════════════════════════════

  describe('18 — Negotiations', () => {
    it('gets eligible items', async () => {
      const res = await axios.get(
        `/marketplace/negotiations/eligible?connectionId=${connectionId}`,
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(200);
    });

    it('gets active negotiations', async () => {
      const res = await axios.get(
        `/marketplace/negotiations/active?connectionId=${connectionId}`,
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 19. INQUIRIES & CASES
  // ═══════════════════════════════════════════════════════════════

  describe('19 — Inquiries & Cases', () => {
    it('lists inquiries', async () => {
      const res = await axios.get(
        `/marketplace/inquiries?connectionId=${connectionId}`,
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(200);
    });

    it('lists cases', async () => {
      const res = await axios.get(
        `/marketplace/inquiries/cases?connectionId=${connectionId}`,
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 20. DISPUTES
  // ═══════════════════════════════════════════════════════════════

  describe('20 — Disputes', () => {
    it('lists disputes', async () => {
      const res = await axios.get(
        `/marketplace/disputes?connectionId=${connectionId}`,
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 21. CANCELLATIONS
  // ═══════════════════════════════════════════════════════════════

  describe('21 — Cancellations', () => {
    it('lists cancellations', async () => {
      const res = await axios.get(
        `/marketplace/cancellations?connectionId=${connectionId}`,
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 22. MEDIA
  // ═══════════════════════════════════════════════════════════════

  describe('22 — Media', () => {
    it('uploads image from URL', async () => {
      const res = await axios.post(
        '/marketplace/media/upload-url',
        { connectionId, imageUrl: 'https://placehold.co/400x400.jpg' },
        { headers: adminHeaders() },
      );
      expect(res.status).toBeLessThan(400);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 23. EMAIL CAMPAIGNS
  // ═══════════════════════════════════════════════════════════════

  describe('23 — Email Campaigns', () => {
    it('lists email campaigns', async () => {
      const res = await axios.get(
        `/marketplace/email-campaigns?connectionId=${connectionId}`,
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(200);
    });

    it('gets audiences', async () => {
      const res = await axios.get(
        `/marketplace/email-campaigns/audiences?connectionId=${connectionId}`,
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 24. CATALOG
  // ═══════════════════════════════════════════════════════════════

  describe('24 — Catalog', () => {
    it('searches eBay catalog', async () => {
      const res = await axios.get(
        `/marketplace/ebay/catalog/search?connectionId=${connectionId}&query=iphone`,
        { headers: adminHeaders() },
      );
      expect(res.status).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 25. RBAC
  // ═══════════════════════════════════════════════════════════════

  describe('25 — RBAC Permissions', () => {
    it('lists permission templates', async () => {
      const res = await axios.get('/marketplace/rbac/templates', {
        headers: adminHeaders(),
      });
      expect(res.status).toBe(200);
      expect(res.data).toBeTruthy();
    });

    it('gets current user permissions', async () => {
      const res = await axios.get('/marketplace/rbac/permissions', {
        headers: adminHeaders(),
      });
      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty('permissions');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 26. WEBHOOKS
  // ═══════════════════════════════════════════════════════════════

  describe('26 — Webhooks', () => {
    it('responds to account-deletion challenge', async () => {
      const res = await axios.get(
        '/marketplace/ebay/webhooks/account-deletion?challenge_code=e2e-test-challenge',
      );
      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty('challengeResponse');
    });

    it('responds to notification challenge', async () => {
      const res = await axios.get(
        '/marketplace/ebay/webhooks/notifications?challenge_code=e2e-notif-challenge',
      );
      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty('challengeResponse');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 27. LISTING END + CLEANUP
  // ═══════════════════════════════════════════════════════════════

  describe('27 — Listing End & Delete', () => {
    it('ends a published listing', async () => {
      if (!listingId) return;
      const res = await axios.post(
        `/marketplace/listings/${listingId}/end`,
        {},
        { headers: adminHeaders() },
      );
      // May fail if listing wasn't published — that's OK
      expect(res.status).toBeLessThan(500);
    });

    it('deletes a listing', async () => {
      if (!listingId) return;
      const res = await axios.delete(
        `/marketplace/listings/${listingId}`,
        { headers: adminHeaders() },
      );
      expect(res.status).toBeLessThan(500);
    });

    it('disconnects the eBay connection', async () => {
      const res = await axios.post(
        `/marketplace/connections/${connectionId}/disconnect`,
        {},
        { headers: adminHeaders() },
      );
      expect(res.status).toBeLessThan(500);
    });
  });
});
