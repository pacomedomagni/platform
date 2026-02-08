import {
  Controller,
  Get,
  Post,
  Headers,
  Param,
  Query,
  Body,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { StoreAdminGuard } from '@platform/auth';
import { ReorderAlertsService } from './reorder-alerts.service';

@Controller('store/admin/reorder-alerts')
@UseGuards(StoreAdminGuard)
export class ReorderAlertsController {
  constructor(private readonly reorderAlertsService: ReorderAlertsService) {}

  @Get()
  async listAlerts(
    @Headers('x-tenant-id') tenantId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('severity') severity?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.reorderAlertsService.listAlerts(tenantId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      status,
      severity,
    });
  }

  @Get('stats')
  async getAlertStats(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.reorderAlertsService.getAlertStats(tenantId);
  }

  @Post('generate')
  async generateAlerts(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.reorderAlertsService.generateAlerts(tenantId);
  }

  @Post(':id/acknowledge')
  async acknowledgeAlert(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body('userId') userId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.reorderAlertsService.acknowledgeAlert(tenantId, id, userId);
  }

  @Post(':id/dismiss')
  async dismissAlert(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.reorderAlertsService.dismissAlert(tenantId, id);
  }

  @Post(':id/create-po')
  async createPOFromAlert(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.reorderAlertsService.createPOFromAlert(tenantId, id);
  }
}
