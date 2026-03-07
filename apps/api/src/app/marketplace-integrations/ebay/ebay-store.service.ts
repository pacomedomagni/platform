import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { ClsService } from 'nestjs-cls';
import eBayApi from 'ebay-api';
import { EncryptionService } from '../shared/encryption.service';
import { EbayTokenResponse } from '../shared/marketplace.types';

/**
 * eBay Store Management Service
 * Handles multi-store connections, OAuth tokens, and authenticated clients
 */
@Injectable()
export class EbayStoreService {
  private readonly logger = new Logger(EbayStoreService.name);
  private readonly clientCache = new Map<string, { client: eBayApi; expiry: number }>();
  private readonly refreshLocks = new Map<string, Promise<any>>();
  private readonly TOKEN_BUFFER_MS = 60000; // Refresh 1 min before expiry
  private readonly mockMode = process.env.MOCK_EXTERNAL_SERVICES === 'true';

  // M5: OAuth token rate limit tracking per grant type per day
  // eBay limits: 1K client credentials, 10K auth code, 50K refresh per day
  private readonly tokenRateLimits = new Map<string, { count: number; resetAt: number }>();
  private readonly TOKEN_DAILY_LIMITS: Record<string, number> = {
    'client_credentials': 1_000,
    'authorization_code': 10_000,
    'refresh_token': 50_000,
  };

  constructor(
    private prisma: PrismaService,
    private cls: ClsService,
    private encryption: EncryptionService
  ) {}

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

    // Refresh the token (with mutex to prevent concurrent refreshes)
    const existingLock = this.refreshLocks.get(connectionId);
    if (existingLock) {
      await existingLock;
      // After waiting, retry getClient to use the refreshed token
      return this.getClient(connectionId, tenantId);
    }

    const refreshPromise = this.refreshAccessToken(refreshToken)
      .finally(() => this.refreshLocks.delete(connectionId));
    this.refreshLocks.set(connectionId, refreshPromise);

    let tokens: EbayTokenResponse;
    try {
      tokens = await refreshPromise;
    } catch (error: any) {
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
    if (!this.checkTokenRateLimit('refresh_token')) {
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
   * Returns true if the request should proceed, false if limit would be exceeded.
   */
  private checkTokenRateLimit(grantType: string): boolean {
    const now = Date.now();
    const entry = this.tokenRateLimits.get(grantType);

    if (!entry || now >= entry.resetAt) {
      this.tokenRateLimits.set(grantType, {
        count: 1,
        resetAt: now + 24 * 60 * 60 * 1000,
      });
      return true;
    }

    const limit = this.TOKEN_DAILY_LIMITS[grantType] || 10_000;
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
   */
  async disconnectConnection(connectionId: string) {
    // Verify connection belongs to the current tenant
    await this.getConnection(connectionId);

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
