import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ValidationPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard, RolesGuard, Roles } from '@platform/auth';
import { Tenant } from '../../tenant.middleware';
import { EbayListingsService } from './ebay-listings.service';
import {
  CreateListingDto,
  CreateDirectListingDto,
  CreateVariationListingDto,
  UpdateListingDto,
  RejectListingDto,
  GetListingsQueryDto,
} from '../shared/marketplace.dto';

/**
 * eBay Listings API Controller
 * Manages eBay listings for NoSlag products
 */
@Controller('marketplace/ebay/listings')
@UseGuards(AuthGuard, RolesGuard)
@Throttle({ short: { limit: 10, ttl: 1000 }, medium: { limit: 60, ttl: 60000 } })
export class EbayListingsController {
  constructor(private listingsService: EbayListingsService) {}

  /**
   * Create listing from NoSlag product
   * POST /api/marketplace/ebay/listings
   */
  @Post()
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async createListing(
    @Tenant() tenantId: string,
    @Body(ValidationPipe) dto: CreateListingDto
  ) {
    return this.listingsService.createListingFromProduct(dto);
  }

  /**
   * Get all eBay listings for tenant
   * GET /api/marketplace/ebay/listings
   */
  @Get()
  async getListings(
    @Tenant() tenantId: string,
    @Query(ValidationPipe) query: GetListingsQueryDto
  ) {
    return this.listingsService.getListings({
      connectionId: query.connectionId,
      status: query.status,
      limit: query.limit,
      offset: query.offset,
    });
  }

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
      fulfillmentPolicyId: '',
      paymentPolicyId: '',
      returnPolicyId: '',
    });
  }

  /**
   * Update published listing (price, quantity, description)
   * PATCH /api/marketplace/ebay/listings/:id/offer
   */
  @Patch(':id/offer')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async updatePublishedListing(
    @Param('id') id: string,
    @Body() dto: {
      price?: { value: string; currency: string };
      quantity?: number;
      description?: string;
    }
  ) {
    return this.listingsService.updatePublishedListing(id, dto);
  }

  /**
   * Get Out-of-Stock Control preference
   * GET /api/marketplace/ebay/listings/out-of-stock-control?connectionId=...
   */
  @Get('out-of-stock-control')
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
    @Body() body: { connectionId: string; enabled: boolean }
  ) {
    return this.listingsService.setOutOfStockControl(body.connectionId, body.enabled);
  }

  /**
   * Get single listing
   * GET /api/marketplace/ebay/listings/:id
   */
  @Get(':id')
  async getListing(
    @Tenant() tenantId: string,
    @Param('id') id: string
  ) {
    return this.listingsService.getListing(id);
  }

  /**
   * Update listing
   * PATCH /api/marketplace/ebay/listings/:id
   */
  @Patch(':id')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async updateListing(
    @Param('id') id: string,
    @Body(ValidationPipe) dto: UpdateListingDto
  ) {
    return this.listingsService.updateListing(id, dto);
  }

  /**
   * Approve listing
   * POST /api/marketplace/ebay/listings/:id/approve
   */
  @Post(':id/approve')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async approveListing(@Param('id') id: string, @Request() req: any) {
    const userId = req.user?.id;
    return this.listingsService.approveListing(id, userId);
  }

  /**
   * Reject listing
   * POST /api/marketplace/ebay/listings/:id/reject
   */
  @Post(':id/reject')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async rejectListing(
    @Param('id') id: string,
    @Body(ValidationPipe) dto: RejectListingDto,
    @Request() req: any
  ) {
    const userId = req.user?.id;
    return this.listingsService.rejectListing(id, userId, dto.reason);
  }

  /**
   * Publish listing to eBay
   * POST /api/marketplace/ebay/listings/:id/publish
   */
  @Post(':id/publish')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async publishListing(@Param('id') id: string) {
    return this.listingsService.publishListing(id);
  }

  /**
   * Sync inventory for specific listing
   * POST /api/marketplace/ebay/listings/:id/sync-inventory
   */
  @Post(':id/sync-inventory')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async syncInventory(@Param('id') id: string) {
    await this.listingsService.syncListingInventory(id);
    return { success: true, message: 'Inventory synced' };
  }

  /**
   * Schedule listing publish
   * POST /api/marketplace/ebay/listings/:id/schedule
   */
  @Post(':id/schedule')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async scheduleListingPublish(
    @Param('id') id: string,
    @Body() body: { scheduledDate: string }
  ) {
    return this.listingsService.scheduleListingPublish(id, new Date(body.scheduledDate));
  }

  /**
   * End listing on eBay
   * POST /api/marketplace/ebay/listings/:id/end
   */
  @Post(':id/end')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async endListing(@Param('id') id: string) {
    await this.listingsService.endListing(id);
    return { success: true, message: 'Listing ended' };
  }

  /**
   * Delete listing (drafts only)
   * DELETE /api/marketplace/ebay/listings/:id
   */
  @Delete(':id')
  @Roles('admin', 'System Manager')
  async deleteListing(@Param('id') id: string) {
    await this.listingsService.deleteListing(id);
    return { success: true, message: 'Listing deleted' };
  }
}
