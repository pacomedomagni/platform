import { Module } from '@nestjs/common';
import { EbayModule } from './ebay/ebay.module';
import { ConnectionsController } from './connections/connections.controller';
import { MarketplaceListingsController } from './listings/listings.controller';

/**
 * Marketplace Integrations Module
 * Parent module for all marketplace integrations (eBay, Amazon, Etsy, etc.)
 */
@Module({
  imports: [EbayModule],
  controllers: [ConnectionsController, MarketplaceListingsController],
  exports: [EbayModule],
})
export class MarketplaceIntegrationsModule {}
