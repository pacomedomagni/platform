import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { MonitoringService } from './monitoring.service';
import { AuthGuard, RolesGuard, Roles } from '@platform/auth';
import { Request } from 'express';

interface RequestWithUser extends Request {
  user: { tenantId: string; roles?: string[] };
}

/**
 * Monitoring Controller
 * Provides metrics and health check endpoints for system monitoring
 */
@Controller('monitoring')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
@Throttle({ short: { limit: 10, ttl: 1000 }, medium: { limit: 30, ttl: 60000 } })
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  /**
   * Get comprehensive system metrics
   * GET /api/v1/monitoring/metrics
   */
  @Get('metrics')
  async getMetrics(@Req() req: RequestWithUser) {
    return this.monitoringService.getMetrics(req.user.tenantId);
  }

  /**
   * Get system health and alerts
   * GET /api/v1/monitoring/health
   */
  @Get('health')
  async getHealth(@Req() req: RequestWithUser) {
    const tenantId = req.user.tenantId;
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

  /**
   * Get failed operations report
   * GET /api/v1/monitoring/failed-operations?limit=100
   */
  @Get('failed-operations')
  async getFailedOperations(@Query('limit') limit?: string) {
    const limitNum = Math.min(limit ? parseInt(limit, 10) || 100 : 100, 200);
    return this.monitoringService.getFailedOperationsReport(limitNum);
  }

  /**
   * Get stock anomalies (negative stock, over-reserved)
   * GET /api/v1/monitoring/stock-anomalies
   */
  @Get('stock-anomalies')
  async getStockAnomalies() {
    return this.monitoringService.getStockAnomalies();
  }

  /**
   * Get alerts only
   * GET /api/v1/monitoring/alerts
   */
  @Get('alerts')
  async getAlerts(@Req() req: RequestWithUser) {
    return this.monitoringService.checkAlerts(req.user.tenantId);
  }
}
