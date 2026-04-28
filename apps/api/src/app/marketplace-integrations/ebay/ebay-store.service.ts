import { Injectable, Logger, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { ClsService } from 'nestjs-cls';
import eBayApi from 'ebay-api';
import Redis from 'ioredis';
import { DistributedLockService } from '@platform/queue';
import { EncryptionService } from '../shared/encryption.service';
import { EbayTokenResponse } from '../shared/marketplace.types';

/**
 * eBay Store Management Service
 * Handles multi-store connections, OAuth tokens, and authenticated clients.
 *
 * Phase 3 W3.4: token refresh is now serialized via Redis distributed lock.
 * The previous in-memory `refreshLocks` Map only prevented concurrent
 * refreshes within a single pod; under multi-pod deploys two pods could
 * both refresh the same connection's token, race on the DB write, and
 * each cache a different access token — leading to intermittent 401s
 * served from one pod after the other had already rotated.
 */
@Injectable()
export class EbayStoreService implements OnModuleDestroy {
  private readonly logger = new Logger(EbayStoreService.name);
  private readonly clientCache = new Map<string, { client: eBayApi; expiry: number }>();
  private readonly TOKEN_BUFFER_MS = 60000; // Refresh 1 min before expiry
  private readonly mockMode = process.env.MOCK_EXTERNAL_SERVICES === 'true';

  // Redis-backed distributed token rate limiting for multi-instance deployments
  private redis: Redis | null = null;
  private redisAvailable = true;

  // In-memory fallback (used only when Redis is unavailable)
  private readonly tokenRateLimitsFallback = new Map<string, { count: number; resetAt: number }>();
  private readonly TOKEN_DAILY_LIMITS: Record<string, number> = {
    'client_credentials': 1_000,
    'authorization_code': 10_000,
    'refresh_token': 50_000,
  };

  constructor(
    private prisma: PrismaService,
    private cls: ClsService,
    private encryption: EncryptionService,
    private lockService: DistributedLockService,
  ) {}

  private getRedis(): Redis {
    if (!this.redis) {
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        lazyConnect: true,
        enableOfflineQueue: false,
      });
      this.redis.on('error', (err) => {
        if (this.redisAvailable) {
          this.logger.warn(`Redis rate-limit connection error: ${err.message}. Falling back to in-memory.`);
          this.redisAvailable = false;
        }
      });
      this.redis.on('connect', () => {
        this.redisAvailable = true;
      });
    }
    return this.redis;
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit().catch(() => {});
      this.redis = null;
    }
  }

  /**
   * Calculate seconds remaining until end of current UTC day.
   */
  private getEndOfDayTtl(): number {
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setUTCHours(23, 59, 59, 999);
    return Math.max(Math.ceil((endOfDay.getTime() - now.getTime()) / 1000), 1);
  }

  /**
   * Get eBay API credentials from environment
   */
  private getEbayCredentials() {
    return {
      appId: process.env['EBAY_APP_ID'],
      certId: process.env['EBAY_CERT_ID'],
      devId: process.env['EBAY_DEV_ID'],
      ruName: process.env['EBAY_RU_NAME'],
    };
  }

  /**
   * Check if eBay credentials are configured
   */
  hasCredentials(): boolean {
    if (this.mockMode) return true;
    const { appId, certId, ruName } = this.getEbayCredentials();
    return !!(appId && certId && ruName);
  }

  /**
   * Create new eBay connection for tenant
   */
  async createConnection(data: {
    name: string;
    description?: string;
    marketplaceId?: string;
    isDefault?: boolean;
  }) {
    const tenantId = this.cls.get('tenantId');

    if (!this.hasCredentials()) {
      throw new Error('eBay API credentials not configured. Set EBAY_APP_ID, EBAY_CERT_ID, and EBAY_RU_NAME environment variables.');
    }

    // If setting as default, unset others
    if (data.isDefault) {
      await this.prisma.marketplaceConnection.updateMany({
        where: { tenantId, platform: 'EBAY', isDefault: true },
        data: { isDefault: false },
      });
    }

    const connection = await this.prisma.marketplaceConnection.create({
      data: {
        tenantId,
        platform: 'EBAY',
        name: data.name,
        description: data.description,
        marketplaceId: data.marketplaceId || 'EBAY_US',
        siteId: 0,
        isDefault: data.isDefault || false,
        isActive: true,
        isConnected: false,
      },
    });

    this.logger.log(`Created eBay connection ${connection.id} for tenant ${tenantId}`);
    return connection;
  }

  /**
   * Get all eBay connections for current tenant
   */
  async getConnections() {
    const tenantId = this.cls.get('tenantId');
    return this.prisma.marketplaceConnection.findMany({
      where: { tenantId, platform: 'EBAY', isActive: true },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  /**
   * Get connection by ID
   * When tenantId is provided explicitly, it is used directly (e.g. OAuth callback, scheduled jobs).
   * When omitted, the tenant is read from CLS context.
   */
  async getConnection(connectionId: string, tenantId?: string) {
    const resolvedTenantId = tenantId ?? this.cls.get('tenantId');
    const connection = await this.prisma.marketplaceConnection.findFirst({
      where: { id: connectionId, tenantId: resolvedTenantId, platform: 'EBAY' },
    });

    if (!connection) {
      throw new NotFoundException(`eBay connection ${connectionId} not found`);
    }

    return connection;
  }

  /**
   * Get default connection
   */
  async getDefaultConnection() {
    const tenantId = this.cls.get('tenantId');
    return this.prisma.marketplaceConnection.findFirst({
      where: { tenantId, platform: 'EBAY', isDefault: true, isActive: true },
    });
  }

  /**
   * Save OAuth tokens for a connection
   */
  async saveTokens(
    connectionId: string,
    tokens: {
      refreshToken: string;
      accessToken?: string;
      accessTokenExpiry?: Date;
    }
  ) {
    await this.prisma.marketplaceConnection.update({
      where: { id: connectionId },
      data: {
        refreshToken: this.encryption.encrypt(tokens.refreshToken),
        accessToken: tokens.accessToken ? this.encryption.encrypt(tokens.accessToken) : null,
        accessTokenExpiry: tokens.accessTokenExpiry,
        isConnected: true,
      },
    });

    // Clear cached client
    this.clientCache.delete(connectionId);

    this.logger.log(`Saved OAuth tokens for connection ${connectionId}`);
  }

  /**
   * Initialize eBay client for a connection
   */
  private async initClient(connectionId: string, tenantId?: string): Promise<eBayApi> {
    const connection = await this.getConnection(connectionId, tenantId);
    const { appId, certId, devId, ruName } = this.getEbayCredentials();

    if (!appId || !certId || !ruName) {
      throw new Error('eBay API credentials not configured');
    }

    return new eBayApi({
      appId,
      certId,
      devId: devId || undefined,
      ruName,
      sandbox: process.env.EBAY_SANDBOX === 'true',
      siteId: connection.siteId || 0,
    });
  }

  /**
   * Get authenticated eBay client for a connection
   * Handles token refresh automatically.
   * When tenantId is provided explicitly, it is used directly instead of CLS.
   */
  async getClient(connectionId: string, tenantId?: string): Promise<eBayApi> {
    if (this.mockMode) {
      // Return a minimal mock client — EbayClientService will intercept all calls in mock mode
      return {} as eBayApi;
    }

    // Check cache
    const cached = this.clientCache.get(connectionId);
    if (cached && Date.now() < cached.expiry) {
      return cached.client;
    }

    const connection = await this.getConnection(connectionId, tenantId);

    if (!connection.refreshToken) {
      throw new Error(`Connection ${connection.name} is not authenticated. Please complete OAuth flow.`);
    }

    const refreshToken = this.encryption.decrypt(connection.refreshToken);
    const client = await this.initClient(connectionId, tenantId);

    // Check if we have a valid cached access token
    if (
      connection.accessToken &&
      connection.accessTokenExpiry &&
      new Date() < connection.accessTokenExpiry
    ) {
      const accessToken = this.encryption.decrypt(connection.accessToken);
      const expiresIn = Math.floor((connection.accessTokenExpiry.getTime() - Date.now()) / 1000);

      client.OAuth2.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: expiresIn,
        token_type: 'Bearer',
      });

      this.clientCache.set(connectionId, {
        client,
        expiry: connection.accessTokenExpiry.getTime() - this.TOKEN_BUFFER_MS,
      });

      return client;
    }

    // Phase 3 W3.4: serialize the refresh via a Redis distributed lock so
    // concurrent pods don't both call eBay's refresh endpoint and race on
    // the DB write. The lock TTL is generous (60s) because the network
    // round-trip plus DB write should complete in single-digit seconds; if
    // the lock is held by another pod we wait for it to finish, then re-call
    // getClient() — by then the cache is warm with the rotated token.
    const lockKey = `ebay:tokenRefresh:${connectionId}`;
    const acquired = await this.lockService.tryAcquire(lockKey, 60_000);
    if (!acquired) {
      // Another pod is refreshing. Brief sleep then retry getClient(); the
      // refresh should be done by then.
      await new Promise((resolve) => setTimeout(resolve, 250));
      return this.getClient(connectionId, tenantId);
    }

    let tokens: EbayTokenResponse;
    try {
      tokens = await this.refreshAccessToken(refreshToken);
    } catch (error: any) {
      await this.lockService.release(lockKey, acquired).catch(() => {});
      // H2: If token is revoked, mark connection as disconnected
      if (error?.isTokenRevoked) {
        await this.prisma.marketplaceConnection.update({
          where: { id: connectionId },
          data: {
            isConnected: false,
            accessToken: null,
            accessTokenExpiry: null,
          },
        });
        this.clientCache.delete(connectionId);
        this.logger.error(`Connection ${connectionId} disconnected due to revoked token`);
      }
      throw error;
    }

    client.OAuth2.setCredentials({
      access_token: tokens.access_token,
      refresh_token: refreshToken,
      expires_in: tokens.expires_in,
      token_type: tokens.token_type,
    });

    const expiresInMs = tokens.expires_in * 1000;
    const expiry = Date.now() + expiresInMs;

    // Save new access token
    await this.prisma.marketplaceConnection.update({
      where: { id: connectionId },
      data: {
        accessToken: this.encryption.encrypt(tokens.access_token),
        accessTokenExpiry: new Date(expiry),
      },
    });

    this.clientCache.set(connectionId, {
      client,
      expiry: expiry - this.TOKEN_BUFFER_MS,
    });

    // Phase 3 W3.4: release the refresh lock now that the rotated token is
    // both persisted and cached.
    await this.lockService.release(lockKey, acquired).catch(() => {});

    this.logger.log(`Refreshed access token for connection ${connectionId}`);
    return client;
  }

  /**
   * Refresh access token using refresh token.
   * Respects EBAY_SANDBOX env var to use the correct endpoint.
   */
  private async refreshAccessToken(refreshToken: string): Promise<EbayTokenResponse> {
    if (this.mockMode) {
      return { access_token: 'mock_access_token', refresh_token: refreshToken, expires_in: 7200, token_type: 'Bearer' };
    }

    // M5: Check OAuth token rate limit before making the request
    if (!(await this.checkTokenRateLimit('refresh_token'))) {
      throw new Error('eBay OAuth refresh_token daily rate limit reached. Try again tomorrow.');
    }

    const { appId, certId } = this.getEbayCredentials();
    const isSandbox = process.env.EBAY_SANDBOX === 'true';
    const tokenEndpoint = isSandbox
      ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
      : 'https://api.ebay.com/identity/v1/oauth2/token';

    const credentials = Buffer.from(`${appId}:${certId}`).toString('base64');

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Token refresh failed: ${response.status} - ${errorText}`);

      // H2: Detect revoked/invalid refresh tokens
      if (response.status === 400 || response.status === 401) {
        const isRevoked = errorText.includes('invalid_grant') ||
          errorText.includes('token') ||
          errorText.includes('revoked') ||
          errorText.includes('expired');

        if (isRevoked) {
          this.logger.error(
            `Refresh token appears to be revoked or expired. User must re-authenticate.`
          );
          // Mark connection as disconnected so UI shows re-auth prompt
          // We can't update DB here without connectionId, so throw a specific error
          const err = new Error('eBay refresh token revoked. Please reconnect your eBay account.');
          (err as any).isTokenRevoked = true;
          throw err;
        }
      }

      throw new Error(`Failed to refresh eBay access token: ${response.status}`);
    }

    return response.json();
  }

  /**
   * M5: Track OAuth token request counts per grant type per day.
   * Uses Redis for distributed counting across instances, with in-memory fallback.
   * Returns true if the request should proceed, false if limit would be exceeded.
   */
  private async checkTokenRateLimit(grantType: string): Promise<boolean> {
    const limit = this.TOKEN_DAILY_LIMITS[grantType] || 10_000;
    const today = new Date().toISOString().split('T')[0];
    const key = `ebay:rate:token:${grantType}:${today}`;

    try {
      const redis = this.getRedis();

      // Check current count before incrementing
      const currentVal = await redis.get(key);
      const currentCount = currentVal !== null ? parseInt(currentVal, 10) : 0;
      if (currentCount >= limit) {
        this.logger.error(`OAuth ${grantType} daily limit EXCEEDED: ${currentCount}/${limit}`);
        return false;
      }

      // Atomic increment
      const newCount = await redis.incr(key);
      if (newCount === 1) {
        await redis.expire(key, this.getEndOfDayTtl());
      }

      if (newCount >= limit * 0.9) {
        this.logger.warn(
          `OAuth ${grantType} daily limit warning: ${newCount}/${limit} (90% threshold)`
        );
      }
      if (newCount > limit) {
        this.logger.error(`OAuth ${grantType} daily limit EXCEEDED: ${newCount}/${limit}`);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.warn(`Redis token rate limit failed: ${error?.message}. Falling back to in-memory.`);
      this.redisAvailable = false;

      // Fallback to in-memory
      const now = Date.now();
      const entry = this.tokenRateLimitsFallback.get(grantType);

      if (!entry || now >= entry.resetAt) {
        this.tokenRateLimitsFallback.set(grantType, {
          count: 1,
          resetAt: now + 24 * 60 * 60 * 1000,
        });
        return true;
      }

      if (entry.count >= limit * 0.9) {
        this.logger.warn(
          `OAuth ${grantType} daily limit warning: ${entry.count}/${limit} (90% threshold)`
        );
      }
      if (entry.count >= limit) {
        this.logger.error(`OAuth ${grantType} daily limit EXCEEDED: ${entry.count}/${limit}`);
        return false;
      }

      entry.count++;
      return true;
    }
  }

  /**
   * Fetch and save business policies after OAuth.
   * When tenantId is provided explicitly (e.g. from OAuth callback), it is passed
   * through to getClient/getConnection instead of relying on CLS.
   */
  async fetchAndSaveBusinessPolicies(connectionId: string, tenantId?: string) {
    if (this.mockMode) {
      const mockPolicies = {
        fulfillmentPolicyId: 'mock_fp_1',
        paymentPolicyId: 'mock_pp_1',
        returnPolicyId: 'mock_rp_1',
        locationKey: 'mock_loc_1',
      };
      await this.prisma.marketplaceConnection.update({
        where: { id: connectionId },
        data: mockPolicies,
      });
      this.logger.log(`[MOCK] Saved mock business policies for connection ${connectionId}`);
      return mockPolicies;
    }

    const connection = await this.getConnection(connectionId, tenantId);
    const client = await this.getClient(connectionId, tenantId);

    try {
      // Fetch policies
      const [fulfillmentPolicies, paymentPolicies, returnPolicies] = await Promise.all([
        client.sell.account.getFulfillmentPolicies(connection.marketplaceId as any),
        client.sell.account.getPaymentPolicies(connection.marketplaceId as any),
        client.sell.account.getReturnPolicies(connection.marketplaceId as any),
      ]);

      // Use first policy of each type (or let user select later)
      const fulfillmentPolicyId = fulfillmentPolicies.fulfillmentPolicies?.[0]?.fulfillmentPolicyId;
      const paymentPolicyId = paymentPolicies.paymentPolicies?.[0]?.paymentPolicyId;
      const returnPolicyId = returnPolicies.returnPolicies?.[0]?.returnPolicyId;

      // Get inventory location
      const locations = await client.sell.inventory.getInventoryLocations();
      const locationKey = locations.locations?.[0]?.merchantLocationKey;

      await this.prisma.marketplaceConnection.update({
        where: { id: connectionId },
        data: {
          fulfillmentPolicyId,
          paymentPolicyId,
          returnPolicyId,
          locationKey,
        },
      });

      this.logger.log(`Fetched business policies for connection ${connectionId}`);
      return { fulfillmentPolicyId, paymentPolicyId, returnPolicyId, locationKey };
    } catch (error) {
      this.logger.error(`Failed to fetch business policies`, error);
      throw error;
    }
  }

  /**
   * Check if connection is ready for creating listings
   */
  async isConnectionReady(connectionId: string): Promise<boolean> {
    const connection = await this.getConnection(connectionId);
    return !!(
      connection.isConnected &&
      connection.fulfillmentPolicyId &&
      connection.paymentPolicyId &&
      connection.returnPolicyId
    );
  }

  /**
   * Get connection status for UI
   */
  async getConnectionStatus(connectionId: string) {
    const connection = await this.getConnection(connectionId);
    const hasCredentials = this.hasCredentials();
    const isConnected = !!(connection.refreshToken && connection.isConnected);
    const hasPolicies = !!(
      connection.fulfillmentPolicyId &&
      connection.paymentPolicyId &&
      connection.returnPolicyId
    );

    return {
      hasCredentials,
      isConnected,
      hasPolicies,
      canPublishListings: hasCredentials && isConnected && hasPolicies,
      marketplaceId: connection.marketplaceId,
    };
  }

  /**
   * Disconnect (clear tokens).
   * Verifies the connection belongs to the current tenant first.
   *
   * E-2: also calls eBay's OAuth revocation endpoint with the refresh token
   * BEFORE nulling our DB columns. Without revocation the refresh token
   * remains live on eBay's side until it expires (18 months), so a
   * compromised DB backup could be replayed to mint fresh access tokens.
   * The revoke is best-effort: if eBay returns a non-200 we still clear our
   * local copy — leaving stale credentials in the DB after a user-initiated
   * disconnect would be worse than failing to revoke remotely.
   */
  async disconnectConnection(connectionId: string) {
    const connection = await this.getConnection(connectionId);

    if (connection.refreshToken && !this.mockMode) {
      try {
        const refreshToken = this.encryption.decrypt(connection.refreshToken);
        await this.revokeRefreshToken(refreshToken);
      } catch (err) {
        // Best-effort. We log and continue — the user expects disconnection
        // to succeed even if eBay rejects the revoke request.
        this.logger.warn(
          `Failed to revoke refresh token for connection ${connectionId}: ${
            (err as Error).message
          }. Local credentials cleared anyway.`,
        );
      }
    }

    await this.prisma.marketplaceConnection.update({
      where: { id: connectionId },
      data: {
        refreshToken: null,
        accessToken: null,
        accessTokenExpiry: null,
        isConnected: false,
      },
    });

    this.clientCache.delete(connectionId);
    this.logger.log(`Disconnected connection ${connectionId}`);
  }

  /**
   * Revoke a refresh token at eBay's OAuth endpoint.
   * https://developer.ebay.com/api-docs/static/oauth-revoke.html
   */
  private async revokeRefreshToken(refreshToken: string): Promise<void> {
    const { appId, certId } = this.getEbayCredentials();
    if (!appId || !certId) {
      throw new Error('eBay credentials not configured; cannot revoke token');
    }

    const isSandbox = process.env['EBAY_SANDBOX'] === 'true';
    const revokeEndpoint = isSandbox
      ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/revoke'
      : 'https://api.ebay.com/identity/v1/oauth2/revoke';

    const credentials = Buffer.from(`${appId}:${certId}`).toString('base64');

    const body = new URLSearchParams({
      token: refreshToken,
      token_type_hint: 'refresh_token',
    }).toString();

    const response = await fetch(revokeEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body,
    });

    // Per RFC 7009, the server SHOULD return 200 even for already-invalid
    // tokens. eBay follows this. We treat any non-2xx as a failure.
    if (!response.ok) {
      const errorText = await response.text().catch(() => '<no body>');
      throw new Error(
        `eBay token revoke failed: ${response.status} - ${errorText}`,
      );
    }
  }

  /**
   * Delete connection.
   * Verifies the connection belongs to the current tenant before deleting.
   */
  async deleteConnection(connectionId: string) {
    const tenantId = this.cls.get('tenantId');

    // Verify connection exists and belongs to the current tenant
    const connection = await this.getConnection(connectionId);

    // Check if connection has any associated data
    const [listingCount, orderCount] = await Promise.all([
      this.prisma.marketplaceListing.count({ where: { connectionId, tenantId } }),
      this.prisma.marketplaceOrder.count({ where: { connectionId, tenantId } }),
    ]);

    if (listingCount > 0 || orderCount > 0) {
      throw new Error(
        'Cannot delete connection with associated listings or orders. Deactivate it instead.'
      );
    }

    await this.prisma.marketplaceConnection.delete({ where: { id: connection.id } });
    this.clientCache.delete(connectionId);
    this.logger.log(`Deleted connection ${connectionId}`);
  }

  /**
   * Set vacation mode on the eBay store via Trading API SetStore.
   * When enabled=true, sets OnVacation=true and an optional return message.
   * When enabled=false, disables vacation mode.
   */
  async setVacationMode(
    connectionId: string,
    enabled: boolean,
    returnMessage?: string
  ): Promise<{ success: boolean; onVacation: boolean; returnMessage?: string }> {
    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Set vacation mode to ${enabled ? 'ON' : 'OFF'} for connection ${connectionId}`
      );
      return {
        success: true,
        onVacation: enabled,
        returnMessage: enabled ? returnMessage : undefined,
      };
    }

    const client = await this.getClient(connectionId);

    try {
      const storePayload: any = {
        Store: {
          Vacation: {
            OnVacation: enabled,
          },
        },
      };

      if (enabled) {
        storePayload.Store.Vacation.MessageItem = returnMessage || '';
        storePayload.Store.Vacation.ReturnDate = null;
      }

      await (client as any).trading.SetStore(storePayload);

      this.logger.log(
        `Set vacation mode to ${enabled ? 'ON' : 'OFF'} for connection ${connectionId}`
      );

      return {
        success: true,
        onVacation: enabled,
        returnMessage: enabled ? returnMessage : undefined,
      };
    } catch (error) {
      this.logger.error(
        `Failed to set vacation mode for connection ${connectionId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Get current vacation mode status from eBay store via Trading API GetStore.
   * Returns whether the store is on vacation and any configured return message.
   */
  async getVacationMode(
    connectionId: string
  ): Promise<{ onVacation: boolean; returnMessage?: string }> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Fetched vacation mode for connection ${connectionId}`);
      return {
        onVacation: false,
        returnMessage: undefined,
      };
    }

    const client = await this.getClient(connectionId);

    try {
      const response = await (client as any).trading.GetStore({});

      const vacation = response?.Store?.Vacation;
      const onVacation = vacation?.OnVacation === true || vacation?.OnVacation === 'true';
      const returnMessage = vacation?.MessageItem || undefined;

      this.logger.log(
        `Fetched vacation mode for connection ${connectionId}: ${onVacation ? 'ON' : 'OFF'}`
      );

      return {
        onVacation,
        returnMessage: onVacation ? returnMessage : undefined,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get vacation mode for connection ${connectionId}`,
        error
      );
      throw error;
    }
  }
}
