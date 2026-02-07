import { Controller, Post, Get, Body, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthGuard, AuthenticatedUser } from '@platform/auth';
import { MerchantVerificationService } from './merchant-verification.service';
import { Request } from 'express';

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

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
  async resendVerification(@Req() req: RequestWithUser) {
    const userId = req.user.userId;
    return this.verificationService.resendVerificationEmail(userId);
  }

  /**
   * GET /api/onboarding/email-status
   * Requires authentication
   */
  @Get('email-status')
  @UseGuards(AuthGuard)
  async getEmailStatus(@Req() req: RequestWithUser) {
    const userId = req.user.userId;
    return this.verificationService.getEmailStatus(userId);
  }
}
