import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const TENANT_ID =
  process.env.TEST_TENANT_ID || '8d334424-054e-4452-949c-21ecc1fff2c0';

/**
 * File-based token persistence so auth state survives across Jest test files.
 * Jest clears module caches (and globalThis in VM sandboxes) between files.
 */
const AUTH_FILE = path.join(__dirname, '..', '..', '.e2e-auth.json');

interface AuthState {
  adminToken: string | null;
  customerToken: string | null;
  customerId: string | null;
}

function loadAuth(): AuthState {
  try {
    if (fs.existsSync(AUTH_FILE)) {
      return JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
    }
  } catch { /* reset */ }
  return { adminToken: null, customerToken: null, customerId: null };
}

function saveAuth(state: AuthState) {
  fs.writeFileSync(AUTH_FILE, JSON.stringify(state));
}

/**
 * Reset auth file. Called from global-setup.
 */
export function resetAuth() {
  saveAuth({ adminToken: null, customerToken: null, customerId: null });
}

/**
 * Login as admin and cache the token.
 */
export async function getAdminToken(): Promise<string> {
  const auth = loadAuth();
  if (auth.adminToken) return auth.adminToken;

  const res = await axios.post('/auth/login', {
    email: process.env.TEST_ADMIN_EMAIL || 'admin@noslag.com',
    password: process.env.TEST_ADMIN_PASSWORD || 'admin123',
  });

  if (res.status !== 200 && res.status !== 201) {
    throw new Error(
      `Admin login failed: ${res.status} ${JSON.stringify(res.data)}`
    );
  }

  auth.adminToken = res.data.access_token;
  saveAuth(auth);
  return auth.adminToken!;
}

/**
 * Returns headers for admin API calls.
 */
export function adminHeaders() {
  const auth = loadAuth();
  if (!auth.adminToken) throw new Error('Call getAdminToken() first');
  return {
    Authorization: `Bearer ${auth.adminToken}`,
    'x-tenant-id': TENANT_ID,
  };
}

/**
 * Register a new storefront customer.
 */
export async function registerTestCustomer(
  email: string,
  password: string,
  firstName = 'Test',
  lastName = 'Customer'
) {
  const res = await axios.post(
    '/store/auth/register',
    { email, password, firstName, lastName },
    { headers: { 'x-tenant-id': TENANT_ID } }
  );
  return res;
}

/**
 * Login as a storefront customer and cache the token.
 */
export async function loginTestCustomer(email: string, password: string) {
  const res = await axios.post(
    '/store/auth/login',
    { email, password },
    { headers: { 'x-tenant-id': TENANT_ID } }
  );

  if (res.status === 200 || res.status === 201) {
    const auth = loadAuth();
    auth.customerToken = res.data.token ?? res.data.access_token;
    auth.customerId = res.data.customer?.id ?? null;
    saveAuth(auth);
  }
  return res;
}

/**
 * Returns headers for customer API calls.
 */
export function customerHeaders() {
  const auth = loadAuth();
  if (!auth.customerToken)
    throw new Error('Call loginTestCustomer() first');
  return {
    Authorization: `Bearer ${auth.customerToken}`,
    'x-tenant-id': TENANT_ID,
  };
}

/**
 * Returns just the tenant header (no auth).
 */
export function tenantHeaders() {
  return {
    'x-tenant-id': TENANT_ID,
  };
}

/**
 * Get the cached customer ID.
 */
export function getCustomerId(): string | null {
  return loadAuth().customerId;
}

/**
 * Reset cached tokens.
 */
export function resetTokens() {
  saveAuth({ adminToken: null, customerToken: null, customerId: null });
}

// ──────────────────────────── Journey Tenant Helpers ────────────────────────────

/**
 * Signup a brand-new tenant for journey tests.
 * Returns { tenantId, accessToken }.
 */
export async function signupJourneyTenant(
  businessName: string,
  email: string,
  password: string,
  subdomain: string,
) {
  const res = await axios.post('/onboarding/signup', {
    businessName,
    email,
    password,
    subdomain,
    paymentProvider: 'stripe',
    baseCurrency: 'USD',
  });

  if (res.status !== 201) {
    throw new Error(
      `Journey signup failed: ${res.status} ${JSON.stringify(res.data)}`
    );
  }

  return {
    tenantId: res.data.tenantId,
    accessToken: res.data.accessToken,
  };
}

/**
 * Returns admin headers scoped to a specific journey tenant.
 */
export function journeyAdminHeaders(tenantId: string, accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'x-tenant-id': tenantId,
  };
}
