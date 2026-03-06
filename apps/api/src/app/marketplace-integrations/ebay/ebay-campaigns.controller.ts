import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard, RolesGuard, Roles } from '@platform/auth';
import { Tenant } from '../../tenant.middleware';
import { EbayCampaignsService } from './ebay-campaigns.service';

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
    @Body()
    body: {
      connectionId: string;
      name: string;
      marketplaceId: string;
      bidPercentage: number;
      budgetAmount?: number;
      startDate?: string;
      endDate?: string;
    }
  ) {
    return this.campaignsService.createCampaign(tenantId, body);
  }

  /**
   * List campaigns for a connection
   * GET /api/marketplace/campaigns?connectionId=...
   */
  @Get()
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
    @Body() body: { listingId: string; bidPercentage: number }
  ) {
    await this.campaignsService.addListingToCampaign(
      tenantId,
      id,
      body.listingId,
      body.bidPercentage
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
  async getCampaignReport(
    @Tenant() tenantId: string,
    @Param('id') id: string
  ) {
    return this.campaignsService.getCampaignReport(tenantId, id);
  }
}
