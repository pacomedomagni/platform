import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '@platform/auth';
import { Tenant } from '../../../tenant.middleware';
import { EbayAuthService } from './ebay-auth.service';

/**
 * eBay OAuth Authentication Controller
 * Handles OAuth 2.0 flow for connecting eBay stores
 */
@Controller('marketplace/ebay/auth')
export class EbayAuthController {
  constructor(private ebayAuth: EbayAuthService) {}

  /**
   * Initiate OAuth flow
   * GET /api/marketplace/ebay/auth/connect?connectionId=xxx
   */
  @Get('connect')
  @UseGuards(AuthGuard)
  async initiateOAuth(
    @Query('connectionId') connectionId: string,
    @Tenant() tenantId: string,
    @Res() res: Response
  ) {
    if (!connectionId) {
      return res.status(400).json({ error: 'connectionId is required' });
    }

    try {
      const authUrl = await this.ebayAuth.getAuthorizationUrl(connectionId, tenantId);

      // Redirect to eBay OAuth page
      return res.redirect(authUrl);
    } catch (error) {
      return res.status(400).json({
        error: error.message || 'Failed to initiate OAuth flow'
      });
    }
  }

  /**
   * OAuth callback
   * GET /api/marketplace/ebay/auth/callback?code=xxx&state=xxx
   */
  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response
  ) {
    if (!code || !state) {
      return res.redirect('/app/marketplace/connections?error=missing_params');
    }

    try {
      const result = await this.ebayAuth.handleCallback(code, state);

      // Redirect to success page
      return res.redirect(
        `/app/marketplace/connections?success=true&connectionId=${result.connectionId}`
      );
    } catch (error) {
      const errorMessage = encodeURIComponent(error.message || 'OAuth failed');
      return res.redirect(`/app/marketplace/connections?error=${errorMessage}`);
    }
  }
}
