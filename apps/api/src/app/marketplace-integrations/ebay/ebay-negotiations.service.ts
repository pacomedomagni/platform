import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { ClsService } from 'nestjs-cls';
import { EbayStoreService } from './ebay-store.service';

/**
 * eBay Negotiations Service
 * Manages negotiated pricing offers to interested buyers via the eBay Sell Negotiation API.
 * Supports finding eligible items, sending offers, and retrieving active offers.
 */
@Injectable()
export class EbayNegotiationsService {
  private readonly logger = new Logger(EbayNegotiationsService.name);
  private readonly mockMode = process.env.MOCK_EXTERNAL_SERVICES === 'true';

  constructor(
    private prisma: PrismaService,
    private cls: ClsService,
    private ebayStore: EbayStoreService
  ) {}

  /**
   * Find items eligible for sending negotiated pricing offers to watchers/interested buyers.
   */
  async findEligibleItems(
    connectionId: string,
    params?: { limit?: number; offset?: number }
  ): Promise<any> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Fetched eligible items for connection ${connectionId}`);
      return {
        eligibleItems: [
          {
            listingId: 'mock_listing_001',
            title: 'Vintage Watch - Excellent Condition',
            currentPrice: { value: '149.99', currency: 'USD' },
            watchCount: 12,
            eligibleForOffer: true,
          },
          {
            listingId: 'mock_listing_002',
            title: 'Collectible Card Set - Complete',
            currentPrice: { value: '89.99', currency: 'USD' },
            watchCount: 8,
            eligibleForOffer: true,
          },
          {
            listingId: 'mock_listing_003',
            title: 'Handmade Ceramic Mug Set',
            currentPrice: { value: '34.99', currency: 'USD' },
            watchCount: 5,
            eligibleForOffer: true,
          },
        ],
        total: 3,
        limit: params?.limit || 25,
        offset: params?.offset || 0,
      };
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const queryParams: any = {};
      if (params?.limit) queryParams.limit = params.limit;
      if (params?.offset) queryParams.offset = params.offset;

      const response = await (client.sell as any).negotiation.findEligibleItems(queryParams);

      const eligibleItems = response?.eligibleItems || [];
      this.logger.log(
        `Fetched ${eligibleItems.length} eligible items for connection ${connectionId}`
      );

      return response;
    } catch (error) {
      this.logger.error(
        `Failed to fetch eligible items for connection ${connectionId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Send a negotiated pricing offer to interested buyers for a specific listing.
   */
  async sendOfferToInterested(
    connectionId: string,
    params: {
      listingId: string;
      offeredPrice: { value: string; currency: string };
      message?: string;
      allowCounterOffer?: boolean;
    }
  ): Promise<any> {
    if (this.mockMode) {
      const offerId = `mock_negotiation_${Date.now()}`;
      this.logger.log(
        `[MOCK] Sent offer to interested buyers for listing ${params.listingId} at ${params.offeredPrice.value} ${params.offeredPrice.currency} (${offerId})`
      );
      return {
        offerId,
        listingId: params.listingId,
        offeredPrice: params.offeredPrice,
        message: params.message || null,
        allowCounterOffer: params.allowCounterOffer ?? true,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      };
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const body: any = {
        offeredItems: [
          {
            listingId: params.listingId,
            price: {
              value: params.offeredPrice.value,
              currency: params.offeredPrice.currency,
            },
          },
        ],
      };

      if (params.message) {
        body.message = params.message;
      }

      if (params.allowCounterOffer !== undefined) {
        body.allowCounterOffer = params.allowCounterOffer;
      }

      const response = await (client.sell as any).negotiation.sendOfferToInterestedBuyers(body);

      this.logger.log(
        `Sent offer to interested buyers for listing ${params.listingId} at ${params.offeredPrice.value} ${params.offeredPrice.currency}`
      );

      return response;
    } catch (error) {
      this.logger.error(
        `Failed to send offer for listing ${params.listingId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Get currently active sent offers for a connection.
   */
  async getActiveOffers(connectionId: string): Promise<any> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Fetched active offers for connection ${connectionId}`);
      return {
        offers: [
          {
            offerId: 'mock_offer_001',
            listingId: 'mock_listing_001',
            title: 'Vintage Watch - Excellent Condition',
            offeredPrice: { value: '129.99', currency: 'USD' },
            originalPrice: { value: '149.99', currency: 'USD' },
            status: 'PENDING',
            offerDuration: 48,
            createdAt: new Date(Date.now() - 3600000).toISOString(),
            expiresAt: new Date(Date.now() + 169200000).toISOString(),
            interestedBuyerCount: 12,
          },
          {
            offerId: 'mock_offer_002',
            listingId: 'mock_listing_002',
            title: 'Collectible Card Set - Complete',
            offeredPrice: { value: '74.99', currency: 'USD' },
            originalPrice: { value: '89.99', currency: 'USD' },
            status: 'PENDING',
            offerDuration: 48,
            createdAt: new Date(Date.now() - 7200000).toISOString(),
            expiresAt: new Date(Date.now() + 165600000).toISOString(),
            interestedBuyerCount: 8,
          },
        ],
        total: 2,
      };
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      // Use the correct eBay Negotiation API endpoint for sent offers
      const response = await (client.sell as any).negotiation.getOffers({});

      this.logger.log(`Fetched active offers for connection ${connectionId}`);
      return response;
    } catch (error) {
      this.logger.error(
        `Failed to fetch active offers for connection ${connectionId}`,
        error
      );
      throw error;
    }
  }
}
