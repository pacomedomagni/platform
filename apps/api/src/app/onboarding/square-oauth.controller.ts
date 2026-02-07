import { Controller, Get, Query, Res, Logger } from '@nestjs/common';
import { Response } from 'express';
import { SquareOAuthService } from './square-oauth.service';

@Controller('onboarding/square')
export class SquareOAuthController {
  private readonly logger = new Logger(SquareOAuthController.name);

  constructor(private readonly squareOAuth: SquareOAuthService) {}

  /**
   * GET /api/onboarding/square/callback?code=xxx&state=xxx
   * Square OAuth callback — exchanges code for tokens and redirects to frontend
   */
  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const frontendUrl = process.env['FRONTEND_URL'] || 'http://localhost:4200';

    if (!code || !state) {
      this.logger.warn('Square OAuth callback missing code or state');
      return res.redirect(
        `${frontendUrl}/onboarding/error?message=missing_params`,
      );
    }

    try {
      const { tenantId } = await this.squareOAuth.handleCallback(code, state);

      return res.redirect(
        `${frontendUrl}/onboarding/${tenantId}/complete?provider=square`,
      );
    } catch (error: any) {
      this.logger.error(`Square OAuth callback failed: ${error.message}`);
      const message = encodeURIComponent(error.message || 'OAuth failed');
      return res.redirect(`${frontendUrl}/onboarding/error?message=${message}`);
    }
  }
}
