import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '@platform/db';
import { EncryptionService } from '../marketplace-integrations/shared/encryption.service';

@Injectable()
export class SquareOAuthService {
  private readonly logger = new Logger(SquareOAuthService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {
    this.baseUrl =
      process.env['SQUARE_ENVIRONMENT'] === 'production'
        ? 'https://connect.squareup.com'
        : 'https://connect.squareupsandbox.com';
  }

  /**
   * Generate Square OAuth authorization URL
   */
  async getAuthorizationUrl(tenantId: string): Promise<string> {
    const applicationId = process.env['SQUARE_APPLICATION_ID'];
    if (!applicationId) {
      throw new BadRequestException('Square is not configured');
    }

    // Generate cryptographically secure state parameter
    const state = crypto.randomBytes(32).toString('hex');

    // Store state in OAuthState model (already exists from security audit)
    await this.prisma.oAuthState.create({
      data: {
        id: state,
        connectionId: tenantId,
        tenantId,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      },
    });

    const scopes = [
      'MERCHANT_PROFILE_READ',
      'PAYMENTS_WRITE',
      'PAYMENTS_READ',
      'ORDERS_WRITE',
      'ORDERS_READ',
    ].join('+');

    const url =
      `${this.baseUrl}/oauth2/authorize?` +
      `client_id=${applicationId}&` +
      `scope=${scopes}&` +
      `state=${state}&` +
      `session=false`;

    this.logger.log(`Generated Square OAuth URL for tenant ${tenantId}`);
    return url;
  }

  /**
   * Handle OAuth callback — exchange code for tokens, save to tenant
   */
  async handleCallback(code: string, state: string): Promise<{ tenantId: string }> {
    // Verify state
    const stateData = await this.prisma.oAuthState.findUnique({
      where: { id: state },
    });

    if (!stateData) {
      throw new BadRequestException('Invalid or expired OAuth state');
    }

    if (new Date() > stateData.expiresAt) {
      await this.prisma.oAuthState.delete({ where: { id: state } });
      throw new BadRequestException('OAuth state expired — please try again');
    }

    const { tenantId } = stateData;

    // Validate tenant exists
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      await this.prisma.oAuthState.delete({ where: { id: state } });
      throw new BadRequestException('Invalid tenant');
    }

    try {
      // Exchange code for tokens
      const tokens = await this.exchangeCodeForTokens(code);

      // Fetch merchant info
      const merchantInfo = await this.fetchMerchantInfo(tokens.access_token);

      // Encrypt tokens before storage
      const encryptedAccessToken = this.encryption.encrypt(tokens.access_token);
      const encryptedRefreshToken = tokens.refresh_token
        ? this.encryption.encrypt(tokens.refresh_token)
        : null;

      // Calculate expiry (Square access tokens last ~30 days)
      const expiresAt = tokens.expires_at
        ? new Date(tokens.expires_at)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      // Save to tenant
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          squareAccessToken: encryptedAccessToken,
          squareRefreshToken: encryptedRefreshToken,
          squareAccessTokenExpiry: expiresAt,
          squareMerchantId: merchantInfo.merchantId,
          squareLocationId: merchantInfo.locationId,
          paymentProviderStatus: 'active',
          onboardingStep: 'payment_complete',
        },
      });

      // Clean up state
      await this.prisma.oAuthState.delete({ where: { id: state } });

      this.logger.log(
        `Square OAuth complete for tenant ${tenantId}, merchant ${merchantInfo.merchantId}`,
      );

      return { tenantId };
    } catch (error: any) {
      this.logger.error(`Square OAuth callback failed: ${error.message}`);
      // Clean up state on failure - log if cleanup also fails
      await this.prisma.oAuthState.delete({ where: { id: state } }).catch((cleanupErr) => {
        this.logger.warn(`Failed to cleanup OAuth state ${state}: ${cleanupErr.message}`);
      });
      throw new BadRequestException('Failed to connect Square account');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant?.squareRefreshToken) {
      throw new BadRequestException('No Square refresh token available');
    }

    const refreshToken = this.encryption.decrypt(tenant.squareRefreshToken);

    const response = await fetch(`${this.baseUrl}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env['SQUARE_APPLICATION_ID'],
        client_secret: process.env['SQUARE_APPLICATION_SECRET'],
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Square token refresh failed: ${error}`);
      throw new BadRequestException('Failed to refresh Square token');
    }

    const data = await response.json();
    const newAccessToken = data.access_token;
    const encryptedToken = this.encryption.encrypt(newAccessToken);

    const expiresAt = data.expires_at
      ? new Date(data.expires_at)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        squareAccessToken: encryptedToken,
        squareAccessTokenExpiry: expiresAt,
        // Refresh token may also be rotated
        ...(data.refresh_token
          ? { squareRefreshToken: this.encryption.encrypt(data.refresh_token) }
          : {}),
      },
    });

    this.logger.log(`Refreshed Square token for tenant ${tenantId}`);
    return newAccessToken;
  }

  /**
   * Get a valid access token, auto-refreshing if needed
   */
  async getValidAccessToken(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant?.squareAccessToken) {
      throw new BadRequestException('No Square access token available');
    }

    // Refresh if expired or expiring within 1 hour
    const threshold = new Date(Date.now() + 60 * 60 * 1000);
    if (tenant.squareAccessTokenExpiry && tenant.squareAccessTokenExpiry < threshold) {
      return this.refreshAccessToken(tenantId);
    }

    return this.encryption.decrypt(tenant.squareAccessToken);
  }

  /**
   * Exchange authorization code for tokens via Square API
   */
  private async exchangeCodeForTokens(code: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_at: string;
  }> {
    const response = await fetch(`${this.baseUrl}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env['SQUARE_APPLICATION_ID'],
        client_secret: process.env['SQUARE_APPLICATION_SECRET'],
        code,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Square token exchange failed: ${error}`);
      throw new BadRequestException('Failed to exchange code for tokens');
    }

    return response.json();
  }

  /**
   * Fetch merchant info using the access token
   */
  private async fetchMerchantInfo(
    accessToken: string,
  ): Promise<{ merchantId: string; locationId: string }> {
    const apiBase =
      process.env['SQUARE_ENVIRONMENT'] === 'production'
        ? 'https://connect.squareup.com'
        : 'https://connect.squareupsandbox.com';

    const response = await fetch(`${apiBase}/v2/merchants/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new BadRequestException('Failed to fetch Square merchant info');
    }

    const data = await response.json();
    const merchant = data.merchant?.[0] || data.merchant;

    return {
      merchantId: merchant?.id || 'unknown',
      locationId: merchant?.main_location_id || '',
    };
  }
}
