import { waitForPortOpen } from '@nx/node/utils';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

/* eslint-disable */
var __TEARDOWN_MESSAGE__: string;

module.exports = async function () {
  console.log('\n[E2E] Setting up...\n');

  // Reset file-based stores so each test run starts fresh
  const storeFile = path.join(__dirname, '..', '..', '.e2e-store.json');
  const authFile = path.join(__dirname, '..', '..', '.e2e-auth.json');
  const initialStore = {
    categoryIds: [], productIds: [], productSlugs: [],
    attributeTypeIds: [], attributeValueIds: [], variantIds: [],
    warehouseId: '', warehouseCode: '', locationIds: [], locationCodes: [],
    testCustomerEmail: `e2e-customer-${Date.now()}@test.com`,
    testCustomerPassword: 'TestPass123!',
    testCustomerId: '', addressId: '',
    cartId: '', orderId: '', orderNumber: '',
    couponId: '', couponCode: '', giftCardId: '', giftCardCode: '',
    reviewId: '', wishlistId: '', webhookId: '', themeId: '',
    // Phase 2 fields
    secondaryWarehouseId: '', cancelTestOrderId: '',
    carrierId: '', shippingZoneId: '', shippingRateId: '', shipmentId: '',
    // Journey test fields
    journeyTenantId: '', journeyAdminToken: '', journeyEmail: '',
    journeyProductId: '', journeyCategoryId: '',
    journeyGiftCardId: '', journeyGiftCardCode: '',
    journeyCartId: '', journeyOrderId: '', journeyOrderNumber: '',
    journeyCancelGiftCardId: '', journeyCancelGiftCardCode: '',
    journeyCancelOrderId: '',
    // Marketplace extended fields
    ebayConnectionId: '', ebayListingId: '', ebayOAuthState: '',
    // Shipping advanced fields
    weightTierId: '',
    // Product import fields
    importJobId: '',
  };
  fs.writeFileSync(storeFile, JSON.stringify(initialStore, null, 2));
  fs.writeFileSync(authFile, JSON.stringify({ adminToken: null, customerToken: null, customerId: null }));
  console.log('[E2E] Store and auth files reset');

  const host = process.env.HOST ?? 'localhost';
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;

  console.log(`[E2E] Waiting for API on ${host}:${port}...`);
  await waitForPortOpen(port, { host });

  const baseUrl = `http://${host}:${port}/api/v1`;

  // Wait for API readiness (DB + Redis connected)
  console.log('[E2E] Waiting for API readiness...');
  let ready = false;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await axios.get(`${baseUrl}/health/ready`, {
        validateStatus: () => true,
        timeout: 3000,
      });
      if (res.status === 200) { ready = true; break; }
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 2000));
  }

  if (!ready) {
    console.warn('[E2E] WARNING: API readiness check timed out. Tests may fail.');
  } else {
    console.log('[E2E] API is ready');
  }

  // Verify admin login works
  try {
    const loginRes = await axios.post(`${baseUrl}/auth/login`, {
      email: process.env.TEST_ADMIN_EMAIL || 'admin@noslag.com',
      password: process.env.TEST_ADMIN_PASSWORD || 'admin123',
    }, { validateStatus: () => true, timeout: 5000 });

    if (loginRes.status === 200 || loginRes.status === 201) {
      console.log('[E2E] Admin login verified');
    } else {
      console.warn(`[E2E] WARNING: Admin login returned ${loginRes.status}. Auth tests may fail.`);
    }
  } catch {
    console.warn('[E2E] WARNING: Admin login request failed. Ensure ENABLE_DEV_PASSWORD_LOGIN=true');
  }

  globalThis.__TEARDOWN_MESSAGE__ = '\n[E2E] Tearing down...\n';
};
