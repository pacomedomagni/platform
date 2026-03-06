import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { ClsService } from 'nestjs-cls';
import { EbayStoreService } from './ebay-store.service';
import { EbayClientService } from './ebay-client.service';

/**
 * eBay Best Offer Management Service
 * Handles retrieving and responding to Best Offers on eBay listings
 * via the Trading API (getBestOffers, respondToBestOffer).
 */
@Injectable()
export class EbayOffersService {
  private readonly logger = new Logger(EbayOffersService.name);
  private readonly mockMode = process.env.MOCK_EXTERNAL_SERVICES === 'true';

  constructor(
    private prisma: PrismaService,
    private cls: ClsService,
    private ebayStore: EbayStoreService,
    private ebayClient: EbayClientService
  ) {}

  /**
   * Get best offers for a marketplace listing.
   * Looks up the listing by ID, validates tenant ownership,
   * retrieves the external item ID, and fetches offers from eBay.
   */
  async getBestOffers(
    tenantId: string,
    listingId: string,
    status?: string
  ): Promise<any[]> {
    const listing = await this.getListingOrFail(tenantId, listingId);
    const client = await this.ebayStore.getClient(listing.connectionId, tenantId);

    const response = await this.ebayClient.getBestOffers(
      client,
      listing.externalListingId!,
      status
    );

    const offers = response?.BestOfferArray?.BestOffer || [];
    this.logger.log(
      `Fetched ${offers.length} best offers for listing ${listingId} (eBay item ${listing.externalListingId})`
    );

    return offers.map((offer: any) => ({
      bestOfferId: offer.BestOfferID,
      buyerUserId: offer.Buyer?.UserID,
      price: {
        value: offer.Price?.Value || offer.Price?._value,
        currency: offer.Price?.CurrencyID || offer.Price?._attrs?.currencyID || 'USD',
      },
      quantity: offer.Quantity || 1,
      status: offer.BestOfferStatus,
      message: offer.BuyerMessage || null,
      createdAt: offer.CreationDate || null,
      expirationDate: offer.ExpirationDate || null,
    }));
  }

  /**
   * Accept a best offer on an eBay listing.
   */
  async acceptBestOffer(
    tenantId: string,
    listingId: string,
    bestOfferId: string
  ): Promise<void> {
    const listing = await this.getListingOrFail(tenantId, listingId);
    const client = await this.ebayStore.getClient(listing.connectionId, tenantId);

    await this.ebayClient.respondToBestOffer(
      client,
      listing.externalListingId!,
      bestOfferId,
      'Accept'
    );

    this.logger.log(
      `Accepted best offer ${bestOfferId} on listing ${listingId} (eBay item ${listing.externalListingId})`
    );
  }

  /**
   * Decline a best offer on an eBay listing.
   */
  async declineBestOffer(
    tenantId: string,
    listingId: string,
    bestOfferId: string,
    reason?: string
  ): Promise<void> {
    const listing = await this.getListingOrFail(tenantId, listingId);
    const client = await this.ebayStore.getClient(listing.connectionId, tenantId);

    await this.ebayClient.respondToBestOffer(
      client,
      listing.externalListingId!,
      bestOfferId,
      'Decline',
      undefined,
      reason
    );

    this.logger.log(
      `Declined best offer ${bestOfferId} on listing ${listingId} (eBay item ${listing.externalListingId})`
    );
  }

  /**
   * Counter a best offer on an eBay listing with a different price.
   */
  async counterBestOffer(
    tenantId: string,
    listingId: string,
    bestOfferId: string,
    counterPrice: number,
    message?: string
  ): Promise<void> {
    const listing = await this.getListingOrFail(tenantId, listingId);
    const client = await this.ebayStore.getClient(listing.connectionId, tenantId);

    await this.ebayClient.respondToBestOffer(
      client,
      listing.externalListingId!,
      bestOfferId,
      'Counter',
      counterPrice,
      message
    );

    this.logger.log(
      `Countered best offer ${bestOfferId} on listing ${listingId} with $${counterPrice} (eBay item ${listing.externalListingId})`
    );
  }

  // ============================================
  // Private Helpers
  // ============================================

  /**
   * Retrieve and validate a marketplace listing.
   * Ensures the listing exists, belongs to the tenant, and has an external item ID.
   */
  private async getListingOrFail(tenantId: string, listingId: string) {
    const listing = await this.prisma.marketplaceListing.findFirst({
      where: { id: listingId, tenantId },
      include: { connection: true },
    });

    if (!listing) {
      throw new NotFoundException(`Listing ${listingId} not found`);
    }

    if (!listing.externalListingId) {
      throw new NotFoundException(
        `Listing ${listingId} has not been published to eBay yet (no external item ID)`
      );
    }

    return listing;
  }
}
