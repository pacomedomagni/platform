import { Injectable, Logger, BadRequestException, OnModuleDestroy } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService, bypassTenantGuard, runWithTenant } from '@platform/db';
import { Prisma } from '@prisma/client';
import { EbayStoreService } from './ebay-store.service';
import { MarketplaceAuditService } from '../shared/marketplace-audit.service';

/**
 * eBay OAuth Authentication Service
 * Handles OAuth 2.0 flow for connecting eBay stores
 */
@Injectable()
export class EbayAuthService implements OnModuleDestroy {
  private readonly logger = new Logger(EbayAuthService.name);
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(
    private ebayStore: EbayStoreService,
    private prisma: PrismaService,
    private audit: MarketplaceAuditService
  ) {
    // Clean up expired OAuth states every 10 minutes
    this.cleanupInterval = setInterval(() => this.cleanupExpiredStates(), 10 * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  /**
   * Generate OAuth authorization URL
   */
  async getAuthorizationUrl(connectionId: string, tenantId: string): Promise<string> {
    if (!this.ebayStore.hasCredentials()) {
      throw new BadRequestException('eBay API credentials not configured');
    }

    // Verify connection exists and belongs to tenant (getConnection already filters by tenantId)
    await this.ebayStore.getConnection(connectionId, tenantId);

    // Generate state for CSRF protection
    const state = this.generateState();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store state with connection info in database (id IS the state value)
    await this.prisma.oAuthState.create({
      data: {
        id: state,
        connectionId,
        tenantId,
        expiresAt: new Date(expiresAt),
      },
    });

    // Generate OAuth URL using URLSearchParams for proper encoding
    const appId = process.env['EBAY_APP_ID'];
    const ruName = process.env['EBAY_RU_NAME'];
    const scopes = [
      'https://api.ebay.com/oauth/api_scope',
      // Sell APIs
      'https://api.ebay.com/oauth/api_scope/sell.marketing.readonly',
      'https://api.ebay.com/oauth/api_scope/sell.marketing',
      'https://api.ebay.com/oauth/api_scope/sell.inventory.readonly',
      'https://api.ebay.com/oauth/api_scope/sell.inventory',
      'https://api.ebay.com/oauth/api_scope/sell.account.readonly',
      'https://api.ebay.com/oauth/api_scope/sell.account',
      'https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly',
      'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
      'https://api.ebay.com/oauth/api_scope/sell.analytics.readonly',
      'https://api.ebay.com/oauth/api_scope/sell.finances',
      'https://api.ebay.com/oauth/api_scope/sell.payment.dispute',
      'https://api.ebay.com/oauth/api_scope/sell.logistics',
      'https://api.ebay.com/oauth/api_scope/sell.compliance',
      'https://api.ebay.com/oauth/api_scope/sell.negotiation',
      'https://api.ebay.com/oauth/api_scope/sell.feed',
      'https://api.ebay.com/oauth/api_scope/sell.metadata',
      // Commerce APIs
      'https://api.ebay.com/oauth/api_scope/commerce.identity.readonly',
      'https://api.ebay.com/oauth/api_scope/commerce.catalog.readonly',
      'https://api.ebay.com/oauth/api_scope/commerce.media.upload',
      'https://api.ebay.com/oauth/api_scope/commerce.taxonomy.readonly',
      'https://api.ebay.com/oauth/api_scope/commerce.notification.subscription',
    ];

    const params = new URLSearchParams({
      client_id: appId,
      response_type: 'code',
      redirect_uri: ruName,
      scope: scopes.join(' '),
      state,
    });

    const authUrl = `${this.authBaseUrl}/oauth2/authorize?${params.toString()}`;

    this.logger.log(`Generated OAuth URL for connection ${connectionId}`);
    return authUrl;
  }

  /**
   * Handle OAuth callback and exchange code for tokens
   */
  async handleCallback(code: string, state: string) {
    // Verify state from database. The state lookup itself happens before we
    // know which tenant it belongs to, so it must run with the bypass flag
    // — otherwise the RLS extension would reject a tenant-scoped query
    // with no tenant context. The state's tenantId is then used to pin the
    // remainder of the flow via runWithTenant.
    const stateData = await bypassTenantGuard(() =>
      this.prisma.oAuthState.findUnique({
        where: { id: state },
      }),
    );
    if (!stateData) {
      throw new BadRequestException('Invalid or expired OAuth state');
    }

    const { connectionId, tenantId } = stateData;

    if (new Date() > stateData.expiresAt) {
      await runWithTenant(tenantId, () =>
        this.prisma.oAuthState.delete({ where: { id: state } }),
      );
      throw new BadRequestException('OAuth state expired. Please try again.');
    }

    return runWithTenant(tenantId, async () => {
      try {
        // Exchange authorization code for tokens
        const tokens = await this.exchangeCodeForTokens(code);

        // E-9: validate that eBay actually granted the scopes our flows
        // need. The previous code stored whatever came back, then later
        // operations would fail mid-flight (or worse, succeed for read but
        // fail for write) with no clear signal that the user authorized a
        // subset. Fail fast at OAuth time so the merchant sees a clear
        // "please re-authorize and grant all permissions" message.
        this.assertGrantedScopes(tokens.scope);

        // Save tokens
        await this.ebayStore.saveTokens(connectionId, {
          refreshToken: tokens.refresh_token,
          accessToken: tokens.access_token,
          accessTokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
        });

        // Fetch and persist the eBay seller's userId. This is required for
        // (a) the GDPR account-deletion webhook to find which connection
        //     to anonymize, and (b) routing inbound order notifications to
        //     the right tenant before the order has been synced.
        // The lookup uses platformConfig.ebayUserId — without this write
        // the entire account-deletion compliance path silently no-ops.
        await this.fetchAndSaveEbayUserId(
          connectionId,
          tokens.access_token,
        );

        // Fetch and save business policies (pass tenantId explicitly since OAuth callback has no CLS context)
        await this.ebayStore.fetchAndSaveBusinessPolicies(connectionId, tenantId);

        // Clean up state from database
        await this.prisma.oAuthState.delete({ where: { id: state } });

        this.logger.log(`Successfully connected eBay store for connection ${connectionId}`);

        // Audit log: OAuth connected
        try {
          const connection = await this.ebayStore.getConnection(connectionId, tenantId);
          await this.audit.logOAuthConnected(connectionId, connection.name, 'EBAY');
        } catch {
          // Non-critical: do not fail the callback if audit logging fails
        }

        return {
          success: true,
          connectionId,
        };
      } catch (error) {
        this.logger.error(`OAuth callback failed for connection ${connectionId}`, error);
        throw new BadRequestException('OAuth connection failed. Please try again.');
      }
    });
  }

  /**
   * Fetch the connected eBay seller's identity via the Commerce Identity API
   * and persist it in MarketplaceConnection.platformConfig.ebayUserId.
   *
   * Note the `apiz` subdomain — production eBay routes the Commerce APIs
   * under apiz.ebay.com, not api.ebay.com. Sandbox uses apiz.sandbox.
   */
  private async fetchAndSaveEbayUserId(
    connectionId: string,
    accessToken: string,
  ): Promise<void> {
    let userId: string;
    let username: string | null;

    if (process.env['MOCK_EXTERNAL_SERVICES'] === 'true') {
      userId = `mock_user_${connectionId.slice(0, 8)}`;
      username = null;
    } else {
      const isSandbox = process.env['EBAY_SANDBOX'] === 'true';
      const baseUrl = isSandbox
        ? 'https://apiz.sandbox.ebay.com'
        : 'https://apiz.ebay.com';
      const url = `${baseUrl}/commerce/identity/v1/user`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '<no body>');
        // Hard-fail. Without ebayUserId the connection is unusable for
        // webhook-driven flows (account-deletion compliance, real-time
        // order notifications). Better to fail OAuth here than to ship a
        // half-broken connection that silently misroutes notifications.
        throw new Error(
          `Failed to fetch eBay user identity: ${response.status} - ${errorText}`,
        );
      }

      const data = (await response.json()) as { userId?: string; username?: string };
      if (!data.userId) {
        throw new Error('eBay identity response missing userId');
      }
      userId = data.userId;
      username = data.username ?? null;
    }

    // Prisma treats Json columns as scalars, so the naive
    //   data: { platformConfig: { ebayUserId, ebayUsername } }
    // would clobber any other keys that future code adds to platformConfig.
    // Read-modify-write under a transaction so concurrent writers can't
    // race and lose keys.
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.marketplaceConnection.findUniqueOrThrow({
        where: { id: connectionId },
        select: { platformConfig: true },
      });
      const merged = {
        ...((current.platformConfig as Record<string, unknown>) ?? {}),
        ebayUserId: userId,
        ebayUsername: username,
      };
      await tx.marketplaceConnection.update({
        where: { id: connectionId },
        data: { platformConfig: merged as Prisma.InputJsonValue },
      });
    });

    this.logger.log(`Saved ebayUserId=${userId} for connection ${connectionId}`);
  }

  /**
   * Determine the correct eBay base URLs based on sandbox mode.
   */
  private get isSandbox(): boolean {
    return process.env.EBAY_SANDBOX === 'true';
  }

  private get authBaseUrl(): string {
    return this.isSandbox
      ? 'https://auth.sandbox.ebay.com'
      : 'https://auth.ebay.com';
  }

  private get apiBaseUrl(): string {
    return this.isSandbox
      ? 'https://api.sandbox.ebay.com'
      : 'https://api.ebay.com';
  }

  /**
   * Exchange authorization code for tokens
   */
  private async exchangeCodeForTokens(code: string) {
    // In mock mode, return fake tokens instead of calling real eBay API
    if (process.env.MOCK_EXTERNAL_SERVICES === 'true') {
      this.logger.log('[MOCK] Returning mock OAuth tokens');
      return {
        access_token: `mock_access_token_${Date.now()}`,
        refresh_token: `mock_refresh_token_${Date.now()}`,
        expires_in: 7200,
        token_type: 'Bearer',
      };
    }

    const appId = process.env['EBAY_APP_ID'];
    const certId = process.env['EBAY_CERT_ID'];
    const ruName = process.env['EBAY_RU_NAME'];
    const tokenEndpoint = `${this.apiBaseUrl}/identity/v1/oauth2/token`;

    const credentials = Buffer.from(`${appId}:${certId}`).toString('base64');

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: `grant_type=authorization_code&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(ruName)}`,
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Token exchange failed: ${response.status} - ${errorText}`);
      throw new Error('Failed to exchange authorization code for tokens. Please try again.');
    }

    return response.json();
  }

  /**
   * Generate random state for CSRF protection
   */
  private generateState(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * E-9: validate the scopes eBay actually granted contain the minimum set
   * required for our sync flows. The OAuth response includes a space-
   * separated `scope` string per RFC 6749 §5.1; if the user de-selected any
   * permission on the consent screen, those scopes are silently absent from
   * the response and we'd later see opaque API failures.
   *
   * Mock mode skips validation since mock tokens have no real scope set.
   */
  private static readonly REQUIRED_EBAY_SCOPES: readonly string[] = [
    'https://api.ebay.com/oauth/api_scope/sell.inventory',
    'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
    'https://api.ebay.com/oauth/api_scope/sell.account',
  ];

  private assertGrantedScopes(grantedScope: string | undefined): void {
    if (process.env['MOCK_EXTERNAL_SERVICES'] === 'true') return;
    if (!grantedScope) {
      // RFC says scope is OPTIONAL when the granted set equals the requested
      // set — eBay does include it in practice, but we don't fail-closed if
      // it's absent. Just log so a regression is visible in observability.
      this.logger.warn(
        'eBay token exchange returned no scope field; cannot verify granted permissions',
      );
      return;
    }
    const granted = new Set(grantedScope.split(/\s+/).filter(Boolean));
    const missing = EbayAuthService.REQUIRED_EBAY_SCOPES.filter(
      (s) => !granted.has(s),
    );
    if (missing.length > 0) {
      throw new BadRequestException(
        `eBay did not grant required scopes: ${missing.join(', ')}. ` +
        `Please reconnect and accept all requested permissions.`,
      );
    }
  }

  /**
   * Clean up expired OAuth states
   */
  private async cleanupExpiredStates() {
    // Cross-tenant sweep — wipes expired OAuth state rows for every
    // tenant. The bypass tells the RLS extension this is intentional.
    await bypassTenantGuard(() =>
      this.prisma.oAuthState.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      }),
    );
  }
}
