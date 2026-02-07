import {
  Controller,
  Get,
  Post,
  Headers,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { StoreAdminGuard } from '@platform/auth';
import { DashboardService } from './dashboard.service';

@Controller('store/admin/dashboard')
@UseGuards(StoreAdminGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  async getDashboard(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.dashboardService.getDashboardStats(tenantId);
  }

  @Get('readiness')
  async getReadiness(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.dashboardService.getStoreReadiness(tenantId);
  }

  @Post('publish')
  async publishStore(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.dashboardService.publishStore(tenantId);
  }

  @Post('unpublish')
  async unpublishStore(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.dashboardService.unpublishStore(tenantId);
  }
}
