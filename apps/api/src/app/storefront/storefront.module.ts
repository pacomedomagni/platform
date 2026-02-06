import { Module } from '@nestjs/common';
import { DbModule } from '@platform/db';
import { EmailModule } from '@platform/email';
import { ProductsController } from './products/products.controller';
import { ProductsService } from './products/products.service';
import { CartController } from './cart/cart.controller';
import { CartService } from './cart/cart.service';
import { CheckoutController } from './checkout/checkout.controller';
import { CheckoutService } from './checkout/checkout.service';
import { CustomerAuthModule } from './auth/customer-auth.module';
import { PaymentsController } from './payments/payments.controller';
import { PaymentsService } from './payments/payments.service';
import { StripeService } from './payments/stripe.service';
import { OrdersController } from './orders/orders.controller';
import { OrdersService } from './orders/orders.service';
import { EcommerceModule } from './ecommerce/ecommerce.module';
import { I18nModule } from './i18n/i18n.module';

@Module({
  imports: [
    DbModule,
    CustomerAuthModule,
    EcommerceModule,
    I18nModule,
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
    ProductsController,
    CartController,
    CheckoutController,
    PaymentsController,
    OrdersController,
  ],
  providers: [
    ProductsService,
    CartService,
    CheckoutService,
    PaymentsService,
    StripeService,
    OrdersService,
  ],
  exports: [
    CustomerAuthModule,
    ProductsService,
    CartService,
    CheckoutService,
    PaymentsService,
    StripeService,
    OrdersService,
  ],
})
export class StorefrontModule {}
