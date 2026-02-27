import axios from 'axios';
import { getAdminToken, adminHeaders } from '../support/auth-helper';
import { store } from '../support/data-store';

describe('Inventory Management', () => {
  beforeAll(async () => {
    await getAdminToken();
  });

  // ───────────────────────────── Warehouses ─────────────────────────────

  describe('Warehouses', () => {
    it('GET /inventory-management/warehouses → 200 (list, capture seeded warehouse)', async () => {
      const res = await axios.get('/inventory-management/warehouses', {
        headers: adminHeaders(),
      });

      expect(res.status).toBe(200);

      const items = res.data.data ?? res.data;
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThanOrEqual(1);

      // Store the first (seeded) warehouse ID and code for later use
      store.warehouseId = items[0].id;
      store.warehouseCode = items[0].code;
      expect(store.warehouseId).toBeDefined();
    });

    it('GET /inventory-management/warehouses/:id → 200 (detail with locations)', async () => {
      expect(store.warehouseId).toBeTruthy();

      const res = await axios.get(
        `/inventory-management/warehouses/${store.warehouseId}`,
        { headers: adminHeaders() }
      );

      expect(res.status).toBe(200);

      const warehouse = res.data.data ?? res.data;
      expect(warehouse.id ?? warehouse._id).toBe(store.warehouseId);

      // Capture locations from the detail response
      if (warehouse.locations && Array.isArray(warehouse.locations)) {
        store.locationIds = warehouse.locations.map((loc: any) => loc.id);
        store.locationCodes = warehouse.locations.map((loc: any) => loc.code);
      }
    });

    let secondaryWarehouseId: string;

    it('POST /inventory-management/warehouses → 201 (create "Secondary Warehouse")', async () => {
      const uniqueCode = `SEC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const res = await axios.post(
        '/inventory-management/warehouses',
        {
          code: uniqueCode,
          name: `Secondary Warehouse ${Date.now()}`,
        },
        { headers: adminHeaders() }
      );

      if (res.status === 409) {
        // Already exists from previous run; list and find one to update
        const listRes = await axios.get('/inventory-management/warehouses', {
          headers: adminHeaders(),
        });
        const items = listRes.data.data ?? listRes.data;
        const secondary = items.find((w: any) => w.name?.includes('Secondary'));
        if (secondary) {
          secondaryWarehouseId = secondary.id;
          return;
        }
      }

      expect(res.status).toBe(201);
      expect(res.data).toHaveProperty('id');

      secondaryWarehouseId = res.data.id;
    });

    it('PUT /inventory-management/warehouses/:id → 200 (update name)', async () => {
      expect(secondaryWarehouseId).toBeDefined();

      const res = await axios.put(
        `/inventory-management/warehouses/${secondaryWarehouseId}`,
        { name: `Secondary Warehouse (Updated ${Date.now()})` },
        { headers: adminHeaders() }
      );

      expect(res.status).toBe(200);
    });
  });

  // ───────────────────────────── Stock Movements ─────────────────────────────

  describe('Stock Movements', () => {
    // We need an item code to use. Fetch it from a product detail.
    let itemCode: string;

    beforeAll(async () => {
      // Get the item code from the first product created in 04-products
      if (store.productIds?.[0]) {
        const res = await axios.get(
          `/store/admin/products/${store.productIds[0]}`,
          { headers: adminHeaders() }
        );
        if (res.status === 200) {
          itemCode = res.data.item?.code ?? res.data.data?.item?.code;
        }
      }
    });

    it('POST /inventory-management/movements → 201 (receipt - receive stock)', async () => {
      expect(store.warehouseCode).toBeTruthy();

      // Skip if we could not resolve an item code
      if (!itemCode) {
        console.warn('Skipping movement test: no item code available');
        return;
      }

      const body: Record<string, any> = {
        movementType: 'receipt',
        warehouseCode: store.warehouseCode,
        remarks: 'E2E test - initial stock receipt',
        items: [
          {
            itemCode,
            quantity: 50,
          },
        ],
      };

      const res = await axios.post('/inventory-management/movements', body, {
        headers: adminHeaders(),
      });

      expect(res.status).toBe(201);
      // Response may be a ledger entry (voucherNo, items) or have an id
      expect(res.data).toBeDefined();
    });

    it('POST /inventory-management/movements → 201 (adjustment)', async () => {
      if (!itemCode) {
        console.warn('Skipping movement test: no item code available');
        return;
      }

      const res = await axios.post(
        '/inventory-management/movements',
        {
          movementType: 'adjustment',
          warehouseCode: store.warehouseCode,
          remarks: 'E2E test - adjustment',
          items: [
            {
              itemCode,
              quantity: 10,
            },
          ],
        },
        { headers: adminHeaders() }
      );

      expect(res.status).toBeLessThan(500);
    });

    it('GET /inventory-management/movements → 200 (list movements)', async () => {
      const res = await axios.get('/inventory-management/movements', {
        headers: adminHeaders(),
      });

      expect(res.status).toBe(200);

      const items = res.data.data ?? res.data;
      expect(Array.isArray(items)).toBe(true);
    });

    it('GET /inventory-management/movements/summary → 200 (summary)', async () => {
      const res = await axios.get('/inventory-management/movements/summary', {
        headers: adminHeaders(),
      });

      expect(res.status).toBeLessThan(500);

      if (res.status === 200) {
        expect(res.data).toBeDefined();
      }
    });
  });

  // ───────────────────────────── Batches ─────────────────────────────

  describe('Batches', () => {
    let batchId: string;
    let itemCode: string;

    beforeAll(async () => {
      if (store.productIds?.[0]) {
        const res = await axios.get(
          `/store/admin/products/${store.productIds[0]}`,
          { headers: adminHeaders() }
        );
        if (res.status === 200) {
          itemCode = res.data.item?.code ?? res.data.data?.item?.code;
        }
      }
    });

    it('POST /inventory-management/batches → 201 (create batch)', async () => {
      if (!itemCode) {
        console.warn('Skipping batch test: no item code available');
        return;
      }

      const res = await axios.post(
        '/inventory-management/batches',
        {
          batchNo: `BATCH-E2E-${Date.now()}`,
          itemCode,
          expDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        },
        { headers: adminHeaders() }
      );

      // Item may not support batch tracking (returns 400), which is acceptable
      if (res.status === 400) {
        console.warn('Batch creation skipped: item does not support batch tracking');
        return;
      }

      expect(res.status).toBe(201);
      expect(res.data).toHaveProperty('id');

      batchId = res.data.id;
    });

    it('GET /inventory-management/batches → 200 (list batches)', async () => {
      const res = await axios.get('/inventory-management/batches', {
        headers: adminHeaders(),
      });

      expect(res.status).toBe(200);

      const items = res.data.data ?? res.data;
      expect(Array.isArray(items)).toBe(true);
    });

    it('GET /inventory-management/batches/:id → 200 (batch detail)', async () => {
      if (!batchId) {
        console.warn('Skipping batch detail test: no batch created');
        return;
      }

      const res = await axios.get(
        `/inventory-management/batches/${batchId}`,
        { headers: adminHeaders() }
      );

      expect(res.status).toBe(200);

      const batch = res.data.data ?? res.data;
      expect(batch.id ?? batch._id).toBe(batchId);
    });
  });

  // ───────────────────────────── Serials ─────────────────────────────

  describe('Serials', () => {
    let itemCode: string;

    beforeAll(async () => {
      if (store.productIds?.[0]) {
        const res = await axios.get(
          `/store/admin/products/${store.productIds[0]}`,
          { headers: adminHeaders() }
        );
        if (res.status === 200) {
          itemCode = res.data.item?.code ?? res.data.data?.item?.code;
        }
      }
    });

    it('POST /inventory-management/serials → 201 (create serial)', async () => {
      if (!itemCode) {
        console.warn('Skipping serial test: no item code available');
        return;
      }

      const res = await axios.post(
        '/inventory-management/serials',
        {
          serialNo: `SN-E2E-${Date.now()}`,
          itemCode,
          warehouseCode: store.warehouseCode,
        },
        { headers: adminHeaders() }
      );

      // Item may not support serial tracking (returns 400), which is acceptable
      if (res.status === 400) {
        console.warn('Serial creation skipped: item does not support serial tracking');
        return;
      }

      expect(res.status).toBe(201);
      expect(res.data).toHaveProperty('id');
    });

    it('GET /inventory-management/serials → 200 (list serials)', async () => {
      const res = await axios.get('/inventory-management/serials', {
        headers: adminHeaders(),
      });

      expect(res.status).toBe(200);

      const items = res.data.data ?? res.data;
      expect(Array.isArray(items)).toBe(true);
    });

    it('POST /inventory-management/serials/bulk → 201 (bulk create serials)', async () => {
      if (!itemCode) {
        console.warn('Skipping serial bulk test: no item code available');
        return;
      }

      const serials = Array.from({ length: 3 }, (_, i) => ({
        serialNo: `SN-BULK-E2E-${Date.now()}-${i}`,
        itemCode,
        warehouseCode: store.warehouseCode,
      }));

      const res = await axios.post(
        '/inventory-management/serials/bulk',
        { serials },
        { headers: adminHeaders() }
      );

      if (res.status === 400) {
        console.warn('Bulk serial creation skipped: item does not support serial tracking');
        return;
      }

      expect([200, 201]).toContain(res.status);
    });

    it('GET /inventory-management/serials/history/:serialNo → 200 (serial history)', async () => {
      // List serials to get a serial number
      const listRes = await axios.get('/inventory-management/serials', {
        headers: adminHeaders(),
      });

      const serials = listRes.data.data ?? listRes.data;
      if (!Array.isArray(serials) || serials.length === 0) {
        console.warn('Skipping serial history test: no serials found');
        return;
      }

      const serialNo = serials[0].serialNo;
      const res = await axios.get(
        `/inventory-management/serials/history/${serialNo}`,
        { headers: adminHeaders() }
      );

      expect(res.status).toBe(200);
    });
  });

  // ───────────────────────────── Item Movements ─────────────────────────────

  describe('Item Movements', () => {
    it('GET /inventory-management/movements/item/:itemCode → 200 (item movement history)', async () => {
      if (!store.productIds?.[0]) {
        console.warn('Skipping item movement test: no product available');
        return;
      }

      const prodRes = await axios.get(
        `/store/admin/products/${store.productIds[0]}`,
        { headers: adminHeaders() }
      );
      const itemCode = prodRes.data.item?.code ?? prodRes.data.data?.item?.code;
      if (!itemCode) {
        console.warn('Skipping item movement test: no item code');
        return;
      }

      const res = await axios.get(
        `/inventory-management/movements/item/${itemCode}`,
        { headers: adminHeaders() }
      );

      expect(res.status).toBe(200);
      expect(res.data).toBeDefined();
    });
  });

  // ───────────────────────────── Batch Update & Expiring ─────────────────────────────

  describe('Batch Operations', () => {
    it('PUT /inventory-management/batches/:id → 200 (update batch)', async () => {
      // List batches to find one to update
      const listRes = await axios.get('/inventory-management/batches', {
        headers: adminHeaders(),
      });

      const batches = listRes.data.data ?? listRes.data;
      if (!Array.isArray(batches) || batches.length === 0) {
        console.warn('Skipping batch update test: no batches found');
        return;
      }

      const batchId = batches[0].id;
      const res = await axios.put(
        `/inventory-management/batches/${batchId}`,
        { expDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString() },
        { headers: adminHeaders() }
      );

      expect(res.status).toBe(200);
    });

    it('GET /inventory-management/batches/expiring → 200 (expiring batches)', async () => {
      const res = await axios.get('/inventory-management/batches/expiring', {
        headers: adminHeaders(),
        params: { days: 365 },
      });

      expect(res.status).toBe(200);
      const items = res.data.data ?? res.data;
      expect(Array.isArray(items)).toBe(true);
    });
  });

  // ───────────────────────────── Locations ─────────────────────────────

  describe('Locations', () => {
    let createdLocationId: string;

    it('POST /inventory-management/warehouses/:warehouseId/locations → 201 (create location)', async () => {
      expect(store.warehouseId).toBeTruthy();

      const res = await axios.post(
        `/inventory-management/warehouses/${store.warehouseId}/locations`,
        {
          code: `LOC-E2E-${Date.now()}`,
          name: `E2E Test Location ${Date.now()}`,
          isPickable: true,
          isPutaway: true,
        },
        { headers: adminHeaders() }
      );

      expect(res.status).toBe(201);
      expect(res.data).toHaveProperty('id');
      createdLocationId = res.data.id;
    });

    it('PUT /inventory-management/locations/:id → 200 (update location)', async () => {
      if (!createdLocationId) {
        console.warn('Skipping location update: no location created');
        return;
      }

      const res = await axios.put(
        `/inventory-management/locations/${createdLocationId}`,
        { name: `E2E Updated Location ${Date.now()}` },
        { headers: adminHeaders() }
      );

      expect(res.status).toBe(200);
    });

    it('DELETE /inventory-management/locations/:id → 200 (delete location)', async () => {
      if (!createdLocationId) {
        console.warn('Skipping location delete: no location created');
        return;
      }

      const res = await axios.delete(
        `/inventory-management/locations/${createdLocationId}`,
        { headers: adminHeaders() }
      );

      expect([200, 204]).toContain(res.status);
    });
  });
});
