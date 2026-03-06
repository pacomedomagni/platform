import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard, RolesGuard, Roles } from '@platform/auth';
import { Tenant } from '../../tenant.middleware';
import { EbayOffersService } from './ebay-offers.service';

/**
 * eBay Best Offer API Controller
 * Manages best offer retrieval and responses (accept, decline, counter)
 */
@Controller('marketplace/offers')
@UseGuards(AuthGuard, RolesGuard)
@Throttle({ short: { limit: 10, ttl: 1000 }, medium: { limit: 30, ttl: 60000 } })
export class EbayOffersController {
  constructor(private offersService: EbayOffersService) {}

  /**
   * Get best offers for a listing
   * GET /api/marketplace/offers/:listingId?status=...
   */
  @Get(':listingId')
  async getBestOffers(
    @Tenant() tenantId: string,
    @Param('listingId') listingId: string,
    @Query('status') status?: string
  ) {
    return this.offersService.getBestOffers(tenantId, listingId, status);
  }

  /**
   * Accept a best offer
   * POST /api/marketplace/offers/:listingId/offers/:offerId/accept
   */
  @Post(':listingId/offers/:offerId/accept')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async acceptOffer(
    @Tenant() tenantId: string,
    @Param('listingId') listingId: string,
    @Param('offerId') offerId: string
  ) {
    await this.offersService.acceptBestOffer(tenantId, listingId, offerId);
    return { success: true, message: 'Best offer accepted' };
  }

  /**
   * Decline a best offer
   * POST /api/marketplace/offers/:listingId/offers/:offerId/decline
   */
  @Post(':listingId/offers/:offerId/decline')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async declineOffer(
    @Tenant() tenantId: string,
    @Param('listingId') listingId: string,
    @Param('offerId') offerId: string,
    @Body(ValidationPipe) body: { reason?: string }
  ) {
    await this.offersService.declineBestOffer(tenantId, listingId, offerId, body.reason);
    return { success: true, message: 'Best offer declined' };
  }

  /**
   * Counter a best offer
   * POST /api/marketplace/offers/:listingId/offers/:offerId/counter
   */
  @Post(':listingId/offers/:offerId/counter')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async counterOffer(
    @Tenant() tenantId: string,
    @Param('listingId') listingId: string,
    @Param('offerId') offerId: string,
    @Body(ValidationPipe) body: { counterPrice: number; message?: string }
  ) {
    await this.offersService.counterBestOffer(
      tenantId,
      listingId,
      offerId,
      body.counterPrice,
      body.message
    );
    return { success: true, message: 'Counter offer sent' };
  }
}
