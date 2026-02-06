import { Injectable, Logger, NotFoundException } from '@nestjs/common';

interface TenantContext {
  tenantId: string;
}

type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

interface JobHandler {
  (tenantId: string, payload: Record<string, unknown>): Promise<unknown>;
}

interface BackgroundJob {
  id: string;
  tenantId: string;
  type: string;
  payload?: Record<string, unknown>;
  status: JobStatus;
  priority: number;
  attempts: number;
  maxAttempts: number;
  error?: string;
  result?: unknown;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

@Injectable()
export class BackgroundJobService {
  private readonly logger = new Logger(BackgroundJobService.name);
  private handlers = new Map<string, JobHandler>();
  private processingJobs = new Set<string>();
  
  // In-memory job store
  private jobs: BackgroundJob[] = [];
  private jobIdCounter = 0;

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
  ): Promise<BackgroundJob> {
    const job: BackgroundJob = {
      id: `job_${++this.jobIdCounter}_${Date.now()}`,
      tenantId: ctx.tenantId,
      type: data.type,
      payload: data.payload,
      scheduledAt: data.scheduledAt,
      priority: data.priority ?? 0,
      status: 'pending',
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date(),
    };

    this.jobs.push(job);
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
    const limit = filters.limit || 50;
    const page = filters.page || 1;
    const offset = (page - 1) * limit;

    let filtered = this.jobs.filter(j => j.tenantId === ctx.tenantId);
    
    if (filters.status) {
      filtered = filtered.filter(j => j.status === filters.status);
    }
    if (filters.type) {
      filtered = filtered.filter(j => j.type === filters.type);
    }

    // Sort by priority desc, then createdAt desc
    filtered.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    const total = filtered.length;
    const data = filtered.slice(offset, offset + limit);

    return {
      data,
      total,
      hasMore: offset + data.length < total,
    };
  }

  /**
   * Get job by ID
   */
  async findOne(ctx: TenantContext, id: string): Promise<BackgroundJob> {
    const job = this.jobs.find(j => j.id === id && j.tenantId === ctx.tenantId);

    if (!job) {
      throw new NotFoundException(`Job '${id}' not found`);
    }

    return job;
  }

  /**
   * Cancel a pending job
   */
  async cancelJob(ctx: TenantContext, id: string): Promise<BackgroundJob> {
    const job = await this.findOne(ctx, id);

    if (job.status !== 'pending') {
      throw new Error(`Cannot cancel job in '${job.status}' status`);
    }

    job.status = 'cancelled';
    return job;
  }

  /**
   * Retry a failed job
   */
  async retryJob(ctx: TenantContext, id: string): Promise<BackgroundJob> {
    const job = await this.findOne(ctx, id);

    if (job.status !== 'failed') {
      throw new Error(`Cannot retry job in '${job.status}' status`);
    }

    job.status = 'pending';
    job.error = undefined;
    job.attempts = 0;
    return job;
  }

  /**
   * Process pending jobs (called by a scheduler/cron)
   */
  async processPendingJobs(batchSize = 10): Promise<number> {
    const now = new Date();

    // Get pending jobs that are ready to run
    const pendingJobs = this.jobs
      .filter(j => 
        j.status === 'pending' && 
        (!j.scheduledAt || j.scheduledAt <= now)
      )
      .sort((a, b) => {
        if (a.priority !== b.priority) return b.priority - a.priority;
        return a.createdAt.getTime() - b.createdAt.getTime();
      })
      .slice(0, batchSize);

    let processed = 0;

    for (const job of pendingJobs) {
      // Skip if already being processed
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
  private async processJob(job: BackgroundJob): Promise<void> {
    const handler = this.handlers.get(job.type);

    if (!handler) {
      this.logger.warn(`No handler registered for job type: ${job.type}`);
      job.status = 'failed';
      job.error = `No handler registered for job type: ${job.type}`;
      return;
    }

    // Mark as running
    job.status = 'running';
    job.startedAt = new Date();
    job.attempts++;

    try {
      const result = await handler(job.tenantId, job.payload || {});

      // Mark as completed
      job.status = 'completed';
      job.completedAt = new Date();
      job.result = result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const shouldRetry = job.attempts < job.maxAttempts;

      job.error = errorMessage;

      if (shouldRetry) {
        job.status = 'pending';
        // Exponential backoff for retry
        job.scheduledAt = new Date(Date.now() + Math.pow(2, job.attempts) * 1000 * 60);
      } else {
        job.status = 'failed';
        this.logger.error(`Job ${job.id} failed after ${job.attempts} attempts: ${errorMessage}`);
      }
    }
  }

  /**
   * Get job statistics
   */
  async getStats(ctx: TenantContext) {
    const tenantJobs = this.jobs.filter(j => j.tenantId === ctx.tenantId);

    // Status counts
    const statusCounts: Record<string, number> = {};
    for (const job of tenantJobs) {
      statusCounts[job.status] = (statusCounts[job.status] || 0) + 1;
    }

    // Type counts
    const typeCounts: Record<string, number> = {};
    for (const job of tenantJobs) {
      typeCounts[job.type] = (typeCounts[job.type] || 0) + 1;
    }

    // Recent failures (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentFailures = tenantJobs
      .filter(j => j.status === 'failed' && j.createdAt >= oneDayAgo)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10);

    return {
      byStatus: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
      byType: Object.entries(typeCounts).map(([type, count]) => ({ type, count })),
      recentFailures: recentFailures.map(j => ({
        id: j.id,
        type: j.type,
        error: j.error,
        createdAt: j.createdAt,
      })),
    };
  }

  /**
   * Cleanup old jobs (for memory management)
   */
  async cleanup(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const initialCount = this.jobs.length;
    this.jobs = this.jobs.filter(
      j => !(
        (j.status === 'completed' || j.status === 'failed' || j.status === 'cancelled') && 
        j.createdAt < cutoffDate
      )
    );
    
    const deletedCount = initialCount - this.jobs.length;
    this.logger.log(`Deleted ${deletedCount} old jobs`);
    return deletedCount;
  }
}
