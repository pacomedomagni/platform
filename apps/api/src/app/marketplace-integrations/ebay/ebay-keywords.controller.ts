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
import { EbayKeywordsService } from './ebay-keywords.service';
import {
  CreateKeywordDto,
  BulkCreateKeywordsDto,
  CreateNegativeKeywordDto,
} from '../shared/marketplace.dto';

/**
 * eBay Keywords API Controller
 * Manages keywords for Promoted Listings Advanced (CPC) campaigns
 */
@Controller('marketplace/campaigns/:campaignId/keywords')
@UseGuards(AuthGuard, RolesGuard)
@Throttle({ short: { limit: 10, ttl: 1000 }, medium: { limit: 30, ttl: 60000 } })
export class EbayKeywordsController {
  constructor(private keywordsService: EbayKeywordsService) {}

  /**
   * List keywords in a campaign
   * GET /api/marketplace/campaigns/:campaignId/keywords?connectionId=...&adGroupId=...
   */
  @Get()
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async getKeywords(
    @Tenant() tenantId: string,
    @Param('campaignId') campaignId: string,
    @Query('connectionId') connectionId: string,
    @Query('adGroupId') adGroupId?: string
  ) {
    return this.keywordsService.getKeywords(connectionId, campaignId, adGroupId);
  }

  /**
   * Create a keyword in a campaign
   * POST /api/marketplace/campaigns/:campaignId/keywords
   */
  @Post()
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async createKeyword(
    @Tenant() tenantId: string,
    @Param('campaignId') campaignId: string,
    @Body(ValidationPipe) dto: CreateKeywordDto
  ) {
    return this.keywordsService.createKeyword(dto.connectionId, campaignId, {
      adGroupId: dto.adGroupId,
      keyword: dto.keyword,
      matchType: dto.matchType,
      bid: dto.bid,
    });
  }

  /**
   * Bulk create keywords in a campaign
   * POST /api/marketplace/campaigns/:campaignId/keywords/bulk
   */
  @Post('bulk')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async bulkCreateKeywords(
    @Tenant() tenantId: string,
    @Param('campaignId') campaignId: string,
    @Body(ValidationPipe) dto: BulkCreateKeywordsDto
  ) {
    return this.keywordsService.bulkCreateKeywords(
      dto.connectionId,
      campaignId,
      dto.keywords
    );
  }

  /**
   * Delete a keyword from a campaign
   * DELETE /api/marketplace/campaigns/:campaignId/keywords/:keywordId?connectionId=...
   */
  @Delete(':keywordId')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async deleteKeyword(
    @Tenant() tenantId: string,
    @Param('campaignId') campaignId: string,
    @Param('keywordId') keywordId: string,
    @Query('connectionId') connectionId: string
  ) {
    await this.keywordsService.deleteKeyword(connectionId, campaignId, keywordId);
    return { success: true, message: 'Keyword deleted' };
  }

  /**
   * Create a negative keyword for a campaign
   * POST /api/marketplace/campaigns/:campaignId/keywords/negative
   */
  @Post('negative')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async createNegativeKeyword(
    @Tenant() tenantId: string,
    @Param('campaignId') campaignId: string,
    @Body(ValidationPipe) dto: CreateNegativeKeywordDto
  ) {
    return this.keywordsService.createNegativeKeyword(dto.connectionId, campaignId, {
      adGroupId: dto.adGroupId,
      keyword: dto.keyword,
      matchType: dto.matchType,
    });
  }

  /**
   * Get keyword suggestions for listings in an ad group
   * GET /api/marketplace/campaigns/:campaignId/keywords/suggestions?connectionId=...&adGroupId=...&listingIds=...
   */
  @Get('suggestions')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async suggestKeywords(
    @Tenant() tenantId: string,
    @Param('campaignId') campaignId: string,
    @Query('connectionId') connectionId: string,
    @Query('adGroupId') adGroupId: string,
    @Query('listingIds') listingIds: string
  ) {
    const ids = listingIds ? listingIds.split(',') : [];
    return this.keywordsService.suggestKeywords(
      connectionId,
      campaignId,
      adGroupId,
      ids
    );
  }

  /**
   * Get bid suggestions for keywords in an ad group
   * GET /api/marketplace/campaigns/:campaignId/keywords/bid-suggestions?connectionId=...&adGroupId=...&keywords=...
   */
  @Get('bid-suggestions')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async suggestBids(
    @Tenant() tenantId: string,
    @Param('campaignId') campaignId: string,
    @Query('connectionId') connectionId: string,
    @Query('adGroupId') adGroupId: string,
    @Query('keywords') keywords: string
  ) {
    const keywordList = keywords ? keywords.split(',') : [];
    return this.keywordsService.suggestBids(
      connectionId,
      campaignId,
      adGroupId,
      keywordList
    );
  }
}
