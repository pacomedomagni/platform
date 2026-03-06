import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Inject,
  UseGuards,
  Request,
  ValidationPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard, RolesGuard, Roles } from '@platform/auth';
import { Tenant } from '../../tenant.middleware';
import {
  IMarketplaceListingsService,
  MARKETPLACE_LISTINGS_SERVICE,
} from '../shared/marketplace-service.interface';
import {
  CreateDirectListingDto,
  UpdateListingDto,
  RejectListingDto,
  GetListingsQueryDto,
  ScheduleListingDto,
} from '../shared/marketplace.dto';

/**
 * Unified Marketplace Listings Controller
 * Handles listings across all marketplace platforms (eBay, Amazon, etc.)
 * Uses injected service token so the controller is platform-agnostic.
 */
@Controller('marketplace/listings')
@UseGuards(AuthGuard, RolesGuard)
@Throttle({ short: { limit: 10, ttl: 1000 }, medium: { limit: 60, ttl: 60000 } })
export class MarketplaceListingsController {
  constructor(
    @Inject(MARKETPLACE_LISTINGS_SERVICE)
    private listingsService: IMarketplaceListingsService
  ) {}

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
    return this.listingsService.createDirectListing(dto);
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
    return this.listingsService.getListings({
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
  async getListing(
    @Tenant() tenantId: string,
    @Param('id') id: string
  ) {
    return this.listingsService.getListing(id);
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
    return this.listingsService.updateListing(id, dto);
  }

  /**
   * Approve listing
   * POST /api/marketplace/listings/:id/approve
   */
  @Post(':id/approve')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async approveListing(@Param('id') id: string, @Request() req: any) {
    const userId = req.user?.id;
    return this.listingsService.approveListing(id, userId);
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
    return this.listingsService.rejectListing(id, userId, dto.reason);
  }

  /**
   * Publish listing to marketplace
   * POST /api/marketplace/listings/:id/publish
   */
  @Post(':id/publish')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async publishListing(@Param('id') id: string) {
    return this.listingsService.publishListing(id);
  }

  /**
   * Schedule listing for future publish
   * POST /api/marketplace/listings/:id/schedule
   */
  @Post(':id/schedule')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async scheduleListing(
    @Param('id') id: string,
    @Body(ValidationPipe) dto: ScheduleListingDto
  ) {
    return this.listingsService.scheduleListing(id, dto.scheduledDate);
  }

  /**
   * Sync inventory for specific listing
   * POST /api/marketplace/listings/:id/sync-inventory
   */
  @Post(':id/sync-inventory')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async syncInventory(@Param('id') id: string) {
    await this.listingsService.syncListingInventory(id);
    return { success: true, message: 'Inventory synced' };
  }

  /**
   * End listing on marketplace
   * POST /api/marketplace/listings/:id/end
   */
  @Post(':id/end')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async endListing(@Param('id') id: string) {
    await this.listingsService.endListing(id);
    return { success: true, message: 'Listing ended' };
  }

  /**
   * Delete listing (drafts only)
   * DELETE /api/marketplace/listings/:id
   */
  @Delete(':id')
  @Roles('admin', 'System Manager')
  async deleteListing(@Param('id') id: string) {
    await this.listingsService.deleteListing(id);
    return { success: true, message: 'Listing deleted' };
  }
}
