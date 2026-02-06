import { Module } from '@nestjs/common';
import { EcommerceController } from './ecommerce.controller';
import { CurrencyShippingController } from './currency-shipping.controller';
import { VariantsService } from './variants.service';
import { ReviewsService } from './reviews.service';
import { GiftCardsService } from './gift-cards.service';
import { WishlistService } from './wishlist.service';
import { CurrencyService } from './currency.service';
import { ShippingService } from './shipping.service';
import { DbModule } from '@platform/db';
import { CustomerAuthModule } from '../auth/customer-auth.module';

@Module({
  imports: [DbModule, CustomerAuthModule],
  controllers: [EcommerceController, CurrencyShippingController],
  providers: [
    VariantsService,
    ReviewsService,
    GiftCardsService,
    WishlistService,
    CurrencyService,
    ShippingService,
  ],
  exports: [
    VariantsService,
    ReviewsService,
    GiftCardsService,
    WishlistService,
    CurrencyService,
    ShippingService,
  ],
})
export class EcommerceModule {}
