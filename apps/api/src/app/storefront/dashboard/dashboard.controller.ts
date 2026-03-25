import {
  Controller,
  Get,
  Post,
  Req,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { StoreAdminGuard } from '@platform/auth';
import { DashboardService } from './dashboard.service';

@Controller('store/admin/dashboard')
@UseGuards(StoreAdminGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  async getDashboard(@Req() req: Request) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.dashboardService.getDashboardStats(tenantId);
  }

  @Get('readiness')
  async getReadiness(@Req() req: Request) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.dashboardService.getStoreReadiness(tenantId);
  }

  @Post('publish')
  async publishStore(@Req() req: Request) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.dashboardService.publishStore(tenantId);
  }

  @Post('unpublish')
  async unpublishStore(@Req() req: Request) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.dashboardService.unpublishStore(tenantId);
  }

  @Get('earnings')
  async getEarnings(@Req() req: Request) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.dashboardService.getEarnings(tenantId);
  }

  @Get('inventory-alerts')
  async getInventoryAlerts(@Req() req: Request) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.dashboardService.getInventoryAlerts(tenantId);
  }
}
