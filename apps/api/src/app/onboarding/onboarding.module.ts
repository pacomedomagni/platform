import { Module } from '@nestjs/common';
import { DbModule } from '@platform/db';
import { AuthModule } from '@platform/auth';
import { EmailModule } from '@platform/email';
import { ProvisioningModule } from '../provisioning/provisioning.module';
import { EncryptionService } from '../marketplace-integrations/shared/encryption.service';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { StripeConnectService } from './stripe-connect.service';
import { StripeConnectWebhookController } from './stripe-connect-webhook.controller';
import { SquareOAuthService } from './square-oauth.service';
import { SquareOAuthController } from './square-oauth.controller';
import { SquarePaymentService } from './square-payment.service';
import { MerchantVerificationService } from './merchant-verification.service';
import { MerchantVerificationController } from './merchant-verification.controller';

@Module({
  imports: [
    DbModule,
    AuthModule,
    ProvisioningModule,
    EmailModule.forRoot({
      smtp: {
        host: process.env['SMTP_HOST'] || 'localhost',
        port: parseInt(process.env['SMTP_PORT'] || '587', 10),
        secure: process.env['SMTP_SECURE'] === 'true',
        auth: process.env['SMTP_USER'] ? {
          user: process.env['SMTP_USER'],
          pass: process.env['SMTP_PASS'] || '',
        } : undefined,
      },
      defaults: {
        from: process.env['SMTP_FROM'] || 'noreply@example.com',
      },
      previewMode: process.env['NODE_ENV'] !== 'production',
    }),
  ],
  controllers: [
    OnboardingController,
    StripeConnectWebhookController,
    SquareOAuthController,
    MerchantVerificationController,
  ],
  providers: [
    OnboardingService,
    StripeConnectService,
    SquareOAuthService,
    SquarePaymentService,
    EncryptionService,
    MerchantVerificationService,
  ],
  exports: [StripeConnectService, SquarePaymentService, SquareOAuthService, MerchantVerificationService],
})
export class OnboardingModule {}
