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
import { AuthGuard, RolesGuard, Roles } from '@platform/auth';
import { Tenant } from '../../../tenant.middleware';
import { EbayListingsService } from './ebay-listings.service';
import {
  CreateListingDto,
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
   * Get single listing
   * GET /api/marketplace/ebay/listings/:id
   */
  @Get(':id')
  async getListing(@Param('id') id: string) {
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
