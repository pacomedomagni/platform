import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  ValidationPipe,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard, AuthenticatedUser } from '@platform/auth';
import { OnboardingService } from './onboarding.service';
import { SignupDto } from './dto/signup.dto';
import { Request } from 'express';

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  /**
   * POST /api/onboarding/signup
   * Public endpoint — no authentication required
   */
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: SignupDto,
  ) {
    return this.onboardingService.signup(dto);
  }

  /**
   * GET /api/onboarding/:tenantId/status
   * Requires authentication — poll for provisioning + onboarding status
   */
  @Get(':tenantId/status')
  @UseGuards(AuthGuard)
  async getStatus(
    @Param('tenantId') tenantId: string,
    @Req() req: RequestWithUser,
  ) {
    // Verify user belongs to the requested tenant
    if (req.user.tenantId !== tenantId) {
      throw new ForbiddenException('Access denied');
    }
    return this.onboardingService.getOnboardingStatus(tenantId);
  }

  /**
   * POST /api/onboarding/:tenantId/payment/initiate
   * Requires authentication — generate payment onboarding URL
   */
  @Post(':tenantId/payment/initiate')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async initiatePayment(
    @Param('tenantId') tenantId: string,
    @Req() req: RequestWithUser,
  ) {
    if (req.user.tenantId !== tenantId) {
      throw new ForbiddenException('Access denied');
    }
    const userId = req.user.userId;
    return this.onboardingService.initiatePaymentOnboarding(tenantId, userId);
  }

  /**
   * POST /api/onboarding/:tenantId/complete
   * Requires authentication — mark onboarding as complete
   */
  @Post(':tenantId/complete')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async complete(
    @Param('tenantId') tenantId: string,
    @Req() req: RequestWithUser,
  ) {
    if (req.user.tenantId !== tenantId) {
      throw new ForbiddenException('Access denied');
    }
    return this.onboardingService.completeOnboarding(tenantId);
  }

  /**
   * GET /api/onboarding/:tenantId/payment/refresh
   * Requires authentication — poll Stripe directly for current account status.
   * Fallback for when webhooks don't arrive.
   */
  @Get(':tenantId/payment/refresh')
  @UseGuards(AuthGuard)
  async refreshPaymentStatus(
    @Param('tenantId') tenantId: string,
    @Req() req: RequestWithUser,
  ) {
    if (req.user.tenantId !== tenantId) {
      throw new ForbiddenException('Access denied');
    }
    return this.onboardingService.refreshPaymentProviderStatus(tenantId);
  }

  /**
   * GET /api/onboarding/:tenantId/stripe/dashboard
   * Requires authentication — get Stripe Express dashboard link
   */
  @Get(':tenantId/stripe/dashboard')
  @UseGuards(AuthGuard)
  async getStripeDashboard(
    @Param('tenantId') tenantId: string,
    @Req() req: RequestWithUser,
  ) {
    if (req.user.tenantId !== tenantId) {
      throw new ForbiddenException('Access denied');
    }
    return this.onboardingService.getStripeDashboardLink(tenantId);
  }
}
