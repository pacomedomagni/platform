import { Injectable, Logger } from '@nestjs/common';
import { PrismaService, bypassTenantGuard, runWithTenant } from '@platform/db';
import * as crypto from 'crypto';

/**
 * eBay Webhook Service
 * Handles ECDSA signature verification, challenge responses, and account deletion
 * for eBay marketplace notification webhooks.
 */
interface EbayPublicKey {
  key: crypto.KeyObject;
  algorithm: string; // e.g. "ECDSA"
  digest: string;    // e.g. "SHA1" or "SHA256" — eBay tells us per-key
}

@Injectable()
export class EbayWebhookService {
  private readonly logger = new Logger(EbayWebhookService.name);
  private readonly mockMode = process.env.MOCK_EXTERNAL_SERVICES === 'true';

  /**
   * In-memory cache for eBay public keys.
   * Each entry stores the PEM KeyObject, the signing algorithm metadata eBay
   * reports for that key (algorithm + digest), and an expiry timestamp.
   * The metadata is per-key because eBay rotates keys and the digest can be
   * SHA1 on legacy keys / SHA256 on newer ones — hardcoding either is wrong.
   */
  private readonly publicKeyCache = new Map<
    string,
    EbayPublicKey & { expiry: number }
  >();
  private readonly KEY_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

  constructor(private prisma: PrismaService) {}

  /**
   * Verify the digital signature on an inbound eBay notification.
   *
   * Per eBay's own SDK contract (event-notification-java-sdk SignatureValidator):
   *   - X-EBAY-SIGNATURE is base64-encoded JSON `{kid, signature, ...}`
   *   - The signature covers the RAW REQUEST BODY BYTES only — NOT
   *     body+timestamp+endpoint+verificationToken (that's the marketplace
   *     account-deletion CHALLENGE handshake construction, a different thing).
   *   - The hash algorithm is reported by getPublicKey (digest field),
   *     not hardcoded. Production keys today use SHA1/ECDSA; eBay can rotate.
   *
   * Reference:
   *   https://github.com/eBay/event-notification-java-sdk/blob/main/src/main/java/com/ebay/commerce/notification/utils/SignatureValidator.java
   */
  async verifySignature(
    body: string,
    signatureHeader: string,
  ): Promise<boolean> {
    if (this.mockMode) {
      this.logger.log('[MOCK] Skipping webhook signature verification');
      return true;
    }

    try {
      const headerJson = Buffer.from(signatureHeader, 'base64').toString(
        'utf8'
      );
      const { kid, signature } = JSON.parse(headerJson);

      if (!kid || !signature) {
        this.logger.warn('Missing kid or signature in X-EBAY-SIGNATURE header');
        return false;
      }

      const pk = await this.getPublicKey(kid);

      // Node's crypto.verify takes the digest algorithm name and the
      // un-hashed message bytes — it hashes internally. This matches the
      // Java Signature.getInstance("SHA1withECDSA"); update(body); verify()
      // contract in eBay's SDK.
      const digestAlgo = pk.digest.toLowerCase(); // 'sha1' | 'sha256'
      const signatureBuffer = Buffer.from(signature, 'base64');
      const isValid = crypto.verify(
        digestAlgo,
        Buffer.from(body, 'utf8'),
        pk.key,
        signatureBuffer
      );

      if (!isValid) {
        this.logger.warn(
          `eBay webhook signature verification failed (kid=${kid}, algo=${digestAlgo}with${pk.algorithm})`
        );
      }

      return isValid;
    } catch (error) {
      this.logger.error('Error verifying eBay webhook signature', error);
      return false;
    }
  }

  /**
   * Fetch an eBay public key by key ID from the Notification API.
   * Returns the key plus the algorithm metadata eBay associates with it.
   * Results are cached in memory for 1 hour to avoid repeated network calls.
   */
  async getPublicKey(keyId: string): Promise<EbayPublicKey> {
    const cached = this.publicKeyCache.get(keyId);
    if (cached && Date.now() < cached.expiry) {
      return cached;
    }

    if (this.mockMode) {
      this.logger.log('[MOCK] Returning mock public key');
      const { publicKey } = crypto.generateKeyPairSync('ec', {
        namedCurve: 'prime256v1',
      });
      const entry: EbayPublicKey & { expiry: number } = {
        key: publicKey,
        algorithm: 'ECDSA',
        digest: 'SHA256',
        expiry: Date.now() + this.KEY_CACHE_TTL_MS,
      };
      this.publicKeyCache.set(keyId, entry);
      return entry;
    }

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
    // eBay returns { key: "<PEM-encoded>", algorithm: "ECDSA", digest: "SHA1" | "SHA256" }
    const pemKey = data.key || data.publicKey;

    if (!pemKey) {
      throw new Error(
        `eBay public key response for ${keyId} did not contain a key`
      );
    }

    const keyObject = crypto.createPublicKey(pemKey);
    const entry: EbayPublicKey & { expiry: number } = {
      key: keyObject,
      algorithm: typeof data.algorithm === 'string' ? data.algorithm : 'ECDSA',
      // eBay has historically used SHA1; newer keys may report SHA256.
      // Default to SHA1 only if the field is missing entirely.
      digest: typeof data.digest === 'string' ? data.digest : 'SHA1',
      expiry: Date.now() + this.KEY_CACHE_TTL_MS,
    };

    this.publicKeyCache.set(keyId, entry);

    this.logger.log(
      `Cached eBay public key: ${keyId} (algo=${entry.digest}with${entry.algorithm})`
    );
    return entry;
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
    // Lookup is by platformConfig.ebayUserId only — that's the canonical
    // key written at OAuth callback time (see EbayAuthService
    // .fetchAndSaveEbayUserId).
    const matches = await bypassTenantGuard(() =>
      this.prisma.marketplaceConnection.findMany({
        where: {
          platform: 'EBAY',
          isConnected: true,
          platformConfig: { path: ['ebayUserId'], equals: userId },
        },
        select: { id: true, tenantId: true },
      }),
    );

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
