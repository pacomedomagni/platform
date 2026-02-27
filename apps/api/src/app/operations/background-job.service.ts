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
  private isShuttingDown = false;
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

  async onModuleDestroy(): Promise<void> {
    this.isShuttingDown = true;

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

    // Wait for in-flight jobs to complete (with a 30-second timeout)
    if (this.processingJobs.size > 0) {
      this.logger.log(`Waiting for ${this.processingJobs.size} in-flight job(s) to complete...`);
      const shutdownDeadline = Date.now() + 30_000;
      while (this.processingJobs.size > 0 && Date.now() < shutdownDeadline) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Reset any still-running jobs back to pending so they can be picked up after restart
      if (this.processingJobs.size > 0) {
        this.logger.warn(
          `${this.processingJobs.size} job(s) still running after shutdown timeout. Resetting to pending.`,
        );
        const jobIds = Array.from(this.processingJobs);
        await this.prisma.backgroundJob.updateMany({
          where: { id: { in: jobIds }, status: 'running' },
          data: { status: 'pending' },
        });
      }
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
    // L-BJ-6: Warn if no handler is registered for this job type
    if (!this.handlers.has(data.type)) {
      this.logger.warn(
        `Creating job of type '${data.type}' but no handler is registered. ` +
        `The job will fail at processing time unless a handler is registered before then.`,
      );
    }

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

    // H-BJ-3: Don't reset attempts to 0. Instead, keep the current attempt count
    // and allow one more attempt by incrementing maxAttempts.
    return this.prisma.backgroundJob.update({
      where: { id },
      data: {
        status: 'pending',
        error: null,
        maxAttempts: { increment: 1 },
      },
    });
  }

  /**
   * Process pending jobs using SELECT FOR UPDATE SKIP LOCKED for safe
   * concurrent claiming across multiple workers (H-BJ-1 + H-BJ-2).
   */
  async processPendingJobs(batchSize = 5): Promise<number> {
    if (this.isShuttingDown) return 0;

    // Atomically claim jobs using SELECT FOR UPDATE SKIP LOCKED
    const claimedJobs = await this.prisma.$queryRaw<any[]>`
      UPDATE background_jobs
      SET status = 'running', "startedAt" = NOW(), attempts = attempts + 1
      WHERE id IN (
        SELECT id FROM background_jobs
        WHERE status = 'pending'
          AND ("scheduledAt" IS NULL OR "scheduledAt" <= NOW())
        ORDER BY priority DESC, "createdAt" ASC
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `;

    let processed = 0;

    for (const job of claimedJobs) {
      if (this.isShuttingDown) break;
      if (this.processingJobs.has(job.id)) continue;

      this.processingJobs.add(job.id);

      try {
        await this.processClaimedJob(job);
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
   * Process a single job that has already been claimed (status = 'running', attempts incremented).
   */
  private async processClaimedJob(job: any): Promise<void> {
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
      // H-BJ-3: Don't reset attempts - the attempt was already incremented during claim.
      // Allow retry if current attempts < maxAttempts.
      const currentAttempts = Number(job.attempts);
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
        _count: { _all: true },
      }),
      this.prisma.backgroundJob.groupBy({
        by: ['type'],
        where,
        _count: { _all: true },
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
      byStatus: statusCounts.map((s) => ({ status: s.status, count: s._count._all })),
      byType: typeCounts.map((t) => ({ type: t.type, count: t._count._all })),
      recentFailures,
    };
  }

  /**
   * Cleanup old jobs.
   *
   * Design note: This cleanup is intentionally global (not scoped per tenant).
   * Scoping by tenantId would require iterating all tenants. Since the retention
   * policy (delete completed/failed/cancelled jobs older than N days) applies
   * uniformly regardless of tenant, a single global delete is both simpler and
   * more efficient.
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
