import { Injectable, Logger, BadRequestException, OnModuleDestroy } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '@platform/db';
import { EbayStoreService } from './ebay-store.service';
import eBayApi from 'ebay-api';

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
    private prisma: PrismaService
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

    // Verify connection exists and belongs to tenant
    const connection = await this.ebayStore.getConnection(connectionId);
    if (connection.tenantId !== tenantId) {
      throw new BadRequestException('Connection not found');
    }

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

    // Generate OAuth URL
    const appId = process.env['EBAY_APP_ID'];
    const ruName = process.env['EBAY_RU_NAME'];
    const scopes = [
      'https://api.ebay.com/oauth/api_scope',
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
      'https://api.ebay.com/oauth/api_scope/commerce.identity.readonly',
    ];

    const authUrl = `https://auth.ebay.com/oauth2/authorize?` +
      `client_id=${appId}&` +
      `response_type=code&` +
      `redirect_uri=${encodeURIComponent(ruName)}&` +
      `scope=${encodeURIComponent(scopes.join(' '))}&` +
      `state=${state}`;

    this.logger.log(`Generated OAuth URL for connection ${connectionId}`);
    return authUrl;
  }

  /**
   * Handle OAuth callback and exchange code for tokens
   */
  async handleCallback(code: string, state: string) {
    // Verify state from database
    const stateData = await this.prisma.oAuthState.findUnique({
      where: { id: state },
    });
    if (!stateData) {
      throw new BadRequestException('Invalid or expired OAuth state');
    }

    if (new Date() > stateData.expiresAt) {
      await this.prisma.oAuthState.delete({ where: { id: state } });
      throw new BadRequestException('OAuth state expired. Please try again.');
    }

    const { connectionId, tenantId } = stateData;

    try {
      // Exchange authorization code for tokens
      const tokens = await this.exchangeCodeForTokens(code);

      // Save tokens
      await this.ebayStore.saveTokens(connectionId, {
        refreshToken: tokens.refresh_token,
        accessToken: tokens.access_token,
        accessTokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
      });

      // Fetch and save business policies
      await this.ebayStore.fetchAndSaveBusinessPolicies(connectionId);

      // Clean up state from database
      await this.prisma.oAuthState.delete({ where: { id: state } });

      this.logger.log(`Successfully connected eBay store for connection ${connectionId}`);

      return {
        success: true,
        connectionId,
      };
    } catch (error) {
      this.logger.error(`OAuth callback failed for connection ${connectionId}`, error);
      throw error;
    }
  }

  /**
   * Exchange authorization code for tokens
   */
  private async exchangeCodeForTokens(code: string) {
    const appId = process.env['EBAY_APP_ID'];
    const certId = process.env['EBAY_CERT_ID'];
    const ruName = process.env['EBAY_RU_NAME'];
    const tokenEndpoint = 'https://api.ebay.com/identity/v1/oauth2/token';

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
      throw new Error(`Failed to exchange code for tokens: ${response.status}`);
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
   * Clean up expired OAuth states
   */
  private async cleanupExpiredStates() {
    await this.prisma.oAuthState.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  }
}
