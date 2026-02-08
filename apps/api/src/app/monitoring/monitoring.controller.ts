import { Controller, Get, Query, UseGuards, Headers, BadRequestException } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { StoreAdminGuard } from '@platform/auth';

/**
 * Monitoring Controller
 * Provides metrics and health check endpoints for system monitoring
 */
@Controller('monitoring')
@UseGuards(StoreAdminGuard)
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get('metrics')
  async getMetrics(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.monitoringService.getMetrics(tenantId);
  }

  @Get('health')
  async getHealth(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    const [metrics, alerts] = await Promise.all([
      this.monitoringService.getMetrics(tenantId),
      this.monitoringService.checkAlerts(tenantId),
    ]);

    return {
      status: alerts.critical.length === 0 ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      metrics,
      alerts,
    };
  }

  @Get('failed-operations')
  async getFailedOperations(
    @Headers('x-tenant-id') tenantId: string,
    @Query('limit') limit?: string,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    const limitNum = limit ? parseInt(limit, 10) : 100;
    return this.monitoringService.getFailedOperationsReport(tenantId, limitNum);
  }

  @Get('stock-anomalies')
  async getStockAnomalies(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.monitoringService.getStockAnomalies(tenantId);
  }

  @Get('alerts')
  async getAlerts(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.monitoringService.checkAlerts(tenantId);
  }
}
