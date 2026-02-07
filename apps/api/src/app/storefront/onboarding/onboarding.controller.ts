import { Controller, Get, Post, Body, Req, UseGuards, Param } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: {
    customerId: string;
    tenantId: string;
  };
}

@Controller('store/onboarding')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  /**
   * GET /api/v1/store/onboarding/status
   * Get current onboarding status for authenticated customer
   */
  @Get('status')
  async getStatus(@Req() req: AuthenticatedRequest) {
    const { customerId, tenantId } = req.user;
    return this.onboardingService.getOnboardingStatus(tenantId, customerId);
  }

  /**
   * POST /api/v1/store/onboarding/complete-step
   * Mark a specific onboarding step as completed
   */
  @Post('complete-step')
  async completeStep(
    @Req() req: AuthenticatedRequest,
    @Body() body: { step: string }
  ) {
    const { customerId, tenantId } = req.user;
    return this.onboardingService.completeStep(tenantId, customerId, body.step);
  }

  /**
   * POST /api/v1/store/onboarding/update-step
   * Update current onboarding step (for wizard navigation)
   */
  @Post('update-step')
  async updateStep(
    @Req() req: AuthenticatedRequest,
    @Body() body: { step: string }
  ) {
    const { customerId, tenantId } = req.user;
    await this.onboardingService.updateOnboardingStep(tenantId, customerId, body.step);
    return { success: true };
  }

  /**
   * POST /api/v1/store/onboarding/dismiss
   * Mark onboarding as completed and dismiss
   */
  @Post('dismiss')
  async dismiss(@Req() req: AuthenticatedRequest) {
    const { customerId, tenantId } = req.user;
    await this.onboardingService.dismissOnboarding(tenantId, customerId);
    return { success: true };
  }

  /**
   * GET /api/v1/store/onboarding/progress
   * Get onboarding completion percentage
   */
  @Get('progress')
  async getProgress(@Req() req: AuthenticatedRequest) {
    const { customerId, tenantId } = req.user;
    const progress = await this.onboardingService.getProgress(tenantId, customerId);
    return { progress };
  }

  /**
   * POST /api/v1/store/onboarding/update-profile
   * Update customer profile and recalculate completion score
   */
  @Post('update-profile')
  async updateProfile(
    @Req() req: AuthenticatedRequest,
    @Body() body: { firstName?: string; lastName?: string; phone?: string }
  ) {
    const { customerId, tenantId } = req.user;
    return this.onboardingService.updateProfile(tenantId, customerId, body);
  }

  /**
   * POST /api/v1/store/onboarding/reset-tour
   * Reset product tour to allow viewing again
   */
  @Post('reset-tour')
  async resetTour(@Req() req: AuthenticatedRequest) {
    const { customerId, tenantId } = req.user;
    await this.onboardingService.resetProductTour(tenantId, customerId);
    return { success: true };
  }
}
