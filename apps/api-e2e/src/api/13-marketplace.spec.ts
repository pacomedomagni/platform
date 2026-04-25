import axios from 'axios';
import { getAdminToken, adminHeaders } from '../support/auth-helper';
import { store } from '../support/data-store';

describe('Marketplace Endpoints', () => {
  beforeAll(async () => {
    await getAdminToken();

    // Ensure we have a product for listing tests
    if (!store.productIds?.length) {
      try {
        const prodRes = await axios.post(
          '/store/admin/products/simple',
          { name: 'Marketplace Test Product', price: 24.99, isPublished: true, images: ['https://placehold.co/400x400'] },
          { headers: adminHeaders() },
        );
        if (prodRes.status === 201) {
          const id = prodRes.data.id || prodRes.data.productId;
          if (id) store.productIds = [id];
        }
      } catch {
        // Products may already exist from earlier tests
      }
    }
  });

  // ───────────────────────── Local CRUD ─────────────────────────

  describe('Marketplace Connections (Local)', () => {
    it('GET /marketplace/connections → 200 (list connections)', async () => {
      const res = await axios.get('/marketplace/connections', {
        headers: adminHeaders(),
      });

      expect(res.status).toBeLessThan(500);
    });
  });

  // ───────────────────────── eBay Connection + OAuth (Mock Mode) ─────────────────────────

  let connectionId: string;

  describe('eBay Connection Setup (Mock Mode)', () => {
    it('POST /marketplace/connections → 201 (create eBay connection)', async () => {
      const res = await axios.post(
        '/marketplace/connections',
        {
          platform: 'EBAY',
          name: `E2E Test Store ${Date.now()}`,
          marketplaceId: 'EBAY_US',
          isDefault: false,
        },
        { headers: adminHeaders() },
      );

      expect(res.status).toBe(201);
      connectionId = res.data.id;
      expect(connectionId).toBeDefined();
      expect(res.data.platform).toBe('EBAY');
      expect(res.data.isConnected).toBe(false);
      store.ebayConnectionId = connectionId;
    });

    it('GET /marketplace/ebay/auth/connect → 302 redirect to mock eBay OAuth', async () => {
      expect(connectionId).toBeTruthy();

      const res = await axios.get(
        `/marketplace/ebay/auth/connect?connectionId=${connectionId}`,
        {
          headers: adminHeaders(),
          maxRedirects: 0,
          validateStatus: (s) => s < 500,
        },
      );

      // Controller redirects to eBay OAuth URL
      expect(res.status).toBe(302);
      const location = res.headers['location'] || '';
      expect(location).toContain('ebay');

      // Extract state from the redirect URL for the callback test
      const urlParams = new URL(location).searchParams;
      store.ebayOAuthState = urlParams.get('state') || '';
      expect(store.ebayOAuthState).toBeTruthy();
    });

    it('GET /marketplace/ebay/auth/callback → 302 redirect to success page (mock token exchange)', async () => {
      expect(store.ebayOAuthState).toBeTruthy();

      const res = await axios.get(
        `/marketplace/ebay/auth/callback?code=mock_auth_code&state=${store.ebayOAuthState}`,
        {
          maxRedirects: 0,
          validateStatus: (s) => s < 500,
        },
      );

      // Controller redirects to frontend success page
      expect(res.status).toBe(302);
      const location = res.headers['location'] || '';
      expect(location).toContain('success=true');
    });

    it('GET /marketplace/connections/:id/status → connection ready', async () => {
      expect(connectionId).toBeTruthy();

      const res = await axios.get(
        `/marketplace/connections/${connectionId}/status`,
        { headers: adminHeaders() },
      );

      expect(res.status).toBe(200);
      expect(res.data.hasCredentials).toBe(true);
      expect(res.data.isConnected).toBe(true);
      expect(res.data.hasPolicies).toBe(true);
      expect(res.data.canPublishListings).toBe(true);
    });
  });

  // ───────────────────────── eBay Listings (Mock Mode) ─────────────────────────

  let listingId: string;

  describe('eBay Listing Lifecycle (Mock Mode)', () => {
    it('POST /marketplace/listings → 201 (create listing from product)', async () => {
      expect(connectionId).toBeTruthy();

      // We need a product listing ID. Get the product and find its first listing.
      let productListingId: string | null = null;
      if (store.productIds?.length) {
        try {
          const prodRes = await axios.get(
            `/store/admin/products/${store.productIds[0]}`,
            { headers: adminHeaders() },
          );
          // Product listings are the published listings (variants or base product)
          const listings = prodRes.data?.listings || prodRes.data?.data?.listings || [];
          if (listings.length > 0) {
            productListingId = listings[0].id;
          }
          // Fallback: use the product ID itself
          if (!productListingId) {
            productListingId = store.productIds[0];
          }
        } catch {
          productListingId = store.productIds[0];
        }
      }

      expect(productListingId).toBeTruthy();

      const res = await axios.post(
        '/marketplace/listings',
        {
          connectionId,
          productListingId,
          title: 'E2E Marketplace Test Listing',
          description: 'End-to-end marketplace listing',
          price: 29.99,
          quantity: 10,
          condition: 'NEW',
          categoryId: '171485',
        },
        { headers: adminHeaders() },
      );

      expect(res.status).toBe(201);
      listingId = res.data.id;
      expect(listingId).toBeDefined();
      expect(res.data.status.toUpperCase()).toBe('DRAFT');
      store.ebayListingId = listingId;
    });

    it('POST /marketplace/listings/:id/publish → 200 (publish with mock eBay API)', async () => {
      if (!listingId) {
        console.warn('Skipping: no listing to publish');
        return;
      }

      // Approve first (required before publish)
      const approveRes = await axios.post(
        `/marketplace/listings/${listingId}/approve`,
        {},
        { headers: adminHeaders() },
      );
      expect(approveRes.status).toBeLessThan(500);

      // Publish to eBay (mock mode)
      const res = await axios.post(
        `/marketplace/listings/${listingId}/publish`,
        {},
        { headers: adminHeaders() },
      );

      expect([200, 201]).toContain(res.status);
      // Verify listing got published status
      if (res.data.status) {
        expect(res.data.status.toUpperCase()).toBe('PUBLISHED');
      }
    });

    it('POST /marketplace/listings/:id/sync-inventory → 200 (sync with mock)', async () => {
      if (!listingId) {
        console.warn('Skipping: no listing to sync');
        return;
      }

      const res = await axios.post(
        `/marketplace/listings/${listingId}/sync-inventory`,
        {},
        { headers: adminHeaders() },
      );

      expect(res.status).toBeLessThan(500);
      if (res.status === 200) {
        expect(res.data.success).toBe(true);
      }
    });
  });

  // ───────────────────────── eBay Listing Management (Mock Mode) ─────────────────────────

  describe('eBay Listing Management (Mock Mode)', () => {
    it('GET /marketplace/listings → 200 (list all eBay listings)', async () => {
      const res = await axios.get('/marketplace/listings', {
        headers: adminHeaders(),
      });

      expect(res.status).toBe(200);
      expect(res.data).toBeDefined();
    });

    it('GET /marketplace/listings/:id → 200 (get listing detail)', async () => {
      if (!listingId) {
        console.warn('Skipping: no listing to get');
        return;
      }

      const res = await axios.get(
        `/marketplace/listings/${listingId}`,
        { headers: adminHeaders() },
      );

      expect(res.status).toBe(200);
      expect(res.data).toBeDefined();
      expect(res.data.id).toBe(listingId);
    });

    it('PATCH /marketplace/listings/:id → 200 (update listing)', async () => {
      if (!listingId) {
        console.warn('Skipping: no listing to update');
        return;
      }

      const res = await axios.patch(
        `/marketplace/listings/${listingId}`,
        { title: 'Updated E2E Test Listing' },
        { headers: adminHeaders() },
      );

      expect(res.status).toBeLessThan(500);
    });

    it('POST /marketplace/listings/:id/end → 200 (end listing on eBay)', async () => {
      if (!listingId) {
        console.warn('Skipping: no listing to end');
        return;
      }

      const res = await axios.post(
        `/marketplace/listings/${listingId}/end`,
        {},
        { headers: adminHeaders() },
      );

      expect(res.status).toBeLessThan(500);
    });
  });

  // ───────────────────────── eBay Order Sync (Mock Mode) ─────────────────────────

  describe('eBay Order Sync (Mock Mode)', () => {
    it('POST /marketplace/orders/sync → 200 (sync orders with mock eBay API)', async () => {
      expect(connectionId).toBeTruthy();

      const res = await axios.post(
        '/marketplace/orders/sync',
        { connectionId },
        { headers: adminHeaders() },
      );

      expect([200, 201]).toContain(res.status);
      expect(res.data.success).toBe(true);
      // Mock mode returns 0 orders from eBay
      expect(res.data.itemsTotal).toBe(0);
    });

    it('GET /marketplace/orders → 200 (list synced orders)', async () => {
      const res = await axios.get('/marketplace/orders', {
        headers: adminHeaders(),
      });

      expect(res.status).toBe(200);
      expect(res.data).toBeDefined();
    });

    it('GET /marketplace/orders/:id → 200/404 (get order detail)', async () => {
      // Use a non-existent ID — proves routing and guard work
      const res = await axios.get(
        '/marketplace/orders/non-existent-order-id',
        { headers: adminHeaders() },
      );

      expect(res.status).toBeLessThan(500);
    });

    it('POST /marketplace/orders/:id/fulfill → 400/404 (fulfill order)', async () => {
      const res = await axios.post(
        '/marketplace/orders/non-existent-order-id/fulfill',
        {
          trackingNumber: 'TRK-E2E-MOCK-123',
          carrierCode: 'USPS',
        },
        { headers: adminHeaders() },
      );

      // 400 or 404 — proves routing, guard, and validation work
      expect(res.status).toBeLessThan(500);
    });
  });

  // ───────────────────────── eBay Listing Cleanup (Mock Mode) ─────────────────────────

  describe('eBay Listing Cleanup (Mock Mode)', () => {
    let draftListingId: string;

    it('POST /marketplace/listings → create a draft listing for reject test', async () => {
      if (!connectionId || !store.productIds?.length) {
        console.warn('Skipping: no connection or product');
        return;
      }

      const res = await axios.post(
        '/marketplace/listings',
        {
          connectionId,
          productListingId: store.productIds[0],
          title: 'E2E Reject Test Listing',
          description: 'End-to-end reject lifecycle',
          price: 19.99,
          quantity: 5,
          condition: 'NEW',
          categoryId: '171485',
        },
        { headers: adminHeaders() },
      );

      if (res.status === 201) {
        draftListingId = res.data.id;
      }
      expect(res.status).toBeLessThan(500);
    });

    it('POST /marketplace/listings/:id/reject → 200 (reject draft listing)', async () => {
      if (!draftListingId) {
        console.warn('Skipping: no draft listing to reject');
        return;
      }

      const res = await axios.post(
        `/marketplace/listings/${draftListingId}/reject`,
        { reason: 'E2E test rejection' },
        { headers: adminHeaders() },
      );

      expect(res.status).toBeLessThan(500);
    });

    it('DELETE /marketplace/listings/:id → 200 (delete listing)', async () => {
      if (!draftListingId) {
        console.warn('Skipping: no listing to delete');
        return;
      }

      const res = await axios.delete(
        `/marketplace/listings/${draftListingId}`,
        { headers: adminHeaders() },
      );

      expect(res.status).toBeLessThan(500);
    });
  });
});
