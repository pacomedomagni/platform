import { Module } from '@nestjs/common';
import { EbayModule } from './ebay/ebay.module';
import { ConnectionsController } from './connections/connections.controller';
import { MarketplaceListingsController } from './listings/listings.controller';
import { EbayListingsService } from './ebay/ebay-listings.service';
import { EbayStoreService } from './ebay/ebay-store.service';
import {
  MARKETPLACE_LISTINGS_SERVICE,
  MARKETPLACE_CONNECTIONS_SERVICE,
} from './shared/marketplace-service.interface';

/**
 * Marketplace Integrations Module
 * Parent module for all marketplace integrations (eBay, Amazon, Etsy, etc.)
 *
 * The unified controllers use injected service tokens rather than directly importing
 * eBay-specific services. To add a new marketplace, implement the interface and
 * update the providers below (or add a factory that routes by platform).
 */
@Module({
  imports: [EbayModule],
  controllers: [ConnectionsController, MarketplaceListingsController],
  providers: [
    {
      provide: MARKETPLACE_LISTINGS_SERVICE,
      useExisting: EbayListingsService,
    },
    {
      provide: MARKETPLACE_CONNECTIONS_SERVICE,
      useExisting: EbayStoreService,
    },
  ],
  exports: [EbayModule],
})
export class MarketplaceIntegrationsModule {}
