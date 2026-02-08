import {
  Controller, Get, Post, Query, Body, Headers,
  BadRequestException, UseGuards,
} from '@nestjs/common';
import { StoreAdminGuard } from '@platform/auth';
import { FunnelService } from './funnel.service';

@Controller('analytics')
export class FunnelController {
  constructor(private readonly funnelService: FunnelService) {}

  @Post('events')
  async trackEvent(
    @Headers('x-tenant-id') tenantId: string,
    @Body() body: {
      sessionId: string;
      customerId?: string;
      eventType: string;
      productId?: string;
      metadata?: Record<string, unknown>;
      utmSource?: string;
      utmMedium?: string;
      utmCampaign?: string;
      referrer?: string;
    },
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.funnelService.trackEvent(tenantId, body);
  }

  @Get('funnel')
  @UseGuards(StoreAdminGuard)
  async getConversionFunnel(
    @Headers('x-tenant-id') tenantId: string,
    @Query() query: { from?: string; to?: string },
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.funnelService.getConversionFunnel(tenantId, query);
  }

  @Get('sources')
  @UseGuards(StoreAdminGuard)
  async getTopSources(
    @Headers('x-tenant-id') tenantId: string,
    @Query() query: { from?: string; to?: string; limit?: string },
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.funnelService.getTopSources(tenantId, {
      from: query.from,
      to: query.to,
      limit: query.limit ? parseInt(query.limit) : undefined,
    });
  }
}
