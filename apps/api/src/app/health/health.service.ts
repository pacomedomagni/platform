import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import Redis from 'ioredis';

export interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
}

export interface ReadinessCheck {
  status: 'ready' | 'not_ready';
  checks: {
    database: { status: 'ok' | 'error'; latencyMs?: number; error?: string };
    redis: { status: 'ok' | 'error'; latencyMs?: number; error?: string };
  };
  timestamp: string;
}

export interface LivenessCheck {
  status: 'alive';
  timestamp: string;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly startTime = Date.now();
  private redis: Redis | null = null;

  constructor(private readonly prisma: PrismaService) {
    // Initialize Redis connection for health checks
    const redisHost = process.env['REDIS_HOST'] || 'localhost';
    const redisPort = parseInt(process.env['REDIS_PORT'] || '6379', 10);
    const redisPassword = process.env['REDIS_PASSWORD'];

    try {
      this.redis = new Redis({
        host: redisHost,
        port: redisPort,
        password: redisPassword,
        maxRetriesPerRequest: 1,
        connectTimeout: 5000,
        lazyConnect: true,
      });

      this.redis.on('error', (err) => {
        this.logger.warn(`Redis health check connection error: ${err.message}`);
      });
    } catch {
      this.logger.warn('Failed to initialize Redis for health checks');
    }
  }

  /**
   * Basic health check - always returns healthy if the service is running
   */
  getHealth(): HealthCheck {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: process.env['APP_VERSION'] || '1.0.0',
    };
  }

  /**
   * Readiness check - verifies all dependencies are available
   */
  async getReadiness(): Promise<ReadinessCheck> {
    const checks: ReadinessCheck['checks'] = {
      database: { status: 'ok' },
      redis: { status: 'ok' },
    };

    // Check database
    try {
      const dbStart = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database.latencyMs = Date.now() - dbStart;
    } catch (err) {
      checks.database.status = 'error';
      checks.database.error = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Database health check failed: ${checks.database.error}`);
    }

    // Check Redis
    try {
      if (this.redis) {
        const redisStart = Date.now();
        await this.redis.ping();
        checks.redis.latencyMs = Date.now() - redisStart;
      } else {
        checks.redis.status = 'error';
        checks.redis.error = 'Redis not configured';
      }
    } catch (err) {
      checks.redis.status = 'error';
      checks.redis.error = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Redis health check failed: ${checks.redis.error}`);
    }

    const allHealthy = checks.database.status === 'ok' && checks.redis.status === 'ok';

    return {
      status: allHealthy ? 'ready' : 'not_ready',
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Liveness check - simple check that the process is alive
   */
  getLiveness(): LivenessCheck {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Detailed metrics for monitoring
   */
  async getMetrics(): Promise<{
    health: HealthCheck;
    database: {
      poolStats: { totalCount: number; idleCount: number; waitingCount: number };
    };
    memory: {
      heapUsed: number;
      heapTotal: number;
      external: number;
      rss: number;
    };
    process: {
      uptime: number;
      pid: number;
      nodeVersion: string;
    };
  }> {
    const memoryUsage = process.memoryUsage();

    return {
      health: this.getHealth(),
      database: {
        poolStats: this.prisma.getPoolStats(),
      },
      memory: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss,
      },
      process: {
        uptime: process.uptime(),
        pid: process.pid,
        nodeVersion: process.version,
      },
    };
  }
}
