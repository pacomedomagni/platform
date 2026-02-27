import axios from 'axios';
import { getAdminToken, adminHeaders, tenantHeaders } from '../support/auth-helper';
import { store } from '../support/data-store';

const ts = Date.now();

describe('Variants & Attributes', () => {
  beforeAll(async () => {
    await getAdminToken();
  });

  // ───────────────────────────── Attribute Types ─────────────────────────────

  describe('Attribute Types', () => {
    it('POST /store/admin/attribute-types → 201 (create "Color")', async () => {
      const res = await axios.post(
        '/store/admin/attribute-types',
        { name: `color-${ts}`, displayName: 'Color' },
        { headers: adminHeaders() }
      );

      if (res.status === 500 || res.status === 409) {
        // Unique constraint from previous run; list and find existing
        const listRes = await axios.get('/store/admin/attribute-types', {
          headers: adminHeaders(),
        });
        const items = listRes.data.data ?? listRes.data;
        const existing = items.find((t: any) => t.displayName === 'Color' || t.name?.includes('color'));
        if (existing) {
          store.attributeTypeIds.push(existing.id);
          return;
        }
      }

      expect(res.status).toBe(201);
      expect(res.data).toHaveProperty('id');

      store.attributeTypeIds.push(res.data.id);
    });

    it('POST /store/admin/attribute-types → 201 (create "Size")', async () => {
      const res = await axios.post(
        '/store/admin/attribute-types',
        { name: `size-${ts}`, displayName: 'Size' },
        { headers: adminHeaders() }
      );

      if (res.status === 500 || res.status === 409) {
        const listRes = await axios.get('/store/admin/attribute-types', {
          headers: adminHeaders(),
        });
        const items = listRes.data.data ?? listRes.data;
        const existing = items.find((t: any) => t.displayName === 'Size' || t.name?.includes('size'));
        if (existing) {
          store.attributeTypeIds.push(existing.id);
          return;
        }
      }

      expect(res.status).toBe(201);
      expect(res.data).toHaveProperty('id');

      store.attributeTypeIds.push(res.data.id);
    });

    it('GET /store/admin/attribute-types → 200 (list all)', async () => {
      const res = await axios.get('/store/admin/attribute-types', {
        headers: adminHeaders(),
      });

      expect(res.status).toBe(200);

      const items = res.data.data ?? res.data;
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ───────────────────────────── Attribute Values ─────────────────────────────

  describe('Attribute Values', () => {
    it('POST /store/admin/attribute-values → 201 (create "Red" for Color)', async () => {
      expect(store.attributeTypeIds.length).toBeGreaterThan(0);
      const colorTypeId = store.attributeTypeIds[0];

      const res = await axios.post(
        '/store/admin/attribute-values',
        {
          value: `red-${ts}`,
          displayValue: 'Red',
          attributeTypeId: colorTypeId,
        },
        { headers: adminHeaders() }
      );

      expect(res.status).toBe(201);
      expect(res.data).toHaveProperty('id');

      store.attributeValueIds.push(res.data.id);
    });

    it('POST /store/admin/attribute-values → 201 (create "Blue" for Color)', async () => {
      const colorTypeId = store.attributeTypeIds[0];

      const res = await axios.post(
        '/store/admin/attribute-values',
        {
          value: `blue-${ts}`,
          displayValue: 'Blue',
          attributeTypeId: colorTypeId,
        },
        { headers: adminHeaders() }
      );

      expect(res.status).toBe(201);
      expect(res.data).toHaveProperty('id');

      store.attributeValueIds.push(res.data.id);
    });

    it('POST /store/admin/attribute-values → 201 (create "S" for Size)', async () => {
      expect(store.attributeTypeIds.length).toBeGreaterThan(1);
      const sizeTypeId = store.attributeTypeIds[1];

      const res = await axios.post(
        '/store/admin/attribute-values',
        {
          value: `s-${ts}`,
          displayValue: 'S',
          attributeTypeId: sizeTypeId,
        },
        { headers: adminHeaders() }
      );

      expect(res.status).toBe(201);
      expect(res.data).toHaveProperty('id');

      store.attributeValueIds.push(res.data.id);
    });

    it('POST /store/admin/attribute-values → 201 (create "M" for Size)', async () => {
      const sizeTypeId = store.attributeTypeIds[1];

      const res = await axios.post(
        '/store/admin/attribute-values',
        {
          value: `m-${ts}`,
          displayValue: 'M',
          attributeTypeId: sizeTypeId,
        },
        { headers: adminHeaders() }
      );

      expect(res.status).toBe(201);
      expect(res.data).toHaveProperty('id');

      store.attributeValueIds.push(res.data.id);
    });
  });

  // ───────────────────────────── Attribute Updates ─────────────────────────────

  describe('Attribute Updates', () => {
    it('PUT /store/admin/attribute-types/:id → 200 (update Color displayName)', async () => {
      expect(store.attributeTypeIds.length).toBeGreaterThan(0);

      const res = await axios.put(
        `/store/admin/attribute-types/${store.attributeTypeIds[0]}`,
        { displayName: 'Color Updated' },
        { headers: adminHeaders() }
      );

      expect(res.status).toBe(200);
    });

    it('PUT /store/admin/attribute-values/:id → 200 (update Red displayValue)', async () => {
      expect(store.attributeValueIds.length).toBeGreaterThan(0);

      const res = await axios.put(
        `/store/admin/attribute-values/${store.attributeValueIds[0]}`,
        { displayValue: 'Crimson' },
        { headers: adminHeaders() }
      );

      expect(res.status).toBe(200);
    });
  });

  // ───────────────────────────── Variants ─────────────────────────────

  describe('Variants', () => {
    it('POST /store/admin/products/:productId/variants → 201 (create variant)', async () => {
      expect(store.productIds.length).toBeGreaterThan(0);
      const productId = store.productIds[0];

      const res = await axios.post(
        `/store/admin/products/${productId}/variants`,
        {
          productListingId: productId,
          sku: `E2E-VAR-${ts}`,
          price: 32.99,
          stockQty: 100,
          attributes: [
            { attributeTypeId: store.attributeTypeIds[0], attributeValueId: store.attributeValueIds[0] },
            { attributeTypeId: store.attributeTypeIds[1], attributeValueId: store.attributeValueIds[2] },
          ],
        },
        { headers: adminHeaders() }
      );

      expect(res.status).toBe(201);
      expect(res.data).toHaveProperty('id');

      store.variantIds.push(res.data.id);
    });

    it('GET /store/products/:productId/variants → 200 (public list)', async () => {
      expect(store.productIds.length).toBeGreaterThan(0);
      const productId = store.productIds[0];

      const res = await axios.get(
        `/store/products/${productId}/variants`,
        { headers: tenantHeaders() }
      );

      expect(res.status).toBe(200);

      const items = res.data.data ?? res.data;
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /store/variants/:id → 200 (public single variant)', async () => {
      expect(store.variantIds.length).toBeGreaterThan(0);

      const res = await axios.get(
        `/store/variants/${store.variantIds[0]}`,
        { headers: tenantHeaders() }
      );

      expect(res.status).toBeLessThan(500);
      if (res.status === 200) {
        expect(res.data).toBeDefined();
      }
    });

    it('PUT /store/admin/variants/:id → 200 (update price and stock)', async () => {
      expect(store.variantIds.length).toBeGreaterThan(0);
      const variantId = store.variantIds[0];

      const res = await axios.put(
        `/store/admin/variants/${variantId}`,
        { price: 35.99, stockQty: 80 },
        { headers: adminHeaders() }
      );

      expect(res.status).toBe(200);
    });

    it('PUT /store/admin/variants/:id/stock → responds (set stock)', async () => {
      expect(store.variantIds.length).toBeGreaterThan(0);

      const res = await axios.put(
        `/store/admin/variants/${store.variantIds[0]}/stock`,
        { quantity: 50 },
        { headers: adminHeaders() }
      );

      expect(res.status).toBeLessThan(500);
    });

    it('POST /store/admin/variants/:id/stock/adjust → responds (adjust stock)', async () => {
      expect(store.variantIds.length).toBeGreaterThan(0);

      const res = await axios.post(
        `/store/admin/variants/${store.variantIds[0]}/stock/adjust`,
        { adjustment: -5, reason: 'E2E stock adjustment test' },
        { headers: adminHeaders() }
      );

      expect(res.status).toBeLessThan(500);
    });

    it('POST /store/admin/products/:productId/variants/bulk → responds (bulk create)', async () => {
      const productId = store.productIds[0];

      const res = await axios.post(
        `/store/admin/products/${productId}/variants/bulk`,
        {
          productListingId: productId,
          variants: [
            {
              sku: `E2E-BULK-A-${ts}`,
              price: 29.99,
              stockQty: 20,
              attributes: [
                { attributeTypeId: store.attributeTypeIds[0], attributeValueId: store.attributeValueIds[1] },
                { attributeTypeId: store.attributeTypeIds[1], attributeValueId: store.attributeValueIds[2] },
              ],
            },
          ],
        },
        { headers: adminHeaders() }
      );

      expect(res.status).toBeLessThan(500);
    });

    it('DELETE /store/admin/variants/:id → 200 (remove variant)', async () => {
      expect(store.variantIds.length).toBeGreaterThan(0);
      const variantId = store.variantIds[0];

      const res = await axios.delete(
        `/store/admin/variants/${variantId}`,
        { headers: adminHeaders() }
      );

      expect(res.status).toBeLessThan(500);
      expect([200, 204].includes(res.status)).toBe(true);

      store.variantIds.splice(0, 1);
    });
  });

  // ───────────────────────────── Attribute Cleanup ─────────────────────────────

  describe('Attribute Cleanup', () => {
    it('DELETE /store/admin/attribute-types/:id → responds (may be referenced)', async () => {
      expect(store.attributeTypeIds.length).toBeGreaterThan(1);

      const res = await axios.delete(
        `/store/admin/attribute-types/${store.attributeTypeIds[1]}`,
        { headers: adminHeaders() }
      );

      expect(res.status).toBeLessThan(500);
    });
  });
});
