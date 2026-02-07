import {
  Controller,
  Get,
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
}
