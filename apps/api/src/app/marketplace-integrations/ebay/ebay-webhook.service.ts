import { Injectable, Logger } from '@nestjs/common';
import { PrismaService, bypassTenantGuard, runWithTenant } from '@platform/db';
import * as crypto from 'crypto';

/**
 * eBay Webhook Service
 * Handles ECDSA signature verification, challenge responses, and account deletion
 * for eBay marketplace notification webhooks.
 */
@Injectable()
export class EbayWebhookService {
  private readonly logger = new Logger(EbayWebhookService.name);
  private readonly mockMode = process.env.MOCK_EXTERNAL_SERVICES === 'true';

  /**
   * In-memory cache for eBay public keys.
   * Each entry stores the PEM key object and an expiry timestamp (1 hour TTL).
   */
  private readonly publicKeyCache = new Map<
    string,
    { key: crypto.KeyObject; expiry: number }
  >();
  private readonly KEY_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

  constructor(private prisma: PrismaService) {}

  /**
   * Verify the ECDSA signature from the X-EBAY-SIGNATURE header.
   *
   * Header format: base64-encoded JSON `{ "kid": "...", "signature": "..." }`
   * Digest = SHA-256(requestBody + timestamp + webhookEndpoint + verificationToken)
   * Signature algorithm: ECDSA with SHA-256
   */
  async verifySignature(
    body: string,
    signatureHeader: string,
    timestamp: string
  ): Promise<boolean> {
    if (this.mockMode) {
      this.logger.log('[MOCK] Skipping webhook signature verification');
      return true;
    }

    try {
      // Decode the X-EBAY-SIGNATURE header
      const headerJson = Buffer.from(signatureHeader, 'base64').toString(
        'utf8'
      );
      const { kid, signature } = JSON.parse(headerJson);

      if (!kid || !signature) {
        this.logger.warn('Missing kid or signature in X-EBAY-SIGNATURE header');
        return false;
      }

      // Fetch (or retrieve from cache) the public key for this key ID
      const publicKey = await this.getPublicKey(kid);

      // Build the digest: SHA-256(body + timestamp + endpoint + verificationToken)
      const verificationToken = process.env['EBAY_VERIFICATION_TOKEN'] || '';
      const endpoint = process.env['EBAY_WEBHOOK_ENDPOINT'] || '';

      const digestPayload = body + timestamp + endpoint + verificationToken;
      const digest = crypto
        .createHash('sha256')
        .update(digestPayload)
        .digest();

      // Verify the ECDSA signature against the digest
      const signatureBuffer = Buffer.from(signature, 'base64');
      const isValid = crypto.verify(
        'sha256',
        digest,
        publicKey,
        signatureBuffer
      );

      if (!isValid) {
        this.logger.warn('eBay webhook signature verification failed');
      }

      return isValid;
    } catch (error) {
      this.logger.error('Error verifying eBay webhook signature', error);
      return false;
    }
  }

  /**
   * Fetch an eBay public key by key ID from the Notification API.
   * Results are cached in memory for 1 hour to avoid repeated network calls.
   */
  async getPublicKey(keyId: string): Promise<crypto.KeyObject> {
    // Check cache first
    const cached = this.publicKeyCache.get(keyId);
    if (cached && Date.now() < cached.expiry) {
      return cached.key;
    }

    if (this.mockMode) {
      this.logger.log('[MOCK] Returning mock public key');
      // Generate a throwaway EC key pair for mock mode
      const { publicKey } = crypto.generateKeyPairSync('ec', {
        namedCurve: 'prime256v1',
      });
      this.publicKeyCache.set(keyId, {
        key: publicKey,
        expiry: Date.now() + this.KEY_CACHE_TTL_MS,
      });
      return publicKey;
    }

    // E-8: respect EBAY_SANDBOX so signature verification works in non-prod
    // environments. Previously the URL was hardcoded to prod, meaning a
    // sandbox eBay webhook would fail to verify (and was being papered over
    // by mockMode in tests).
    const isSandbox = process.env['EBAY_SANDBOX'] === 'true';
    const baseUrl = isSandbox
      ? 'https://api.sandbox.ebay.com'
      : 'https://api.ebay.com';
    const url = `${baseUrl}/commerce/notification/v1/public_key/${keyId}`;

    this.logger.log(`Fetching eBay public key: ${keyId}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(
        `Failed to fetch eBay public key ${keyId}: ${response.status} - ${errorText}`
      );
      throw new Error(
        `Failed to fetch eBay public key: ${response.status}`
      );
    }

    const data = await response.json();
    // eBay returns { publicKey: "<PEM-encoded key>", algorithm: "ECDSA", digest: "SHA256" }
    const pemKey = data.key || data.publicKey;

    if (!pemKey) {
      throw new Error(
        `eBay public key response for ${keyId} did not contain a key`
      );
    }

    const keyObject = crypto.createPublicKey(pemKey);

    // Cache the key
    this.publicKeyCache.set(keyId, {
      key: keyObject,
      expiry: Date.now() + this.KEY_CACHE_TTL_MS,
    });

    this.logger.log(`Cached eBay public key: ${keyId}`);
    return keyObject;
  }

  /**
   * Compute the challenge response for eBay endpoint verification.
   *
   * eBay sends a GET with `challenge_code` query param. We must return:
   *   SHA-256(challengeCode + verificationToken + endpoint) as hex
   */
  computeChallengeResponse(challengeCode: string): string {
    const verificationToken = process.env['EBAY_VERIFICATION_TOKEN'] || '';
    const endpoint = process.env['EBAY_WEBHOOK_ENDPOINT'] || '';

    const hash = crypto
      .createHash('sha256')
      .update(challengeCode + verificationToken + endpoint)
      .digest('hex');

    return hash;
  }

  /**
   * Handle an account deletion notification from eBay.
   *
   * eBay sends one notification per deleted user globally; the user may have
   * connected to multiple tenants (e.g. an agency managing several stores
   * under the same eBay login), so we anonymize every matching connection.
   * What we DON'T do is scan every eBay connection in the database and
   * compare userIds in application code — that's O(n) over all tenants and
   * trivially fans out wrong if any platformConfig field accidentally
   * collides. Instead we filter at the database level via the JSONB path
   * so the query plan only touches matching rows.
   */
  async handleAccountDeletion(notification: any): Promise<void> {
    const userId =
      notification?.data?.userId ||
      notification?.data?.username ||
      notification?.userId;

    if (!userId) {
      this.logger.warn(
        'Account deletion notification missing user identifier'
      );
      return;
    }

    this.logger.log(
      `Processing account deletion for eBay user: ${userId}`
    );

    // Cross-tenant scan: look up every connection that belongs to this eBay
    // user, regardless of which tenant owns it. The bypass is required —
    // we have no tenant context yet at this point in the webhook flow.
    const candidates = await bypassTenantGuard(() =>
      this.prisma.marketplaceConnection.findMany({
        where: {
          platform: 'EBAY',
          isConnected: true,
          OR: [
            { platformConfig: { path: ['ebayUserId'], equals: userId } },
            { platformConfig: { path: ['userId'], equals: userId } },
            { platformConfig: { path: ['username'], equals: userId } },
          ],
        },
        select: { id: true, tenantId: true },
      }),
    );

    const seen = new Set<string>();
    const matches = candidates.filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });

    // Per-tenant anonymization — pin each tenant's id for the update so the
    // RLS policy matches. eBay sends one notification per user globally,
    // so multiple tenants with the same eBay seller all get cleaned up.
    for (const match of matches) {
      await runWithTenant(match.tenantId, () => this.anonymizeConnection(match.id));
      this.logger.log(
        `Anonymized eBay connection ${match.id} (tenant ${match.tenantId}) for user ${userId}`
      );
    }

    if (matches.length === 0) {
      this.logger.warn(
        `No matching eBay connection found for user ${userId}. ` +
          'The account may have already been disconnected.'
      );
    } else {
      this.logger.log(
        `Anonymized ${matches.length} connection(s) for eBay user ${userId}`
      );
    }
  }

  /**
   * Anonymize a marketplace connection by clearing tokens and marking
   * it as disconnected.
   */
  private async anonymizeConnection(connectionId: string): Promise<void> {
    await this.prisma.marketplaceConnection.update({
      where: { id: connectionId },
      data: {
        refreshToken: null,
        accessToken: null,
        accessTokenExpiry: null,
        isConnected: false,
        platformConfig: {},
      },
    });

    this.logger.log(`Anonymized connection ${connectionId}`);
  }
}
