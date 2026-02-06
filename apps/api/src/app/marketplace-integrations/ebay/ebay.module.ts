import { Module } from '@nestjs/common';
import { DbModule } from '@platform/db';
import { OperationsModule } from '../../operations/operations.module';
import { EncryptionService } from '../shared/encryption.service';
import { MarketplaceAuditService } from '../shared/marketplace-audit.service';
import { EbayClientService } from './ebay-client.service';
import { EbayStoreService } from './ebay-store.service';
import { EbayAuthService } from './ebay-auth.service';
import { EbayAuthController } from './ebay-auth.controller';
import { EbayListingsService } from './ebay-listings.service';
import { EbayListingsController } from './ebay-listings.controller';

/**
 * eBay Integration Module
 * Handles all eBay-related functionality
 */
@Module({
  imports: [DbModule, OperationsModule],
  controllers: [EbayAuthController, EbayListingsController],
  providers: [
    EncryptionService,
    MarketplaceAuditService,
    EbayClientService,
    EbayStoreService,
    EbayAuthService,
    EbayListingsService,
  ],
  exports: [
    EbayClientService,
    EbayStoreService,
    EbayAuthService,
    EbayListingsService,
  ],
})
export class EbayModule {}
