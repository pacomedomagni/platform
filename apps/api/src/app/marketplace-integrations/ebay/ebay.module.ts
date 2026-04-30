import { Module } from '@nestjs/common';
import { DbModule } from '@platform/db';
import { OperationsModule } from '../../operations/operations.module';
import { WorkersModule } from '../../workers/workers.module';
import { EncryptionService } from '../shared/encryption.service';
import { MarketplaceAuditService } from '../shared/marketplace-audit.service';
import { DistributedLockService } from '../shared/distributed-lock.service';
import { EbayClientService } from './ebay-client.service';
import { EbayStoreService } from './ebay-store.service';
import { EbayAuthService } from './ebay-auth.service';
import { EbayAuthController } from './ebay-auth.controller';
import { EbayListingsService } from './ebay-listings.service';
import { EbayListingsController } from './ebay-listings.controller';
import { EbayOrderSyncService } from './ebay-order-sync.service';
import { EbayOrdersController } from './ebay-orders.controller';
import { EbayWebhookService } from './ebay-webhook.service';
import { EbayWebhookController } from './ebay-webhook.controller';
import { EbayNotificationService } from './ebay-notification.service';
import { EbayReturnsService } from './ebay-returns.service';
import { EbayReturnsController } from './ebay-returns.controller';
import { EbayMessagingService } from './ebay-messaging.service';
import { EbayMessagingController } from './ebay-messaging.controller';
import { EbayTaxonomyService } from './ebay-taxonomy.service';
import { EbayTaxonomyController } from './ebay-taxonomy.controller';
import { EbayOffersService } from './ebay-offers.service';
import { EbayOffersController } from './ebay-offers.controller';
import { EbayAnalyticsService } from './ebay-analytics.service';
import { EbayAnalyticsController } from './ebay-analytics.controller';
import { EbayFinancesService } from './ebay-finances.service';
import { EbayFinancesController } from './ebay-finances.controller';
import { EbayCampaignsService } from './ebay-campaigns.service';
import { EbayCampaignsController } from './ebay-campaigns.controller';
import { EbayPromotionsService } from './ebay-promotions.service';
import { EbayPromotionsController } from './ebay-promotions.controller';
import { EbayStoreCategoriesService } from './ebay-store-categories.service';
import { EbayStoreCategoriesController } from './ebay-store-categories.controller';
import { EbayBulkService } from './ebay-bulk.service';
import { EbayBulkController } from './ebay-bulk.controller';
import { EbayShippingService } from './ebay-shipping.service';
import { EbayShippingController } from './ebay-shipping.controller';
import { EbayComplianceService } from './ebay-compliance.service';
import { EbayComplianceController } from './ebay-compliance.controller';
import { EbayFeedbackService } from './ebay-feedback.service';
import { EbayFeedbackController } from './ebay-feedback.controller';
import { EbayNegotiationsService } from './ebay-negotiations.service';
import { EbayNegotiationsController } from './ebay-negotiations.controller';
import { EbayEmailCampaignsService } from './ebay-email-campaigns.service';
import { EbayEmailCampaignsController } from './ebay-email-campaigns.controller';
import { EbayCrossBorderService } from './ebay-cross-border.service';
import { EbayCrossBorderController } from './ebay-cross-border.controller';
import { EbayCancellationsService } from './ebay-cancellations.service';
import { EbayCancellationsController } from './ebay-cancellations.controller';
import { EbayRbacService } from './ebay-rbac.service';
import { EbayRbacController } from './ebay-rbac.controller';
import { EbayCatalogService } from './ebay-catalog.service';
import { EbayCatalogController } from './ebay-catalog.controller';
import { EbayInquiriesService } from './ebay-inquiries.service';
import { EbayInquiriesController } from './ebay-inquiries.controller';
import { EbayDisputesService } from './ebay-disputes.service';
import { EbayDisputesController } from './ebay-disputes.controller';
import { EbayKeywordsService } from './ebay-keywords.service';
import { EbayKeywordsController } from './ebay-keywords.controller';
import { EbayInventoryLocationsService } from './ebay-inventory-locations.service';
import { EbayInventoryLocationsController } from './ebay-inventory-locations.controller';
import { EbayMediaService } from './ebay-media.service';
import { EbayMediaController } from './ebay-media.controller';
import { EbayPolicyService } from './ebay-policy.service';

/**
 * eBay Integration Module
 * Handles all eBay-related functionality
 */
@Module({
  imports: [DbModule, OperationsModule, WorkersModule],
  controllers: [
    EbayAuthController,
    EbayListingsController,
    EbayOrdersController,
    EbayWebhookController,
    EbayReturnsController,
    EbayMessagingController,
    EbayTaxonomyController,
    EbayOffersController,
    EbayAnalyticsController,
    EbayFinancesController,
    EbayCampaignsController,
    EbayPromotionsController,
    EbayStoreCategoriesController,
    EbayBulkController,
    EbayShippingController,
    EbayComplianceController,
    EbayFeedbackController,
    EbayNegotiationsController,
    EbayEmailCampaignsController,
    EbayCrossBorderController,
    EbayCancellationsController,
    EbayRbacController,
    EbayCatalogController,
    EbayInquiriesController,
    EbayDisputesController,
    EbayKeywordsController,
    EbayInventoryLocationsController,
    EbayMediaController,
  ],
  providers: [
    EncryptionService,
    MarketplaceAuditService,
    DistributedLockService,
    EbayClientService,
    EbayStoreService,
    EbayAuthService,
    EbayListingsService,
    EbayOrderSyncService,
    EbayWebhookService,
    EbayNotificationService,
    EbayReturnsService,
    EbayMessagingService,
    EbayTaxonomyService,
    EbayOffersService,
    EbayAnalyticsService,
    EbayFinancesService,
    EbayCampaignsService,
    EbayPromotionsService,
    EbayStoreCategoriesService,
    EbayBulkService,
    EbayShippingService,
    EbayComplianceService,
    EbayFeedbackService,
    EbayNegotiationsService,
    EbayEmailCampaignsService,
    EbayCrossBorderService,
    EbayCancellationsService,
    EbayRbacService,
    EbayCatalogService,
    EbayInquiriesService,
    EbayDisputesService,
    EbayKeywordsService,
    EbayInventoryLocationsService,
    EbayMediaService,
    EbayPolicyService,
  ],
  exports: [
    EbayClientService,
    EbayStoreService,
    EbayAuthService,
    EbayListingsService,
    EbayOrderSyncService,
    EbayWebhookService,
    EbayNotificationService,
    EbayReturnsService,
    EbayMessagingService,
    EbayTaxonomyService,
    EbayOffersService,
    EbayAnalyticsService,
    EbayFinancesService,
    EbayCampaignsService,
    EbayPromotionsService,
    EbayStoreCategoriesService,
    EbayBulkService,
    EbayShippingService,
    EbayComplianceService,
    EbayFeedbackService,
    EbayNegotiationsService,
    EbayEmailCampaignsService,
    EbayCrossBorderService,
    EbayCancellationsService,
    EbayRbacService,
    EbayCatalogService,
    EbayInquiriesService,
    EbayDisputesService,
    EbayKeywordsService,
    EbayInventoryLocationsService,
    EbayMediaService,
    EbayPolicyService,
  ],
})
export class EbayModule {}
