import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { AuthService } from '@platform/auth';
import { ProvisioningService } from '../provisioning/provisioning.service';
import { StripeConnectService } from './stripe-connect.service';
import { SquareOAuthService } from './square-oauth.service';
import { SignupDto } from './dto/signup.dto';

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly provisioningService: ProvisioningService,
    private readonly authService: AuthService,
    private readonly stripeConnect: StripeConnectService,
    private readonly squareOAuth: SquareOAuthService,
  ) {}

  /**
   * Public signup — creates tenant, starts provisioning, returns JWT
   */
  async signup(dto: SignupDto): Promise<{ tenantId: string; accessToken: string }> {
    // 1. Check subdomain availability
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { domain: dto.subdomain },
    });
    if (existingTenant) {
      throw new ConflictException(`Subdomain "${dto.subdomain}" is already taken`);
    }

    // 2. Check email availability
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException(`Email "${dto.email}" is already registered`);
    }

    // 3. Create tenant via existing provisioning service
    const { tenantId } = await this.provisioningService.createTenant({
      businessName: dto.businessName,
      ownerEmail: dto.email,
      ownerPassword: dto.password,
      domain: dto.subdomain,
      baseCurrency: dto.baseCurrency || 'USD',
    });

    // 4. Set payment provider and onboarding step
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        email: dto.email,
        paymentProvider: dto.paymentProvider,
        onboardingStep: 'provisioning',
      },
    });

    // 5. Wait briefly for user creation (provisioning is async but user is created early)
    let user = null;
    for (let i = 0; i < 10; i++) {
      user = await this.prisma.user.findFirst({
        where: { email: dto.email, tenantId },
      });
      if (user) break;
      await new Promise((r) => setTimeout(r, 500));
    }

    if (!user) {
      this.logger.warn(`User not yet created for tenant ${tenantId}, returning tenantId only`);
      return { tenantId, accessToken: '' };
    }

    // 6. Generate JWT (reuse auth service pattern)
    const loginResult = await this.authService.login(user);

    this.logger.log(`Tenant ${tenantId} signed up with ${dto.paymentProvider}`);

    return {
      tenantId,
      accessToken: loginResult.access_token,
    };
  }

  /**
   * Get combined onboarding + provisioning status
   */
  async getOnboardingStatus(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Get provisioning status from Redis
    const provisioningStatus = await this.provisioningService.getProvisioningStatus(tenantId);

    return {
      tenantId: tenant.id,
      businessName: tenant.businessName || tenant.name,
      subdomain: tenant.domain,
      onboardingStep: tenant.onboardingStep || 'provisioning',
      provisioningStatus: provisioningStatus.status,
      provisioningProgress: provisioningStatus.progress,
      currentStep: provisioningStatus.currentStep,
      paymentProvider: tenant.paymentProvider,
      paymentProviderStatus: tenant.paymentProviderStatus,
      stripeChargesEnabled: tenant.stripeChargesEnabled,
      squareMerchantId: tenant.squareMerchantId,
    };
  }

  /**
   * Initiate payment provider onboarding — returns redirect URL
   */
  async initiatePaymentOnboarding(
    tenantId: string,
    userId: string,
  ): Promise<{ url: string; provider: string }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Verify user belongs to tenant
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    });

    if (!user) {
      throw new UnauthorizedException('User does not belong to this tenant');
    }

    const frontendUrl = process.env['FRONTEND_URL'] || 'http://localhost:4200';

    if (tenant.paymentProvider === 'stripe') {
      // Create or reuse Stripe Connect account
      let accountId = tenant.stripeConnectAccountId;
      if (!accountId) {
        accountId = await this.stripeConnect.createConnectAccount(
          tenantId,
          user.email,
          tenant.businessName || tenant.name,
        );
      }

      const url = await this.stripeConnect.getAccountLink(
        accountId,
        `${frontendUrl}/onboarding/${tenantId}/complete?provider=stripe`,
        `${frontendUrl}/onboarding/${tenantId}`,
      );

      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { onboardingStep: 'payment' },
      });

      return { url, provider: 'stripe' };
    }

    if (tenant.paymentProvider === 'square') {
      const url = await this.squareOAuth.getAuthorizationUrl(tenantId);

      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { onboardingStep: 'payment' },
      });

      return { url, provider: 'square' };
    }

    throw new BadRequestException('No payment provider configured');
  }

  /**
   * Mark onboarding as complete
   */
  async completeOnboarding(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        onboardingStep: 'completed',
        onboardingCompletedAt: new Date(),
      },
    });

    this.logger.log(`Tenant ${tenantId} completed onboarding`);

    return { success: true };
  }

  /**
   * Get Stripe Express dashboard link for merchant
   */
  async getStripeDashboardLink(tenantId: string): Promise<{ url: string }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant?.stripeConnectAccountId) {
      throw new BadRequestException('No Stripe account connected');
    }

    const url = await this.stripeConnect.createLoginLink(tenant.stripeConnectAccountId);
    return { url };
  }
}
