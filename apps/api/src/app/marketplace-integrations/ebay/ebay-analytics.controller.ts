import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard, RolesGuard, Roles } from '@platform/auth';
import { Tenant } from '../../tenant.middleware';
import { EbayAnalyticsService } from './ebay-analytics.service';

/**
 * eBay Analytics API Controller
 * Provides endpoints for traffic reports, seller standards,
 * customer service metrics, and listing recommendations.
 */
@Controller('marketplace/analytics')
@UseGuards(AuthGuard, RolesGuard)
@Throttle({ short: { limit: 10, ttl: 1000 }, medium: { limit: 30, ttl: 60000 } })
export class EbayAnalyticsController {
  constructor(private analyticsService: EbayAnalyticsService) {}

  /**
   * Get traffic report for a date range
   * GET /api/marketplace/analytics/traffic?connectionId=...&startDate=...&endDate=...&dimension=...
   */
  @Get('traffic')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async getTrafficReport(
    @Tenant() tenantId: string,
    @Query('connectionId') connectionId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('dimension') dimension?: string
  ) {
    return this.analyticsService.getTrafficReport(
      connectionId,
      { startDate, endDate },
      dimension
    );
  }

  /**
   * Get seller standards profiles
   * GET /api/marketplace/analytics/seller-standards?connectionId=...
   */
  @Get('seller-standards')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async getSellerStandards(
    @Tenant() tenantId: string,
    @Query('connectionId') connectionId: string
  ) {
    return this.analyticsService.getSellerStandards(connectionId);
  }

  /**
   * Get customer service metrics
   * GET /api/marketplace/analytics/customer-service?connectionId=...&evaluationType=...
   */
  @Get('customer-service')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async getCustomerServiceMetrics(
    @Tenant() tenantId: string,
    @Query('connectionId') connectionId: string,
    @Query('evaluationType') evaluationType?: string
  ) {
    return this.analyticsService.getCustomerServiceMetrics(connectionId, evaluationType);
  }

  /**
   * Get listing optimization recommendations
   * GET /api/marketplace/analytics/recommendations?connectionId=...
   */
  @Get('recommendations')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async getRecommendations(
    @Tenant() tenantId: string,
    @Query('connectionId') connectionId: string
  ) {
    return this.analyticsService.getRecommendations(connectionId);
  }
}
