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
import { MerchantVerificationService } from './merchant-verification.service';
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
    private readonly merchantVerification: MerchantVerificationService,
  ) {}

  /**
   * Public signup — creates tenant + user atomically, starts seed provisioning async, returns JWT.
   * User creation is synchronous (inside the transaction) so a JWT is always returned.
   */
  async signup(dto: SignupDto): Promise<{ tenantId: string; accessToken: string }> {
    // Run tenant + user creation in a serializable transaction to prevent race conditions
    const { tenantId, user } = await this.prisma.$transaction(async (tx) => {
      // 1. Create tenant + admin user atomically (checks uniqueness inside)
      const { tenantId: newTenantId } = await this.provisioningService.createTenantWithUser(tx, {
        businessName: dto.businessName,
        ownerEmail: dto.email,
        ownerPassword: dto.password,
        domain: dto.subdomain,
        baseCurrency: dto.baseCurrency || 'USD',
      });

      // 2. Set payment provider and onboarding step
      await tx.tenant.update({
        where: { id: newTenantId },
        data: {
          email: dto.email,
          paymentProvider: dto.paymentProvider,
          onboardingStep: 'provisioning',
        },
      });

      // 3. Get the user we just created (guaranteed to exist now)
      const createdUser = await tx.user.findFirst({
        where: { email: dto.email, tenantId: newTenantId },
      });

      return { tenantId: newTenantId, user: createdUser! };
    }, { isolationLevel: 'Serializable' });

    // 4. Generate JWT immediately (user always exists at this point)
    const loginResult = await this.authService.login(user);

    // 5. Kick off async seed data provisioning (accounts, warehouse, UOMs, defaults)
    this.provisioningService.provisionSeedDataAsync(tenantId).catch((err) => {
      this.logger.error(`Seed data provisioning failed for tenant ${tenantId}: ${err.message}`);
    });

    // 6. Send email verification (fire-and-forget)
    this.merchantVerification.sendVerificationEmail(user.id).catch((err) => {
      this.logger.error(`Verification email failed for user ${user.id}: ${err.message}`);
    });

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

    // Auto-refresh Stripe status if merchant is stuck in onboarding
    let paymentProviderStatus = tenant.paymentProviderStatus;
    let stripeChargesEnabled = tenant.stripeChargesEnabled;
    if (
      tenant.paymentProvider === 'stripe' &&
      tenant.stripeConnectAccountId &&
      tenant.paymentProviderStatus !== 'active'
    ) {
      try {
        const refreshed = await this.refreshPaymentProviderStatus(tenantId);
        paymentProviderStatus = refreshed.status;
        stripeChargesEnabled = refreshed.chargesEnabled ?? stripeChargesEnabled;
      } catch {
        // Non-critical — use existing values
      }
    }

    return {
      tenantId: tenant.id,
      businessName: tenant.businessName || tenant.name,
      subdomain: tenant.domain,
      onboardingStep: tenant.onboardingStep || 'provisioning',
      provisioningStatus: provisioningStatus.status,
      provisioningProgress: provisioningStatus.progress,
      currentStep: provisioningStatus.currentStep,
      paymentProvider: tenant.paymentProvider,
      paymentProviderStatus,
      stripeChargesEnabled,
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
   * Validates that payment provider is configured before allowing completion
   */
  async completeOnboarding(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Validate prerequisites before completing onboarding
    const provisioningStatus = await this.provisioningService.getProvisioningStatus(tenantId);
    if (provisioningStatus.status !== 'READY') {
      throw new BadRequestException('Provisioning is not yet complete');
    }

    if (tenant.paymentProvider && tenant.paymentProviderStatus !== 'active') {
      throw new BadRequestException('Payment provider must be fully configured before completing onboarding');
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
   * Refresh payment provider status by querying Stripe directly.
   * Fallback for when the webhook doesn't arrive.
   */
  async refreshPaymentProviderStatus(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    if (tenant.paymentProvider === 'stripe' && tenant.stripeConnectAccountId) {
      try {
        const account = await this.stripeConnect.getAccount(tenant.stripeConnectAccountId);
        const isActive = account.charges_enabled && account.details_submitted;

        await this.prisma.tenant.update({
          where: { id: tenantId },
          data: {
            stripeChargesEnabled: account.charges_enabled,
            stripePayoutsEnabled: account.payouts_enabled,
            stripeDetailsSubmitted: account.details_submitted,
            paymentProviderStatus: isActive ? 'active' : 'onboarding',
          },
        });

        this.logger.log(`Refreshed Stripe status for tenant ${tenantId}: charges=${account.charges_enabled}, payouts=${account.payouts_enabled}`);

        return {
          chargesEnabled: account.charges_enabled,
          payoutsEnabled: account.payouts_enabled,
          detailsSubmitted: account.details_submitted,
          status: isActive ? 'active' : 'onboarding',
        };
      } catch (error) {
        this.logger.error(`Failed to refresh Stripe status for tenant ${tenantId}:`, error);
        throw new BadRequestException('Failed to check payment provider status');
      }
    }

    return { status: tenant.paymentProviderStatus || 'unknown' };
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
