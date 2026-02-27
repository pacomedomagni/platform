import { Injectable, Logger, NotFoundException, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '@platform/db';

interface TenantContext {
  tenantId: string;
}

type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
const DEFAULT_MAX_ATTEMPTS = 3;
const JOB_PROCESSING_INTERVAL_MS = 30_000; // 30 seconds
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const CLEANUP_RETENTION_DAYS = 30;

interface JobHandler {
  (tenantId: string, payload: Record<string, unknown>): Promise<unknown>;
}

@Injectable()
export class BackgroundJobService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BackgroundJobService.name);
  private handlers = new Map<string, JobHandler>();
  private processingJobs = new Set<string>();
  private isProcessing = false;
  private jobProcessingInterval: ReturnType<typeof setInterval> | null = null;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    this.logger.log(
      `Starting job processing scheduler (every ${JOB_PROCESSING_INTERVAL_MS / 1000}s)`
    );
    this.jobProcessingInterval = setInterval(async () => {
      try {
        await this.scheduledProcessPendingJobs();
      } catch (error) {
        this.logger.error(`Scheduled job processing failed: ${error}`);
      }
    }, JOB_PROCESSING_INTERVAL_MS);

    this.logger.log(
      `Starting cleanup scheduler (every ${CLEANUP_INTERVAL_MS / 1000 / 60} minutes)`
    );
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.cleanup(CLEANUP_RETENTION_DAYS);
      } catch (error) {
        this.logger.error(`Scheduled cleanup failed: ${error}`);
      }
    }, CLEANUP_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.jobProcessingInterval) {
      clearInterval(this.jobProcessingInterval);
      this.jobProcessingInterval = null;
      this.logger.log('Stopped job processing scheduler');
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      this.logger.log('Stopped cleanup scheduler');
    }
  }

  /**
   * Guard wrapper around processPendingJobs to prevent concurrent execution
   */
  private async scheduledProcessPendingJobs(): Promise<void> {
    if (this.isProcessing) {
      this.logger.debug('Skipping scheduled run — previous processing still in progress');
      return;
    }

    this.isProcessing = true;
    try {
      const processed = await this.processPendingJobs();
      if (processed > 0) {
        this.logger.log(`Scheduled run processed ${processed} job(s)`);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Register a job handler
   */
  registerHandler(jobType: string, handler: JobHandler): void {
    this.handlers.set(jobType, handler);
    this.logger.log(`Registered handler for job type: ${jobType}`);
  }

  /**
   * Create a new background job
   */
  async createJob(
    ctx: TenantContext,
    data: {
      type: string;
      payload?: Record<string, unknown>;
      scheduledAt?: Date;
      priority?: number;
    }
  ) {
    const job = await this.prisma.backgroundJob.create({
      data: {
        tenantId: ctx.tenantId,
        type: data.type,
        payload: data.payload as object ?? undefined,
        scheduledAt: data.scheduledAt,
        priority: data.priority ?? 0,
        status: 'pending',
        attempts: 0,
        maxAttempts: DEFAULT_MAX_ATTEMPTS,
      },
    });

    this.logger.debug(`Created job ${job.id} of type ${job.type}`);
    return job;
  }

  /**
   * Find jobs with optional filters
   */
  async findMany(
    ctx: TenantContext,
    filters: {
      status?: string;
      type?: string;
      limit?: number;
      page?: number;
    }
  ) {
    const limit = Math.min(filters.limit || 50, 500);
    const page = filters.page || 1;
    const offset = (page - 1) * limit;

    const where: any = { tenantId: ctx.tenantId };

    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.type) {
      where.type = filters.type;
    }

    const [data, total] = await Promise.all([
      this.prisma.backgroundJob.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.backgroundJob.count({ where }),
    ]);

    return {
      data,
      total,
      hasMore: offset + data.length < total,
    };
  }

  /**
   * Get job by ID
   */
  async findOne(ctx: TenantContext, id: string) {
    const job = await this.prisma.backgroundJob.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });

    if (!job) {
      throw new NotFoundException(`Job '${id}' not found`);
    }

    return job;
  }

  /**
   * Cancel a pending job
   */
  async cancelJob(ctx: TenantContext, id: string) {
    const job = await this.findOne(ctx, id);

    if (job.status !== 'pending') {
      throw new Error(`Cannot cancel job in '${job.status}' status`);
    }

    return this.prisma.backgroundJob.update({
      where: { id },
      data: { status: 'cancelled' },
    });
  }

  /**
   * Retry a failed job
   */
  async retryJob(ctx: TenantContext, id: string) {
    const job = await this.findOne(ctx, id);

    if (job.status !== 'failed') {
      throw new Error(`Cannot retry job in '${job.status}' status`);
    }

    return this.prisma.backgroundJob.update({
      where: { id },
      data: {
        status: 'pending',
        error: null,
        attempts: 0,
      },
    });
  }

  /**
   * Process pending jobs (called by a scheduler/cron)
   */
  async processPendingJobs(batchSize = 10): Promise<number> {
    const now = new Date();

    const pendingJobs = await this.prisma.backgroundJob.findMany({
      where: {
        status: 'pending',
        OR: [
          { scheduledAt: null },
          { scheduledAt: { lte: now } },
        ],
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: batchSize,
    });

    let processed = 0;

    for (const job of pendingJobs) {
      if (this.processingJobs.has(job.id)) continue;

      this.processingJobs.add(job.id);

      try {
        await this.processJob(job);
        processed++;
      } catch (error) {
        this.logger.error(`Error processing job ${job.id}: ${error}`);
      } finally {
        this.processingJobs.delete(job.id);
      }
    }

    return processed;
  }

  /**
   * Process a single job
   */
  private async processJob(job: any): Promise<void> {
    const handler = this.handlers.get(job.type);

    if (!handler) {
      this.logger.warn(`No handler registered for job type: ${job.type}`);
      await this.prisma.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          error: `No handler registered for job type: ${job.type}`,
        },
      });
      return;
    }

    // Mark as running
    await this.prisma.backgroundJob.update({
      where: { id: job.id },
      data: {
        status: 'running',
        startedAt: new Date(),
        attempts: { increment: 1 },
      },
    });

    try {
      const result = await handler(job.tenantId, (job.payload as Record<string, unknown>) || {});

      await this.prisma.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          result: result as any,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const currentAttempts = job.attempts + 1;
      const shouldRetry = currentAttempts < job.maxAttempts;

      if (shouldRetry) {
        await this.prisma.backgroundJob.update({
          where: { id: job.id },
          data: {
            status: 'pending',
            error: errorMessage,
            scheduledAt: new Date(Date.now() + Math.pow(2, currentAttempts) * 1000 * 60),
          },
        });
      } else {
        await this.prisma.backgroundJob.update({
          where: { id: job.id },
          data: {
            status: 'failed',
            error: errorMessage,
          },
        });
        this.logger.error(`Job ${job.id} failed after ${currentAttempts} attempts: ${errorMessage}`);
      }
    }
  }

  /**
   * Get job statistics
   */
  async getStats(ctx: TenantContext) {
    const where = { tenantId: ctx.tenantId };

    const [statusCounts, typeCounts, recentFailures] = await Promise.all([
      this.prisma.backgroundJob.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
      this.prisma.backgroundJob.groupBy({
        by: ['type'],
        where,
        _count: true,
      }),
      this.prisma.backgroundJob.findMany({
        where: {
          ...where,
          status: 'failed',
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          type: true,
          error: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      byStatus: statusCounts.map((s) => ({ status: s.status, count: s._count })),
      byType: typeCounts.map((t) => ({ type: t.type, count: t._count })),
      recentFailures,
    };
  }

  /**
   * Cleanup old jobs
   */
  async cleanup(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.prisma.backgroundJob.deleteMany({
      where: {
        status: { in: ['completed', 'failed', 'cancelled'] },
        createdAt: { lt: cutoffDate },
      },
    });

    this.logger.log(`Deleted ${result.count} old jobs`);
    return result.count;
  }
}
