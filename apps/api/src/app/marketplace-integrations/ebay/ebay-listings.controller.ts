import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard, RolesGuard, Roles } from '@platform/auth';
import { Tenant } from '../../tenant.middleware';
import { EbayListingsService } from './ebay-listings.service';
import {
  CreateDirectListingDto,
  CreateVariationListingDto,
  UpdatePublishedListingDto,
  SetOutOfStockControlDto,
} from '../shared/marketplace.dto';

/**
 * eBay-Specific Listings Controller
 * Exposes eBay-only listing operations that are NOT covered by
 * the unified `marketplace/listings` controller.
 *
 * Common CRUD / workflow routes (create, get, update, delete,
 * approve, reject, publish, schedule, sync-inventory, end)
 * are served by the unified ListingsController at `marketplace/listings`.
 */
@Controller('marketplace/ebay/listings')
@UseGuards(AuthGuard, RolesGuard)
@Throttle({ short: { limit: 10, ttl: 1000 }, medium: { limit: 60, ttl: 60000 } })
export class EbayListingsController {
  constructor(private listingsService: EbayListingsService) {}

  /**
   * Create listing directly (without product reference)
   * POST /api/marketplace/ebay/listings/direct
   */
  @Post('direct')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async createDirectListing(
    @Tenant() tenantId: string,
    @Body(ValidationPipe) dto: CreateDirectListingDto
  ) {
    return this.listingsService.createDirectListing(dto);
  }

  /**
   * Create multi-variation listing
   * POST /api/marketplace/ebay/listings/variations
   */
  @Post('variations')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async createVariationListing(
    @Tenant() tenantId: string,
    @Body(ValidationPipe) dto: CreateVariationListingDto
  ) {
    return this.listingsService.createVariationListing({
      connectionId: dto.connectionId,
      groupKey: dto.groupTitle,
      title: dto.groupTitle,
      description: dto.description,
      categoryId: dto.categoryId,
      imageUrls: [],
      aspects: {},
      variants: dto.variants.map((v) => ({
        sku: v.sku,
        productListingId: dto.productListingId,
        title: v.title,
        description: dto.description,
        price: v.price,
        quantity: v.quantity,
        condition: v.condition,
        imageUrls: v.photos || [],
        variantAspects: v.aspects,
      })),
      fulfillmentPolicyId: dto.fulfillmentPolicyId,
      paymentPolicyId: dto.paymentPolicyId,
      returnPolicyId: dto.returnPolicyId,
    });
  }

  /**
   * Update published listing on eBay (price, quantity, description)
   * PATCH /api/marketplace/ebay/listings/:id/offer
   */
  @Patch(':id/offer')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async updatePublishedListing(
    @Param('id') id: string,
    @Body(ValidationPipe) dto: UpdatePublishedListingDto
  ) {
    return this.listingsService.updatePublishedListing(id, dto);
  }

  /**
   * Get Out-of-Stock Control preference
   * GET /api/marketplace/ebay/listings/out-of-stock-control?connectionId=...
   */
  @Get('out-of-stock-control')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async getOutOfStockControl(
    @Tenant() tenantId: string,
    @Query('connectionId') connectionId: string
  ) {
    return this.listingsService.getOutOfStockControl(connectionId);
  }

  /**
   * Set Out-of-Stock Control preference
   * POST /api/marketplace/ebay/listings/out-of-stock-control
   */
  @Post('out-of-stock-control')
  @Roles('admin', 'System Manager')
  async setOutOfStockControl(
    @Tenant() tenantId: string,
    @Body(ValidationPipe) dto: SetOutOfStockControlDto
  ) {
    return this.listingsService.setOutOfStockControl(dto.connectionId, dto.enabled);
  }
}
