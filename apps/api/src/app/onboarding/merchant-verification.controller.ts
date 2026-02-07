import { Controller, Post, Get, Body, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '@platform/auth';
import { MerchantVerificationService } from './merchant-verification.service';

@Controller('onboarding')
export class MerchantVerificationController {
  constructor(private readonly verificationService: MerchantVerificationService) {}

  /**
   * POST /api/onboarding/verify-email
   * Public endpoint — verification is token-based
   */
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() body: { token: string }) {
    return this.verificationService.verifyEmail(body.token);
  }

  /**
   * POST /api/onboarding/resend-verification
   * Requires authentication
   */
  @Post('resend-verification')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async resendVerification(@Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    return this.verificationService.resendVerificationEmail(userId);
  }

  /**
   * GET /api/onboarding/email-status
   * Requires authentication
   */
  @Get('email-status')
  @UseGuards(AuthGuard)
  async getEmailStatus(@Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    return this.verificationService.getEmailStatus(userId);
  }
}
