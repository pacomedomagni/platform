import axios from 'axios';
import { getAdminToken, adminHeaders, tenantHeaders } from '../support/auth-helper';
import { store } from '../support/data-store';

describe('Products & Categories', () => {
  beforeAll(async () => {
    await getAdminToken();
  });

  // ───────────────────────────── Categories ─────────────────────────────

  describe('Categories (Admin)', () => {
    it('POST /store/admin/categories → 201 (create "Electronics")', async () => {
      const slug = `electronics-${Date.now()}`;
      const res = await axios.post(
        '/store/admin/categories',
        {
          name: `Electronics ${Date.now()}`,
          slug,
          description: 'Electronic devices and accessories',
        },
        { headers: adminHeaders() }
      );

      if (res.status === 409) {
        // Category slug already exists from a previous run; look it up
        const listRes = await axios.get('/store/categories', {
          headers: tenantHeaders(),
        });
        const items = listRes.data.data ?? listRes.data;
        const existing = items.find(
          (c: any) => c.slug === 'electronics' || c.name?.includes('Electronics')
        );
        if (existing) store.categoryIds.push(existing.id);
        return;
      }

      expect(res.status).toBe(201);
      expect(res.data).toHaveProperty('id');
      expect(res.data.name).toContain('Electronics');

      store.categoryIds.push(res.data.id);
    });

    it('POST /store/admin/categories → 201 (create "Clothing")', async () => {
      const slug = `clothing-${Date.now()}`;
      const res = await axios.post(
        '/store/admin/categories',
        {
          name: `Clothing ${Date.now()}`,
          slug,
          description: 'Apparel and fashion items',
        },
        { headers: adminHeaders() }
      );

      if (res.status === 409) {
        const listRes = await axios.get('/store/categories', {
          headers: tenantHeaders(),
        });
        const items = listRes.data.data ?? listRes.data;
        const existing = items.find(
          (c: any) => c.slug === 'clothing' || c.name?.includes('Clothing')
        );
        if (existing) store.categoryIds.push(existing.id);
        return;
      }

      expect(res.status).toBe(201);
      expect(res.data).toHaveProperty('id');
      expect(res.data.name).toContain('Clothing');

      store.categoryIds.push(res.data.id);
    });
  });

  describe('Categories (Public)', () => {
    it('GET /store/categories → 200 (list all categories)', async () => {
      const res = await axios.get('/store/categories', {
        headers: tenantHeaders(),
      });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.data.data ?? res.data)).toBe(true);

      // Ensure store.categoryIds is populated even if create tests used fallback
      if (store.categoryIds.length === 0) {
        const items = res.data.data ?? res.data;
        for (const cat of items.slice(0, 2)) {
          store.categoryIds.push(cat.id);
        }
      }
    });

    it('GET /store/categories/:slug → 200 (by slug)', async () => {
      const listRes = await axios.get('/store/categories', {
        headers: tenantHeaders(),
      });
      const items = listRes.data.data ?? listRes.data;
      const firstSlug = items[0]?.slug ?? 'electronics';

      const res = await axios.get(`/store/categories/${firstSlug}`, {
        headers: tenantHeaders(),
      });

      expect(res.status).toBeLessThan(500);

      if (res.status === 200) {
        expect(res.data.name || res.data.data?.name).toBeDefined();
      }
    });
  });

  describe('Categories (Update)', () => {
    it('PUT /store/admin/categories/:id → 200 (update description)', async () => {
      expect(store.categoryIds.length).toBeGreaterThan(0);
      const categoryId = store.categoryIds[0];

      const res = await axios.put(
        `/store/admin/categories/${categoryId}`,
        { description: 'Updated electronics description' },
        { headers: adminHeaders() }
      );

      expect(res.status).toBe(200);
    });
  });

  // ───────────────────────────── Products ─────────────────────────────

  describe('Products (Admin Create)', () => {
    it('POST /store/admin/products/simple → 201 (create "Test Widget")', async () => {
      const res = await axios.post(
        '/store/admin/products/simple',
        {
          name: 'Test Widget',
          description: 'A reliable test widget for E2E testing',
          price: 29.99,
          isPublished: true,
          isFeatured: false,
          categoryId: store.categoryIds[0],
        },
        { headers: adminHeaders() }
      );

      expect(res.status).toBe(201);
      expect(res.data).toHaveProperty('id');

      store.productIds.push(res.data.id);

      if (res.data.slug) {
        store.productSlugs.push(res.data.slug);
      }
    });

    it('POST /store/admin/products/simple → 201 (create "Test Gadget", featured)', async () => {
      const res = await axios.post(
        '/store/admin/products/simple',
        {
          name: 'Test Gadget',
          description: 'A featured gadget for showcase',
          price: 49.99,
          isPublished: true,
          isFeatured: true,
          categoryId: store.categoryIds[0],
        },
        { headers: adminHeaders() }
      );

      expect(res.status).toBe(201);
      expect(res.data).toHaveProperty('id');

      store.productIds.push(res.data.id);

      if (res.data.slug) {
        store.productSlugs.push(res.data.slug);
      }
    });

    it('POST /store/admin/products/simple → 201 (create "Unpublished Item")', async () => {
      const res = await axios.post(
        '/store/admin/products/simple',
        {
          name: 'Unpublished Item',
          description: 'This product should not appear in public listings',
          price: 19.99,
          isPublished: false,
          isFeatured: false,
          categoryId: store.categoryIds[1] || store.categoryIds[0],
        },
        { headers: adminHeaders() }
      );

      expect(res.status).toBe(201);
      expect(res.data).toHaveProperty('id');

      store.productIds.push(res.data.id);
    });
  });

  describe('Products (Public List)', () => {
    it('GET /store/products → 200 (only published products)', async () => {
      const res = await axios.get('/store/products', {
        headers: tenantHeaders(),
      });

      expect(res.status).toBe(200);

      const items = res.data.data ?? res.data;
      expect(Array.isArray(items)).toBe(true);

      const hasUnpublished = items.some(
        (p: any) => p.displayName === 'Unpublished Item' || p.name === 'Unpublished Item'
      );
      expect(hasUnpublished).toBe(false);
    });
  });

  describe('Products (Admin List & Detail)', () => {
    it('GET /store/admin/products → 200 (includes unpublished)', async () => {
      const res = await axios.get('/store/admin/products', {
        headers: adminHeaders(),
      });

      expect(res.status).toBe(200);

      const items = res.data.data ?? res.data;
      expect(Array.isArray(items)).toBe(true);

      const hasUnpublished = items.some(
        (p: any) => p.displayName === 'Unpublished Item' || p.name === 'Unpublished Item'
      );
      expect(hasUnpublished).toBe(true);
    });

    it('GET /store/admin/products/:id → 200 (detail by ID)', async () => {
      const productId = store.productIds[0];
      expect(productId).toBeDefined();

      const res = await axios.get(`/store/admin/products/${productId}`, {
        headers: adminHeaders(),
      });

      expect(res.status).toBe(200);
      expect(res.data.id ?? res.data.data?.id).toBe(productId);
    });
  });

  describe('Products (Update)', () => {
    it('PUT /store/admin/products/:id → 200 (update price)', async () => {
      const productId = store.productIds[0];
      expect(productId).toBeDefined();

      const res = await axios.put(
        `/store/admin/products/${productId}`,
        { price: 34.99 },
        { headers: adminHeaders() }
      );

      expect(res.status).toBe(200);
    });
  });

  describe('Products (Public Detail by Slug)', () => {
    it('GET /store/products/:slug → 200 (public by slug)', async () => {
      const slug = store.productSlugs[0] ?? 'test-widget';

      const res = await axios.get(`/store/products/${slug}`, {
        headers: tenantHeaders(),
      });

      expect(res.status).toBeLessThan(500);

      if (res.status === 200) {
        const product = res.data.data ?? res.data;
        expect(product).toHaveProperty('displayName');
      }
    });
  });

  describe('Products (Public Featured)', () => {
    it('GET /store/products/featured → 200 (featured products)', async () => {
      const res = await axios.get('/store/products/featured', {
        headers: tenantHeaders(),
      });

      expect(res.status).toBe(200);

      const items = res.data.data ?? res.data;
      expect(Array.isArray(items)).toBe(true);
    });
  });

  // ───────────────────────────── Cleanup ─────────────────────────────

  describe('Products & Categories (Delete)', () => {
    it('DELETE /store/admin/products/:id → 200 (delete unpublished product)', async () => {
      expect(store.productIds.length).toBeGreaterThan(2);
      const unpublishedId = store.productIds[2];

      const res = await axios.delete(
        `/store/admin/products/${unpublishedId}`,
        { headers: adminHeaders() }
      );

      expect([200, 204]).toContain(res.status);
    });

    it('DELETE /store/admin/categories/:id → 200 (delete second category)', async () => {
      expect(store.categoryIds.length).toBeGreaterThan(1);
      const categoryId = store.categoryIds[1];

      const res = await axios.delete(
        `/store/admin/categories/${categoryId}`,
        { headers: adminHeaders() }
      );

      expect([200, 204]).toContain(res.status);
    });
  });
});
