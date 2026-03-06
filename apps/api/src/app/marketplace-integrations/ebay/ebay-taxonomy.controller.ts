import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard, RolesGuard } from '@platform/auth';
import { Tenant } from '../../tenant.middleware';
import { EbayTaxonomyService } from './ebay-taxonomy.service';

/**
 * eBay Taxonomy API Controller
 * Provides category search, subtree browsing, item aspects, and condition lookups
 */
@Controller('marketplace/ebay/taxonomy')
@UseGuards(AuthGuard, RolesGuard)
@Throttle({ short: { limit: 20, ttl: 1000 }, medium: { limit: 60, ttl: 60000 } })
export class EbayTaxonomyController {
  constructor(private taxonomyService: EbayTaxonomyService) {}

  /**
   * Search categories by keyword
   * GET /api/marketplace/ebay/taxonomy/categories/search?q=...&marketplaceId=...&connectionId=...
   */
  @Get('categories/search')
  async searchCategories(
    @Tenant() tenantId: string,
    @Query('q') query: string,
    @Query('marketplaceId') marketplaceId: string,
    @Query('connectionId') connectionId: string
  ) {
    return this.taxonomyService.searchCategories(
      connectionId,
      marketplaceId || 'EBAY_US',
      query
    );
  }

  /**
   * Get category subtree
   * GET /api/marketplace/ebay/taxonomy/categories/:id/subtree?marketplaceId=...&connectionId=...
   */
  @Get('categories/:id/subtree')
  async getCategorySubtree(
    @Tenant() tenantId: string,
    @Param('id') categoryId: string,
    @Query('marketplaceId') marketplaceId: string,
    @Query('connectionId') connectionId: string
  ) {
    return this.taxonomyService.getCategorySubtree(
      connectionId,
      marketplaceId || 'EBAY_US',
      categoryId
    );
  }

  /**
   * Get item aspects (specifics) for a category
   * GET /api/marketplace/ebay/taxonomy/categories/:id/aspects?marketplaceId=...&connectionId=...
   */
  @Get('categories/:id/aspects')
  async getItemAspects(
    @Tenant() tenantId: string,
    @Param('id') categoryId: string,
    @Query('marketplaceId') marketplaceId: string,
    @Query('connectionId') connectionId: string
  ) {
    return this.taxonomyService.getItemAspectsForCategory(
      connectionId,
      marketplaceId || 'EBAY_US',
      categoryId
    );
  }

  /**
   * Get valid conditions for a category
   * GET /api/marketplace/ebay/taxonomy/categories/:id/conditions?marketplaceId=...&connectionId=...
   */
  @Get('categories/:id/conditions')
  async getConditions(
    @Tenant() tenantId: string,
    @Param('id') categoryId: string,
    @Query('marketplaceId') marketplaceId: string,
    @Query('connectionId') connectionId: string
  ) {
    return this.taxonomyService.getConditionsForCategory(
      connectionId,
      marketplaceId || 'EBAY_US',
      categoryId
    );
  }
}
