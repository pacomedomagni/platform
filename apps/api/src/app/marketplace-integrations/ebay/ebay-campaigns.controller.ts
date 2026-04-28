import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard, RolesGuard, Roles } from '@platform/auth';
import { Tenant } from '../../tenant.middleware';
import { EbayCampaignsService } from './ebay-campaigns.service';
import { CreateCampaignDto, AddAdToCampaignDto } from '../shared/marketplace.dto';

/**
 * eBay Campaigns API Controller
 * Manages Promoted Listings Standard (PLS) campaigns
 */
@Controller('marketplace/campaigns')
@UseGuards(AuthGuard, RolesGuard)
@Throttle({ short: { limit: 10, ttl: 1000 }, medium: { limit: 30, ttl: 60000 } })
export class EbayCampaignsController {
  constructor(private campaignsService: EbayCampaignsService) {}

  /**
   * Create a new Promoted Listings campaign
   * POST /api/marketplace/campaigns
   */
  @Post()
  @Roles('admin', 'System Manager')
  async createCampaign(
    @Tenant() tenantId: string,
    @Body(ValidationPipe) dto: CreateCampaignDto
  ) {
    return this.campaignsService.createCampaign(tenantId, dto);
  }

  /**
   * List campaigns for a connection
   * GET /api/marketplace/campaigns?connectionId=...
   */
  @Get()
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async getCampaigns(
    @Tenant() tenantId: string,
    @Query('connectionId') connectionId: string
  ) {
    return this.campaignsService.getCampaigns(tenantId, connectionId);
  }

  /**
   * Get a single campaign detail
   * GET /api/marketplace/campaigns/:id
   */
  @Get(':id')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async getCampaign(
    @Tenant() tenantId: string,
    @Param('id') id: string
  ) {
    return this.campaignsService.getCampaign(tenantId, id);
  }

  /**
   * Add a listing to a campaign as a promoted ad
   * POST /api/marketplace/campaigns/:id/ads
   */
  @Post(':id/ads')
  @Roles('admin', 'System Manager')
  async addListingToCampaign(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Body(ValidationPipe) dto: AddAdToCampaignDto
  ) {
    await this.campaignsService.addListingToCampaign(
      tenantId,
      id,
      dto.listingId,
      dto.bidPercentage
    );
    return { success: true, message: 'Listing added to campaign' };
  }

  /**
   * Remove an ad from a campaign
   * DELETE /api/marketplace/campaigns/:id/ads/:adId
   */
  @Delete(':id/ads/:adId')
  @Roles('admin', 'System Manager')
  async removeAdFromCampaign(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Param('adId') adId: string
  ) {
    await this.campaignsService.removeAdFromCampaign(tenantId, id, adId);
    return { success: true, message: 'Ad removed from campaign' };
  }

  /**
   * Pause a running campaign
   * POST /api/marketplace/campaigns/:id/pause
   */
  @Post(':id/pause')
  @Roles('admin', 'System Manager')
  async pauseCampaign(
    @Tenant() tenantId: string,
    @Param('id') id: string
  ) {
    await this.campaignsService.pauseCampaign(tenantId, id);
    return { success: true, message: 'Campaign paused' };
  }

  /**
   * Resume a paused campaign
   * POST /api/marketplace/campaigns/:id/resume
   */
  @Post(':id/resume')
  @Roles('admin', 'System Manager')
  async resumeCampaign(
    @Tenant() tenantId: string,
    @Param('id') id: string
  ) {
    await this.campaignsService.resumeCampaign(tenantId, id);
    return { success: true, message: 'Campaign resumed' };
  }

  /**
   * End a campaign permanently
   * POST /api/marketplace/campaigns/:id/end
   */
  @Post(':id/end')
  @Roles('admin', 'System Manager')
  async endCampaign(
    @Tenant() tenantId: string,
    @Param('id') id: string
  ) {
    await this.campaignsService.endCampaign(tenantId, id);
    return { success: true, message: 'Campaign ended' };
  }

  /**
   * Get campaign performance report
   * GET /api/marketplace/campaigns/:id/report
   */
  @Get(':id/report')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async getCampaignReport(
    @Tenant() tenantId: string,
    @Param('id') id: string
  ) {
    return this.campaignsService.getCampaignReport(tenantId, id);
  }
}
