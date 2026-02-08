import {
  Controller,
  Get,
  Headers,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { StoreAdminGuard } from '@platform/auth';
import { BusinessHealthService } from './business-health.service';

@Controller('store/admin/business-health')
@UseGuards(StoreAdminGuard)
export class BusinessHealthController {
  constructor(private readonly businessHealthService: BusinessHealthService) {}

  @Get()
  async getBusinessHealth(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.businessHealthService.getBusinessHealth(tenantId);
  }

  @Get('revenue')
  async getRevenue(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.businessHealthService.getRevenue(tenantId);
  }

  @Get('inventory')
  async getInventory(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.businessHealthService.getInventory(tenantId);
  }
}
