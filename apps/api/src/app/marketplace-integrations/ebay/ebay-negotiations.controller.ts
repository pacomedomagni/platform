import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard, RolesGuard, Roles } from '@platform/auth';
import { Tenant } from '../../tenant.middleware';
import { EbayNegotiationsService } from './ebay-negotiations.service';

/**
 * eBay Negotiations API Controller
 * Manages negotiated pricing offers to interested buyers/watchers
 */
@Controller('marketplace/negotiations')
@UseGuards(AuthGuard, RolesGuard)
@Throttle({ default: { limit: 30, ttl: 60000 } })
export class EbayNegotiationsController {
  constructor(private negotiationsService: EbayNegotiationsService) {}

  /**
   * Find items eligible for sending offers to watchers/interested buyers
   * GET /api/marketplace/negotiations/eligible?connectionId=...&limit=...&offset=...
   */
  @Get('eligible')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async findEligibleItems(
    @Tenant() tenantId: string,
    @Query('connectionId') connectionId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    if (!connectionId) {
      throw new HttpException('connectionId is required', HttpStatus.BAD_REQUEST);
    }

    return this.negotiationsService.findEligibleItems(connectionId, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  /**
   * Send a negotiated pricing offer to interested buyers
   * POST /api/marketplace/negotiations/offer
   */
  @Post('offer')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async sendOffer(
    @Tenant() tenantId: string,
    @Body()
    body: {
      connectionId: string;
      listingId: string;
      offeredPrice: { value: string; currency: string };
      message?: string;
      allowCounterOffer?: boolean;
    }
  ) {
    if (!body.connectionId || !body.listingId || !body.offeredPrice) {
      throw new HttpException(
        'connectionId, listingId, and offeredPrice are required',
        HttpStatus.BAD_REQUEST
      );
    }

    const result = await this.negotiationsService.sendOfferToInterested(body.connectionId, {
      listingId: body.listingId,
      offeredPrice: body.offeredPrice,
      message: body.message,
      allowCounterOffer: body.allowCounterOffer,
    });

    return { success: true, message: 'Offer sent to interested buyers', ...result };
  }

  /**
   * Get currently active sent offers
   * GET /api/marketplace/negotiations/active?connectionId=...
   */
  @Get('active')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async getActiveOffers(
    @Tenant() tenantId: string,
    @Query('connectionId') connectionId: string
  ) {
    if (!connectionId) {
      throw new HttpException('connectionId is required', HttpStatus.BAD_REQUEST);
    }

    return this.negotiationsService.getActiveOffers(connectionId);
  }
}
