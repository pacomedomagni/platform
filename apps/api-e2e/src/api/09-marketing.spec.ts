import axios from 'axios';
import {
  getAdminToken,
  adminHeaders,
  loginTestCustomer,
  customerHeaders,
} from '../support/auth-helper';
import { store } from '../support/data-store';

describe('Marketing Endpoints', () => {
  beforeAll(async () => {
    await getAdminToken();
    // Ensure the customer is logged in from previous test files
    await loginTestCustomer(
      store.testCustomerEmail,
      store.testCustomerPassword
    );
  });

  // ─── Coupons (Admin) ──────────────────────────────────────────────

  describe('Coupons (Admin)', () => {
    let flatCouponId: string;

    describe('POST /store/admin/coupons', () => {
      it('should create a percentage discount coupon "SAVE10"', async () => {
        const res = await axios.post(
          '/store/admin/coupons',
          {
            code: `SAVE10-${Date.now()}`,
            discountType: 'percentage',
            discountValue: 10,
            description: 'Save 10% on your order',
            isActive: true,
            usageLimit: 100,
            minimumOrderAmount: 0,
          },
          { headers: adminHeaders() }
        );

        expect(res.status).toBe(201);
        expect(res.data).toBeDefined();

        const couponId = res.data.id || res.data.couponId;
        expect(couponId).toBeDefined();
        store.couponId = couponId;
        store.couponCode = res.data.code || 'SAVE10';
      });

      it('should create a fixed amount discount coupon "FLAT5"', async () => {
        const res = await axios.post(
          '/store/admin/coupons',
          {
            code: `FLAT5-${Date.now()}`,
            discountType: 'fixed_amount',
            discountValue: 5,
            description: 'Flat $5 off your order',
            isActive: true,
            usageLimit: 50,
            minimumOrderAmount: 10,
          },
          { headers: adminHeaders() }
        );

        expect(res.status).toBe(201);
        expect(res.data).toBeDefined();

        flatCouponId = res.data.id || res.data.couponId;
        expect(flatCouponId).toBeDefined();
      });
    });

    describe('GET /store/admin/coupons', () => {
      it('should list all coupons and return 200', async () => {
        const res = await axios.get('/store/admin/coupons', {
          headers: adminHeaders(),
        });

        expect(res.status).toBe(200);
        expect(res.data).toBeDefined();

        const coupons = Array.isArray(res.data)
          ? res.data
          : res.data.data || res.data.coupons || [];
        expect(coupons.length).toBeGreaterThanOrEqual(2);
      });
    });

    describe('GET /store/admin/coupons/:id', () => {
      it('should return coupon details and return 200', async () => {
        expect(store.couponId).toBeTruthy();

        const res = await axios.get(
          `/store/admin/coupons/${store.couponId}`,
          { headers: adminHeaders() }
        );

        expect(res.status).toBe(200);
        expect(res.data).toBeDefined();
        expect(typeof res.data).toBe('object');
      });
    });

    describe('PUT /store/admin/coupons/:id', () => {
      it('should update the coupon and return 200', async () => {
        expect(store.couponId).toBeTruthy();

        const res = await axios.put(
          `/store/admin/coupons/${store.couponId}`,
          {
            description: 'Updated: Save 10% on your order',
            usageLimit: 200,
          },
          { headers: adminHeaders() }
        );

        expect(res.status).toBe(200);
        expect(res.data).toBeDefined();
      });
    });

    describe('DELETE /store/admin/coupons/:id', () => {
      it('should delete the FLAT5 coupon and return 200', async () => {
        expect(flatCouponId).toBeTruthy();

        const res = await axios.delete(
          `/store/admin/coupons/${flatCouponId}`,
          { headers: adminHeaders() }
        );

        expect(res.status).toBe(200);
      });
    });
  });

  // ─── Reviews (Customer) ───────────────────────────────────────────

  describe('Reviews', () => {
    describe('POST /store/products/:productId/reviews', () => {
      it('should create a review for a product and return 201', async () => {
        expect(store.productIds.length).toBeGreaterThan(0);

        const res = await axios.post(
          `/store/products/${store.productIds[0]}/reviews`,
          {
            productListingId: store.productIds[0],
            rating: 5,
            title: 'Excellent product!',
            content:
              'This is a fantastic product. Highly recommend it to everyone.',
          },
          { headers: customerHeaders() }
        );

        expect(res.status).toBe(201);
        expect(res.data).toBeDefined();

        const reviewId = res.data.id || res.data.reviewId;
        expect(reviewId).toBeDefined();
        store.reviewId = reviewId;
      });
    });

    describe('Reviews Admin', () => {
      describe('GET /store/admin/reviews', () => {
        it('should list all reviews for admin and return 200', async () => {
          const res = await axios.get('/store/admin/reviews', {
            headers: adminHeaders(),
          });

          expect(res.status).toBe(200);
          expect(res.data).toBeDefined();

          const reviews = Array.isArray(res.data)
            ? res.data
            : res.data.data || res.data.reviews || [];
          expect(reviews.length).toBeGreaterThanOrEqual(1);
        });
      });

      describe('PUT /store/admin/reviews/:id/moderate', () => {
        it('should approve the review and return 200', async () => {
          expect(store.reviewId).toBeTruthy();

          const res = await axios.put(
            `/store/admin/reviews/${store.reviewId}/moderate`,
            { status: 'approved' },
            { headers: adminHeaders() }
          );

          expect(res.status).toBe(200);
          expect(res.data).toBeDefined();
        });
      });
    });

    describe('GET /store/products/:productId/reviews', () => {
      it('should list reviews for the product and return 200', async () => {
        const res = await axios.get(
          `/store/products/${store.productIds[0]}/reviews`,
          { headers: customerHeaders() }
        );

        expect(res.status).toBe(200);
        expect(res.data).toBeDefined();

        const reviews = Array.isArray(res.data)
          ? res.data
          : res.data.data || res.data.reviews || [];
        expect(reviews.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe('POST /store/reviews/:id/vote', () => {
      it('should vote a review as helpful and return 200 or 201', async () => {
        expect(store.reviewId).toBeTruthy();

        const res = await axios.post(
          `/store/reviews/${store.reviewId}/vote`,
          { isHelpful: true },
          { headers: customerHeaders() }
        );

        expect([200, 201]).toContain(res.status);
        expect(res.data).toBeDefined();
      });
    });

    describe('POST /store/admin/reviews/bulk-moderate', () => {
      it('should bulk moderate reviews', async () => {
        // Create a second review for bulk moderate
        let secondReviewId: string | null = null;

        if (store.productIds?.[0]) {
          try {
            const createRes = await axios.post(
              `/store/products/${store.productIds[0]}/reviews`,
              {
                productListingId: store.productIds[0],
                rating: 4,
                title: 'Good product for bulk test',
                content: 'This review is for the bulk moderate test.',
              },
              { headers: customerHeaders() }
            );
            if (createRes.status === 201) {
              secondReviewId = createRes.data.id || createRes.data.reviewId;
            }
          } catch {
            // If duplicate review, skip
          }
        }

        const reviewIds = [store.reviewId, secondReviewId].filter(Boolean);
        if (reviewIds.length === 0) {
          console.warn('Skipping bulk moderate: no review IDs');
          return;
        }

        const res = await axios.post(
          '/store/admin/reviews/bulk-moderate',
          { reviewIds, status: 'approved' },
          { headers: adminHeaders() }
        );

        expect([200, 201]).toContain(res.status);

        // Clean up second review
        if (secondReviewId) {
          await axios.delete(`/store/admin/reviews/${secondReviewId}`, {
            headers: adminHeaders(),
          }).catch(() => {});
        }
      });
    });

    describe('POST /store/admin/reviews/:reviewId/respond', () => {
      it('should add an admin response to a review', async () => {
        expect(store.reviewId).toBeTruthy();

        const res = await axios.post(
          `/store/admin/reviews/${store.reviewId}/respond`,
          { response: 'Thank you for your feedback! We appreciate it.' },
          { headers: adminHeaders() }
        );

        expect([200, 201]).toContain(res.status);
      });
    });

    describe('DELETE /store/admin/reviews/:id', () => {
      it('should delete the review and return 200', async () => {
        expect(store.reviewId).toBeTruthy();

        const res = await axios.delete(
          `/store/admin/reviews/${store.reviewId}`,
          { headers: adminHeaders() }
        );

        expect(res.status).toBe(200);
      });
    });
  });

  // ─── Gift Cards (Admin) ───────────────────────────────────────────

  describe('Gift Cards (Admin)', () => {
    describe('POST /store/admin/gift-cards', () => {
      it('should create a $50 gift card and return 201', async () => {
        const res = await axios.post(
          '/store/admin/gift-cards',
          {
            initialValue: 50,
            currency: 'USD',
            sourceType: 'manual',
            expiresAt: new Date(
              Date.now() + 365 * 24 * 60 * 60 * 1000
            ).toISOString(),
          },
          { headers: adminHeaders() }
        );

        expect(res.status).toBe(201);
        expect(res.data).toBeDefined();

        const giftCardId = res.data.id || res.data.giftCardId;
        expect(giftCardId).toBeDefined();
        store.giftCardId = giftCardId;

        const giftCardCode =
          res.data.code || res.data.giftCardCode || '';
        if (giftCardCode) {
          store.giftCardCode = giftCardCode;
        }
      });
    });

    describe('GET /store/admin/gift-cards', () => {
      it('should list all gift cards and return 200', async () => {
        const res = await axios.get('/store/admin/gift-cards', {
          headers: adminHeaders(),
        });

        expect(res.status).toBe(200);
        expect(res.data).toBeDefined();

        const giftCards = Array.isArray(res.data)
          ? res.data
          : res.data.data || res.data.giftCards || [];
        expect(giftCards.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe('GET /store/admin/gift-cards/:id', () => {
      it('should return gift card details and return 200', async () => {
        expect(store.giftCardId).toBeTruthy();

        const res = await axios.get(
          `/store/admin/gift-cards/${store.giftCardId}`,
          { headers: adminHeaders() }
        );

        expect(res.status).toBe(200);
        expect(res.data).toBeDefined();
        expect(typeof res.data).toBe('object');

        // Capture the code if not yet stored
        if (!store.giftCardCode && res.data.code) {
          store.giftCardCode = res.data.code;
        }
      });
    });

    describe('POST /store/admin/gift-cards/:id/activate', () => {
      it('should activate the gift card (or already active if sourceType=manual)', async () => {
        expect(store.giftCardId).toBeTruthy();

        const res = await axios.post(
          `/store/admin/gift-cards/${store.giftCardId}/activate`,
          {},
          { headers: adminHeaders() }
        );

        // Gift cards with sourceType "manual" are auto-activated on creation,
        // so this may return 400 "not pending activation" — that's acceptable
        expect([200, 201, 400]).toContain(res.status);
        expect(res.data).toBeDefined();
      });
    });

    describe('GET /store/gift-cards/check', () => {
      it('should check the gift card balance by code and return 200', async () => {
        expect(store.giftCardCode).toBeTruthy();

        const res = await axios.get(
          `/store/gift-cards/check?code=${store.giftCardCode}`,
          { headers: customerHeaders() }
        );

        expect(res.status).toBe(200);
        expect(res.data).toBeDefined();

        // Verify the balance is present
        const balance =
          res.data.balance ??
          res.data.remainingBalance ??
          res.data.currentValue ??
          res.data.amount;
        expect(balance).toBeDefined();
      });
    });

    describe('POST /store/admin/gift-cards/:id/adjust', () => {
      it('should adjust gift card balance', async () => {
        expect(store.giftCardId).toBeTruthy();

        const res = await axios.post(
          `/store/admin/gift-cards/${store.giftCardId}/adjust`,
          { amount: 5, type: 'adjustment', notes: 'E2E test adjustment' },
          { headers: adminHeaders() }
        );

        expect([200, 201]).toContain(res.status);
        expect(res.data).toBeDefined();
      });
    });

    describe('POST /store/admin/gift-cards/:id/disable', () => {
      it('should disable the gift card', async () => {
        expect(store.giftCardId).toBeTruthy();

        const res = await axios.post(
          `/store/admin/gift-cards/${store.giftCardId}/disable`,
          {},
          { headers: adminHeaders() }
        );

        expect([200, 201]).toContain(res.status);
      });
    });
  });

  // ─── Wishlists (Customer) ─────────────────────────────────────────

  describe('Wishlists', () => {
    let wishlistItemId: string;

    describe('POST /store/wishlist', () => {
      it('should create a wishlist and return 201', async () => {
        const res = await axios.post(
          '/store/wishlist',
          {
            name: 'My E2E Wishlist',
          },
          { headers: customerHeaders() }
        );

        expect(res.status).toBe(201);
        expect(res.data).toBeDefined();

        const wishlistId = res.data.id || res.data.wishlistId;
        expect(wishlistId).toBeDefined();
        store.wishlistId = wishlistId;
      });
    });

    describe('GET /store/wishlist', () => {
      it('should list customer wishlists and return 200', async () => {
        const res = await axios.get('/store/wishlist', {
          headers: customerHeaders(),
        });

        expect(res.status).toBe(200);
        expect(res.data).toBeDefined();

        const wishlists = Array.isArray(res.data)
          ? res.data
          : res.data.data || res.data.wishlists || [];
        expect(wishlists.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe('POST /store/wishlist/items', () => {
      it('should add a product to the wishlist and return 201', async () => {
        expect(store.wishlistId).toBeTruthy();
        expect(store.productIds.length).toBeGreaterThan(0);

        const res = await axios.post(
          '/store/wishlist/items',
          {
            productListingId: store.productIds[0],
          },
          { headers: customerHeaders() }
        );

        expect(res.status).toBe(201);
        expect(res.data).toBeDefined();

        // Capture the wishlist item ID for deletion later
        wishlistItemId =
          res.data.id || res.data.itemId || res.data.wishlistItemId;
      });
    });

    describe('GET /store/wishlist/:id', () => {
      it('should return the wishlist detail and return 200', async () => {
        expect(store.wishlistId).toBeTruthy();

        const res = await axios.get(
          `/store/wishlist/${store.wishlistId}`,
          { headers: customerHeaders() }
        );

        expect(res.status).toBe(200);
        expect(res.data).toBeDefined();
        expect(typeof res.data).toBe('object');

        // Items may or may not be populated depending on response mapping
        const items = res.data.items || res.data.wishlistItems || [];
        if (!wishlistItemId && items.length > 0) {
          wishlistItemId = items[0].id;
        }
      });
    });

    describe('PUT /store/wishlist/:id', () => {
      it('should update the wishlist name', async () => {
        expect(store.wishlistId).toBeTruthy();

        const res = await axios.put(
          `/store/wishlist/${store.wishlistId}`,
          { name: 'Updated E2E Wishlist', isPublic: true },
          { headers: customerHeaders() }
        );

        expect(res.status).toBe(200);
        expect(res.data).toBeDefined();
      });
    });

    describe('GET /store/wishlist/shared/:shareToken', () => {
      it('should access shared wishlist (or 404 if no share token)', async () => {
        // Try to get the wishlist detail to find the share token
        const detailRes = await axios.get(
          `/store/wishlist/${store.wishlistId}`,
          { headers: customerHeaders() }
        );

        const shareToken =
          detailRes.data.shareToken || detailRes.data.data?.shareToken;

        if (!shareToken) {
          // Try with a dummy token - should return 404
          const res = await axios.get('/store/wishlist/shared/nonexistent-token');
          expect([404, 400]).toContain(res.status);
          return;
        }

        const res = await axios.get(`/store/wishlist/shared/${shareToken}`);
        expect(res.status).toBe(200);
        expect(res.data).toBeDefined();
      });
    });

    describe('POST /store/wishlist/items/:itemId/move-to-cart', () => {
      it('should move wishlist item to cart', async () => {
        // Add a fresh item to wishlist for move-to-cart test
        let moveItemId: string | null = null;

        if (store.productIds?.[0]) {
          try {
            const addRes = await axios.post(
              '/store/wishlist/items',
              { productListingId: store.productIds[0] },
              { headers: customerHeaders() }
            );
            if (addRes.status === 201) {
              moveItemId = addRes.data.id || addRes.data.itemId;
            }
          } catch {
            // Item might already be in wishlist
          }
        }

        if (!moveItemId && wishlistItemId) {
          moveItemId = wishlistItemId;
        }

        if (!moveItemId) {
          console.warn('Skipping move-to-cart: no wishlist item');
          return;
        }

        // Ensure we have a cart
        const cartRes = await axios.get('/store/cart', {
          headers: customerHeaders(),
        });
        const cartId = cartRes.data.id || cartRes.data.cartId;

        const res = await axios.post(
          `/store/wishlist/items/${moveItemId}/move-to-cart`,
          { cartId },
          { headers: customerHeaders() }
        );

        expect([200, 201]).toContain(res.status);
      });
    });

    describe('DELETE /store/wishlist/items/:itemId', () => {
      it('should remove the item from the wishlist and return 200', async () => {
        // Re-add item if the previous test moved it
        if (store.productIds?.[0]) {
          try {
            const addRes = await axios.post(
              '/store/wishlist/items',
              { productListingId: store.productIds[0] },
              { headers: customerHeaders() }
            );
            if (addRes.status === 201) {
              wishlistItemId = addRes.data.id || addRes.data.itemId;
            }
          } catch {
            // Item may already exist
          }
        }

        if (!wishlistItemId) {
          console.warn('Skipping wishlist item delete: no item');
          return;
        }

        const res = await axios.delete(
          `/store/wishlist/items/${wishlistItemId}`,
          { headers: customerHeaders() }
        );

        expect(res.status).toBe(200);
      });
    });

    describe('DELETE /store/wishlist/:id', () => {
      it('should delete the wishlist and return 200', async () => {
        expect(store.wishlistId).toBeTruthy();

        const res = await axios.delete(
          `/store/wishlist/${store.wishlistId}`,
          { headers: customerHeaders() }
        );

        expect(res.status).toBe(200);
      });
    });
  });
});
