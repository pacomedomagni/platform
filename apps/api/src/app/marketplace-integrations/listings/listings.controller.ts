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
import { Tenant } from '../../tenant.middleware';
import { EbayListingsService } from '../ebay/ebay-listings.service';
import {
  CreateDirectListingDto,
  UpdateListingDto,
  RejectListingDto,
  GetListingsQueryDto,
} from '../shared/marketplace.dto';

/**
 * Unified Marketplace Listings Controller
 * Handles listings across all marketplace platforms (eBay, Amazon, etc.)
 * This controller provides a unified API that the frontend uses
 */
@Controller('marketplace/listings')
@UseGuards(AuthGuard, RolesGuard)
export class MarketplaceListingsController {
  constructor(private ebayListings: EbayListingsService) {}

  /**
   * Create listing
   * POST /api/marketplace/listings
   */
  @Post()
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async createListing(
    @Tenant() tenantId: string,
    @Body(ValidationPipe) dto: CreateDirectListingDto,
    @Request() req: any
  ) {
    // For now, only eBay is supported
    // In the future, we'll route to different services based on platform
    return this.ebayListings.createDirectListing(dto);
  }

  /**
   * Get all listings
   * GET /api/marketplace/listings
   */
  @Get()
  async getListings(
    @Tenant() tenantId: string,
    @Query(ValidationPipe) query: GetListingsQueryDto
  ) {
    return this.ebayListings.getListings({
      connectionId: query.connectionId,
      status: query.status,
      limit: query.limit,
      offset: query.offset,
    });
  }

  /**
   * Get single listing
   * GET /api/marketplace/listings/:id
   */
  @Get(':id')
  async getListing(@Param('id') id: string) {
    return this.ebayListings.getListing(id);
  }

  /**
   * Update listing
   * PATCH /api/marketplace/listings/:id
   */
  @Patch(':id')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async updateListing(
    @Param('id') id: string,
    @Body(ValidationPipe) dto: UpdateListingDto
  ) {
    return this.ebayListings.updateListing(id, dto);
  }

  /**
   * Approve listing
   * POST /api/marketplace/listings/:id/approve
   */
  @Post(':id/approve')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async approveListing(@Param('id') id: string, @Request() req: any) {
    const userId = req.user?.id;
    return this.ebayListings.approveListing(id, userId);
  }

  /**
   * Reject listing
   * POST /api/marketplace/listings/:id/reject
   */
  @Post(':id/reject')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async rejectListing(
    @Param('id') id: string,
    @Body(ValidationPipe) dto: RejectListingDto,
    @Request() req: any
  ) {
    const userId = req.user?.id;
    return this.ebayListings.rejectListing(id, userId, dto.reason);
  }

  /**
   * Publish listing to marketplace
   * POST /api/marketplace/listings/:id/publish
   */
  @Post(':id/publish')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async publishListing(@Param('id') id: string) {
    return this.ebayListings.publishListing(id);
  }

  /**
   * Sync inventory for specific listing
   * POST /api/marketplace/listings/:id/sync-inventory
   */
  @Post(':id/sync-inventory')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async syncInventory(@Param('id') id: string) {
    await this.ebayListings.syncListingInventory(id);
    return { success: true, message: 'Inventory synced' };
  }

  /**
   * End listing on marketplace
   * POST /api/marketplace/listings/:id/end
   */
  @Post(':id/end')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async endListing(@Param('id') id: string) {
    await this.ebayListings.endListing(id);
    return { success: true, message: 'Listing ended' };
  }

  /**
   * Delete listing (drafts only)
   * DELETE /api/marketplace/listings/:id
   */
  @Delete(':id')
  @Roles('admin', 'System Manager')
  async deleteListing(@Param('id') id: string) {
    await this.ebayListings.deleteListing(id);
    return { success: true, message: 'Listing deleted' };
  }
}
