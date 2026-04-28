import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard, RolesGuard, Roles } from '@platform/auth';
import { Tenant } from '../../tenant.middleware';
import { EbayCatalogService } from './ebay-catalog.service';

/**
 * eBay Product Catalog API Controller
 * Provides catalog search and product matching endpoints
 */
@Controller('marketplace/ebay/catalog')
@UseGuards(AuthGuard, RolesGuard)
@Throttle({ short: { limit: 20, ttl: 1000 }, medium: { limit: 60, ttl: 60000 } })
export class EbayCatalogController {
  constructor(private catalogService: EbayCatalogService) {}

  /**
   * Search eBay product catalog
   * GET /api/marketplace/ebay/catalog/search?connectionId=...&q=...&gtin=...&epid=...&limit=...
   */
  @Get('search')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async searchProducts(
    @Tenant() tenantId: string,
    @Query('connectionId') connectionId: string,
    @Query('q') q?: string,
    @Query('gtin') gtin?: string,
    @Query('epid') epid?: string,
    @Query('limit') limit?: string
  ) {
    return this.catalogService.searchProducts(connectionId, {
      q,
      gtin,
      epid,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * Get product metadata (compatible categories and required aspects)
   * GET /api/marketplace/ebay/catalog/:epid/metadata?connectionId=...
   * Must be defined BEFORE :epid to avoid NestJS route conflict
   */
  @Get(':epid/metadata')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async getProductMetadata(
    @Tenant() tenantId: string,
    @Param('epid') epid: string,
    @Query('connectionId') connectionId: string
  ) {
    return this.catalogService.getProductMetadata(connectionId, epid);
  }

  /**
   * Get product by ePID
   * GET /api/marketplace/ebay/catalog/:epid?connectionId=...
   */
  @Get(':epid')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async getProduct(
    @Tenant() tenantId: string,
    @Param('epid') epid: string,
    @Query('connectionId') connectionId: string
  ) {
    return this.catalogService.getProduct(connectionId, epid);
  }
}
