import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
  ValidationPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard, RolesGuard, Roles } from '@platform/auth';
import { Tenant } from '../../tenant.middleware';
import { EbayEmailCampaignsService } from './ebay-email-campaigns.service';
import { CreateEmailCampaignDto } from '../shared/marketplace.dto';

/**
 * eBay Email Campaigns API Controller
 * Manages store email campaigns via the eBay Sell Marketing API
 */
@Controller('marketplace/email-campaigns')
@UseGuards(AuthGuard, RolesGuard)
@Throttle({ default: { limit: 30, ttl: 60000 } })
export class EbayEmailCampaignsController {
  constructor(private emailCampaignsService: EbayEmailCampaignsService) {}

  /**
   * List email campaigns for a connection
   * GET /api/marketplace/email-campaigns?connectionId=...&status=...&limit=...&offset=...
   */
  @Get()
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async getEmailCampaigns(
    @Tenant() tenantId: string,
    @Query('connectionId') connectionId: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    if (!connectionId) {
      throw new HttpException('connectionId is required', HttpStatus.BAD_REQUEST);
    }

    return this.emailCampaignsService.getEmailCampaigns(tenantId, connectionId, {
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  /**
   * List available audience segments (opt-in subscribers)
   * GET /api/marketplace/email-campaigns/audiences?connectionId=...
   *
   * NOTE: This route is defined BEFORE the :id route to avoid
   * "audiences" being captured as a campaign ID parameter.
   */
  @Get('audiences')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async getAudiences(
    @Tenant() tenantId: string,
    @Query('connectionId') connectionId: string
  ) {
    if (!connectionId) {
      throw new HttpException('connectionId is required', HttpStatus.BAD_REQUEST);
    }

    return this.emailCampaignsService.getAudiences(tenantId, connectionId);
  }

  /**
   * Get a single email campaign by ID
   * GET /api/marketplace/email-campaigns/:id?connectionId=...
   */
  @Get(':id')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async getEmailCampaign(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Query('connectionId') connectionId: string
  ) {
    if (!connectionId) {
      throw new HttpException('connectionId is required', HttpStatus.BAD_REQUEST);
    }

    return this.emailCampaignsService.getEmailCampaign(tenantId, connectionId, id);
  }

  /**
   * Get email campaign performance report
   * GET /api/marketplace/email-campaigns/:id/report?connectionId=...
   */
  @Get(':id/report')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async getEmailCampaignReport(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Query('connectionId') connectionId: string
  ) {
    if (!connectionId) {
      throw new HttpException('connectionId is required', HttpStatus.BAD_REQUEST);
    }

    return this.emailCampaignsService.getEmailCampaignReport(tenantId, connectionId, id);
  }

  /**
   * Create a new email campaign
   * POST /api/marketplace/email-campaigns
   */
  @Post()
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async createEmailCampaign(
    @Tenant() tenantId: string,
    @Body(ValidationPipe) dto: CreateEmailCampaignDto
  ) {
    return this.emailCampaignsService.createEmailCampaign(tenantId, dto.connectionId, {
      subject: dto.subject,
      body: dto.emailBody,
      audienceType: dto.audienceType,
      scheduledDate: dto.scheduledDate,
    });
  }

  /**
   * Delete an email campaign
   * DELETE /api/marketplace/email-campaigns/:id?connectionId=...
   */
  @Delete(':id')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async deleteEmailCampaign(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Query('connectionId') connectionId: string
  ) {
    if (!connectionId) {
      throw new HttpException('connectionId is required', HttpStatus.BAD_REQUEST);
    }

    await this.emailCampaignsService.deleteEmailCampaign(tenantId, connectionId, id);
    return { success: true, message: 'Email campaign deleted' };
  }
}
