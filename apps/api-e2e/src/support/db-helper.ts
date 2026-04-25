import { Client } from 'pg';

/**
 * Direct DB access for tests that need to peek at server-only state
 * (e.g. one-time email verification tokens that aren't returned over
 * the API). Connects via DATABASE_URL — the same URL the API uses —
 * so the tests see whatever rows the API just wrote.
 */
async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) {
    throw new Error('DATABASE_URL not set; cannot run DB-backed test helpers');
  }
  const client = new Client({ connectionString });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/**
 * Returns the latest unexpired merchant email-verification token for the
 * given userId, or null if no token row exists. Used by the journey
 * onboarding test to drive the verify-email flow without needing a real
 * mailbox (the worker that would deliver the email is disabled in e2e).
 */
export async function getLatestMerchantVerificationToken(userId: string): Promise<string | null> {
  return withClient(async (client) => {
    const res = await client.query<{ token: string }>(
      `SELECT token
         FROM merchant_email_verification_tokens
        WHERE "userId" = $1
          AND "expiresAt" > NOW()
        ORDER BY "createdAt" DESC
        LIMIT 1`,
      [userId],
    );
    return res.rows[0]?.token ?? null;
  });
}

/**
 * Returns the user id for the given email + tenant. Used by the journey
 * test to resolve the admin user it just signed up so we can look up the
 * matching verification token.
 */
export async function getUserIdByEmail(email: string, tenantId: string): Promise<string | null> {
  return withClient(async (client) => {
    const res = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE email = $1 AND "tenantId" = $2 LIMIT 1`,
      [email, tenantId],
    );
    return res.rows[0]?.id ?? null;
  });
}

/**
 * Marks the journey tenant's payment-provider status as 'active' so the
 * publish-readiness gate passes. The real flow goes through Stripe Connect
 * onboarding (which can't be exercised in e2e without real Stripe creds),
 * so we shim the post-condition: tenant.paymentProviderStatus = 'active'.
 */
export async function activateTenantPayments(tenantId: string): Promise<void> {
  await withClient(async (client) => {
    await client.query(
      `UPDATE tenants
          SET "paymentProviderStatus" = 'active',
              "paymentProvider"       = COALESCE("paymentProvider", 'stripe')
        WHERE id = $1`,
      [tenantId],
    );
  });
}
