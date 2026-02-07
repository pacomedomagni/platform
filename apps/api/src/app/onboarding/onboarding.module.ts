import { Module } from '@nestjs/common';
import { DbModule } from '@platform/db';
import { AuthModule } from '@platform/auth';
import { ProvisioningModule } from '../provisioning/provisioning.module';
import { EncryptionService } from '../marketplace-integrations/shared/encryption.service';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { StripeConnectService } from './stripe-connect.service';
import { StripeConnectWebhookController } from './stripe-connect-webhook.controller';
import { SquareOAuthService } from './square-oauth.service';
import { SquareOAuthController } from './square-oauth.controller';
import { SquarePaymentService } from './square-payment.service';

@Module({
  imports: [DbModule, AuthModule, ProvisioningModule],
  controllers: [
    OnboardingController,
    StripeConnectWebhookController,
    SquareOAuthController,
  ],
  providers: [
    OnboardingService,
    StripeConnectService,
    SquareOAuthService,
    SquareOAuthController,
    SquarePaymentService,
    EncryptionService,
  ],
  exports: [StripeConnectService, SquarePaymentService, SquareOAuthService],
})
export class OnboardingModule {}
