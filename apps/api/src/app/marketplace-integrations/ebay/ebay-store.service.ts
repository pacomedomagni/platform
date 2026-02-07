import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { ClsService } from 'nestjs-cls';
import eBayApi from 'ebay-api';
import { EncryptionService } from '../shared/encryption.service';
import { EbayTokenResponse, EbayBusinessPolicies } from '../shared/marketplace.types';

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
   */
  async getConnection(connectionId: string) {
    const tenantId = this.cls.get('tenantId');
    const connection = await this.prisma.marketplaceConnection.findFirst({
      where: { id: connectionId, tenantId, platform: 'EBAY' },
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
  private async initClient(connectionId: string): Promise<eBayApi> {
    const connection = await this.getConnection(connectionId);
    const { appId, certId, devId, ruName } = this.getEbayCredentials();

    if (!appId || !certId || !ruName) {
      throw new Error('eBay API credentials not configured');
    }

    return new eBayApi({
      appId,
      certId,
      devId: devId || undefined,
      ruName,
      sandbox: false,
      siteId: connection.siteId || 0,
    });
  }

  /**
   * Get authenticated eBay client for a connection
   * Handles token refresh automatically
   */
  async getClient(connectionId: string): Promise<eBayApi> {
    // Check cache
    const cached = this.clientCache.get(connectionId);
    if (cached && Date.now() < cached.expiry) {
      return cached.client;
    }

    const connection = await this.getConnection(connectionId);

    if (!connection.refreshToken) {
      throw new Error(`Connection ${connection.name} is not authenticated. Please complete OAuth flow.`);
    }

    const refreshToken = this.encryption.decrypt(connection.refreshToken);
    const client = await this.initClient(connectionId);

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
      return this.getClient(connectionId);
    }

    const refreshPromise = this.refreshAccessToken(refreshToken)
      .finally(() => this.refreshLocks.delete(connectionId));
    this.refreshLocks.set(connectionId, refreshPromise);

    const tokens = await refreshPromise;

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
   * Refresh access token using refresh token
   */
  private async refreshAccessToken(refreshToken: string): Promise<EbayTokenResponse> {
    const { appId, certId } = this.getEbayCredentials();
    const tokenEndpoint = 'https://api.ebay.com/identity/v1/oauth2/token';

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
      throw new Error(`Failed to refresh eBay access token: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Fetch and save business policies after OAuth
   */
  async fetchAndSaveBusinessPolicies(connectionId: string) {
    const client = await this.getClient(connectionId);
    const connection = await this.getConnection(connectionId);

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
   * Disconnect (clear tokens)
   */
  async disconnectConnection(connectionId: string) {
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
   * Delete connection
   */
  async deleteConnection(connectionId: string) {
    const tenantId = this.cls.get('tenantId');

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

    await this.prisma.marketplaceConnection.delete({ where: { id: connectionId, tenantId } });
    this.clientCache.delete(connectionId);
    this.logger.log(`Deleted connection ${connectionId}`);
  }
}
