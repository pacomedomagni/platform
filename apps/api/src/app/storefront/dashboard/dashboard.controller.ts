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
import { Tenant } from '../../tenant.middleware';

@Controller('store/admin/dashboard')
@UseGuards(StoreAdminGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  async getDashboard(@Tenant() tenantId: string) {    return this.dashboardService.getDashboardStats(tenantId);
  }

  @Get('readiness')
  async getReadiness(@Tenant() tenantId: string) {    return this.dashboardService.getStoreReadiness(tenantId);
  }

  @Post('publish')
  async publishStore(@Tenant() tenantId: string) {    return this.dashboardService.publishStore(tenantId);
  }

  @Post('unpublish')
  async unpublishStore(@Tenant() tenantId: string) {    return this.dashboardService.unpublishStore(tenantId);
  }

  @Get('earnings')
  async getEarnings(@Tenant() tenantId: string) {    return this.dashboardService.getEarnings(tenantId);
  }

  @Get('inventory-alerts')
  async getInventoryAlerts(@Tenant() tenantId: string) {    return this.dashboardService.getInventoryAlerts(tenantId);
  }
}
