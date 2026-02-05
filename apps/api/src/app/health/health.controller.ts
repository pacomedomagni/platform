import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * GET /api/health
   * Basic health check - returns 200 if the service is running
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  getHealth() {
    return this.healthService.getHealth();
  }

  /**
   * GET /api/health/ready
   * Readiness check - verifies all dependencies (DB, Redis) are available
   * Returns 503 if any dependency is unavailable
   */
  @Get('ready')
  async getReadiness(@Res() res: Response) {
    const result = await this.healthService.getReadiness();
    const statusCode = result.status === 'ready' 
      ? HttpStatus.OK 
      : HttpStatus.SERVICE_UNAVAILABLE;
    
    return res.status(statusCode).json(result);
  }

  /**
   * GET /api/health/live
   * Liveness check - returns immediately if the process is alive
   * Used by Kubernetes liveness probes
   */
  @Get('live')
  @HttpCode(HttpStatus.OK)
  getLiveness() {
    return this.healthService.getLiveness();
  }

  /**
   * GET /api/health/metrics
   * Detailed metrics for monitoring dashboards
   */
  @Get('metrics')
  @HttpCode(HttpStatus.OK)
  async getMetrics() {
    return this.healthService.getMetrics();
  }
}
