import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { AuthGuard } from '@nestjs/passport';

/**
 * Monitoring Controller
 * Provides metrics and health check endpoints for system monitoring
 *
 * Security: Should be protected by authentication in production
 * Consider using API keys or internal-only network access
 */
@Controller('monitoring')
// @UseGuards(AuthGuard('jwt')) // Uncomment in production
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  /**
   * Get comprehensive system metrics
   * GET /api/v1/monitoring/metrics
   */
  @Get('metrics')
  async getMetrics() {
    return this.monitoringService.getMetrics();
  }

  /**
   * Get system health and alerts
   * GET /api/v1/monitoring/health
   */
  @Get('health')
  async getHealth() {
    const [metrics, alerts] = await Promise.all([
      this.monitoringService.getMetrics(),
      this.monitoringService.checkAlerts(),
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
    const limitNum = limit ? parseInt(limit, 10) : 100;
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
  async getAlerts() {
    return this.monitoringService.checkAlerts();
  }
}
