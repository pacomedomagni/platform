import { Module } from '@nestjs/common';
import { DbModule } from '@platform/db';
import { ProductsController } from './products/products.controller';
import { ProductsService } from './products/products.service';
import { CartController } from './cart/cart.controller';
import { CartService } from './cart/cart.service';
import { CheckoutController } from './checkout/checkout.controller';
import { CheckoutService } from './checkout/checkout.service';
import { CustomerAuthController } from './auth/customer-auth.controller';
import { CustomerAuthService } from './auth/customer-auth.service';
import { PaymentsController } from './payments/payments.controller';
import { PaymentsService } from './payments/payments.service';
import { StripeService } from './payments/stripe.service';
import { OrdersController } from './orders/orders.controller';
import { OrdersService } from './orders/orders.service';

@Module({
  imports: [DbModule],
  controllers: [
    ProductsController,
    CartController,
    CheckoutController,
    CustomerAuthController,
    PaymentsController,
    OrdersController,
  ],
  providers: [
    ProductsService,
    CartService,
    CheckoutService,
    CustomerAuthService,
    PaymentsService,
    StripeService,
    OrdersService,
  ],
  exports: [
    ProductsService,
    CartService,
    CheckoutService,
    CustomerAuthService,
    PaymentsService,
    StripeService,
    OrdersService,
  ],
})
export class StorefrontModule {}
