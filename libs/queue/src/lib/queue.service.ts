import { Injectable, Inject, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Queue, Worker, Job, JobsOptions, QueueEvents } from 'bullmq';
import {
  QueueModuleOptions,
  QUEUE_MODULE_OPTIONS,
  QueueName,
  EmailJobData,
  PdfJobData,
  NotificationJobData,
  WebhookJobData,
  StockJobData,
  AccountingJobData,
  ScheduledJobData,
} from './queue.types';

/**
 * Phase 3 W3.1: queue hygiene defaults applied to every queue we create.
 *
 * Without `removeOnComplete` / `removeOnFail` BullMQ keeps every job in
 * Redis forever — Redis OOM is a matter of weeks under any production
 * load. We retain the last 1 day / 1k completed and 7 days / 10k failed
 * so debugging is still possible.
 */
const DEFAULT_QUEUE_JOB_OPTIONS: JobsOptions = {
  removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
  removeOnFail: { age: 7 * 24 * 60 * 60, count: 10_000 },
};

const DLQ_SUFFIX = '-dlq';

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private queueEvents: Map<string, QueueEvents> = new Map();
  /** Phase 3 W3.1: dead-letter queue per primary queue. */
  private dlqs: Map<string, Queue> = new Map();

  constructor(
    @Inject(QUEUE_MODULE_OPTIONS) private readonly options: QueueModuleOptions,
  ) {}

  async onModuleInit() {
    // Initialize default queues
    for (const queueName of Object.values(QueueName)) {
      await this.getOrCreateQueue(queueName);
    }
    this.logger.log(`Queue service initialized with ${this.queues.size} queues`);
  }

  async onModuleDestroy() {
    // Phase 3 W3.1: drain workers before closing. close() with the default
    // wait=true returns once active jobs finish or hit their lock timeout,
    // which is the safest behaviour during a deploy/rolling restart.
    for (const [name, worker] of this.workers) {
      this.logger.log(`Draining worker for queue: ${name}`);
      try {
        await worker.close();
      } catch (err) {
        this.logger.error(`Worker ${name} failed to drain: ${(err as Error).message}`);
      }
    }

    for (const [name, events] of this.queueEvents) {
      this.logger.log(`Closing queue events for: ${name}`);
      await events.close();
    }

    for (const [name, queue] of this.queues) {
      this.logger.log(`Closing queue: ${name}`);
      await queue.close();
    }

    for (const [name, dlq] of this.dlqs) {
      this.logger.log(`Closing DLQ: ${name}`);
      await dlq.close();
    }
  }

  /**
   * Get or create a queue by name. New queues inherit the W3.1 default
   * removeOnComplete/removeOnFail caps unless the caller supplied their own.
   */
  async getOrCreateQueue(name: string): Promise<Queue> {
    if (!this.queues.has(name)) {
      const queue = new Queue(name, {
        connection: this.options.connection,
        defaultJobOptions: {
          ...DEFAULT_QUEUE_JOB_OPTIONS,
          ...this.options.defaultJobOptions,
        },
      });
      this.queues.set(name, queue);

      // Set up queue events for monitoring
      const events = new QueueEvents(name, {
        connection: this.options.connection,
      });
      this.queueEvents.set(name, events);

      events.on('completed', ({ jobId }) => {
        this.logger.debug(`Job ${jobId} completed in queue ${name}`);
      });

      events.on('failed', ({ jobId, failedReason }) => {
        this.logger.error(`Job ${jobId} failed in queue ${name}: ${failedReason}`);
      });
    }
    return this.queues.get(name)!;
  }

  /**
   * Get or create the dead-letter queue for `primaryName`. Jobs that
   * exhaust their retry attempts get pushed here for human inspection.
   */
  private async getOrCreateDlq(primaryName: string): Promise<Queue> {
    const dlqName = `${primaryName}${DLQ_SUFFIX}`;
    if (!this.dlqs.has(dlqName)) {
      const dlq = new Queue(dlqName, {
        connection: this.options.connection,
        defaultJobOptions: {
          // DLQ items are retained longer; they exist precisely so a human
          // can review them.
          removeOnComplete: { age: 30 * 24 * 60 * 60, count: 5000 },
          removeOnFail: { age: 30 * 24 * 60 * 60, count: 5000 },
        },
      });
      this.dlqs.set(dlqName, dlq);
    }
    return this.dlqs.get(dlqName)!;
  }

  /**
   * Add a job to a queue
   */
  async addJob<T = unknown>(
    queueName: string,
    jobName: string,
    data: T,
    options?: JobsOptions,
  ): Promise<Job<T>> {
    const queue = await this.getOrCreateQueue(queueName);
    const job = await queue.add(jobName, data, options);
    this.logger.debug(`Added job ${job.id} (${jobName}) to queue ${queueName}`);
    return job as Job<T>;
  }

  /**
   * Add multiple jobs to a queue in bulk
   */
  async addBulk<T = unknown>(
    queueName: string,
    jobs: Array<{ name: string; data: T; opts?: JobsOptions }>,
  ): Promise<Job<T>[]> {
    const queue = await this.getOrCreateQueue(queueName);
    const addedJobs = await queue.addBulk(jobs);
    this.logger.debug(`Added ${addedJobs.length} jobs to queue ${queueName}`);
    return addedJobs as Job<T>[];
  }

  /**
   * Register a worker for a queue.
   *
   * Phase 3 W3.1: when a job exhausts its `attempts` budget, the payload is
   * pushed to the DLQ (`<queueName>-dlq`) along with the failure reason.
   * Operators can then inspect, retry, or discard manually.
   */
  registerWorker(
    queueName: string,
    processor: (job: Job) => Promise<unknown>,
    concurrency = 1,
  ): Worker {
    if (this.workers.has(queueName)) {
      this.logger.warn(`Worker already registered for queue: ${queueName}`);
      return this.workers.get(queueName)!;
    }

    const worker = new Worker(queueName, processor, {
      connection: this.options.connection,
      concurrency,
    });

    worker.on('completed', (job) => {
      this.logger.debug(`Worker completed job ${job.id} in queue ${queueName}`);
    });

    worker.on('failed', async (job, err) => {
      this.logger.error(`Worker failed job ${job?.id} in queue ${queueName}: ${err.message}`);

      // Phase 3 W3.1: push to DLQ once retries are fully exhausted.
      if (!job) return;
      const attemptsMade = job.attemptsMade ?? 0;
      const attemptsConfigured = (job.opts.attempts ?? 1) as number;
      if (attemptsMade < attemptsConfigured) return;

      try {
        const dlq = await this.getOrCreateDlq(queueName);
        await dlq.add(
          job.name,
          {
            originalQueue: queueName,
            originalJobId: job.id,
            data: job.data,
            failedReason: err.message,
            stack: err.stack,
            attemptsMade,
            timestamp: new Date().toISOString(),
          },
          // DLQ items don't auto-retry; an operator decides what to do.
          { attempts: 1 },
        );
        this.logger.warn(
          `Job ${job.id} (${queueName}) exhausted ${attemptsMade}/${attemptsConfigured} attempts → DLQ`,
        );
      } catch (dlqErr) {
        this.logger.error(
          `Failed to push job ${job.id} to DLQ: ${(dlqErr as Error).message}`,
        );
      }
    });

    worker.on('error', (err) => {
      this.logger.error(`Worker error in queue ${queueName}: ${err.message}`);
    });

    this.workers.set(queueName, worker);
    this.logger.log(`Registered worker for queue: ${queueName} (concurrency: ${concurrency})`);

    return worker;
  }

  /**
   * Phase 3 W3.1: get DLQ stats for a primary queue. Operators / dashboards
   * use this to alert on accumulating dead-letter items.
   */
  async getDlqStats(queueName: string): Promise<{
    waiting: number;
    failed: number;
  }> {
    const dlq = await this.getOrCreateDlq(queueName);
    const [waiting, failed] = await Promise.all([
      dlq.getWaitingCount(),
      dlq.getFailedCount(),
    ]);
    return { waiting, failed };
  }

  /**
   * Get a queue by name
   */
  getQueue(name: string): Queue | undefined {
    return this.queues.get(name);
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queueName: string): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  }> {
    const queue = await this.getOrCreateQueue(queueName);
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);
    // Note: BullMQ v5 doesn't have getPausedCount() - paused jobs are included in waiting count
    return { waiting, active, completed, failed, delayed, paused: 0 };
  }

  /**
   * Get all queue statistics
   */
  async getAllQueueStats(): Promise<Record<string, Awaited<ReturnType<typeof this.getQueueStats>>>> {
    const stats: Record<string, Awaited<ReturnType<typeof this.getQueueStats>>> = {};
    for (const queueName of this.queues.keys()) {
      stats[queueName] = await this.getQueueStats(queueName);
    }
    return stats;
  }

  /**
   * Pause a queue
   */
  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (queue) {
      await queue.pause();
      this.logger.log(`Queue ${queueName} paused`);
    }
  }

  /**
   * Resume a queue
   */
  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (queue) {
      await queue.resume();
      this.logger.log(`Queue ${queueName} resumed`);
    }
  }

  /**
   * Clean completed jobs older than a given age
   */
  async cleanQueue(
    queueName: string,
    grace: number = 1000 * 60 * 60 * 24, // 24 hours
    limit: number = 1000,
    status: 'completed' | 'wait' | 'active' | 'paused' | 'prioritized' | 'delayed' | 'failed' = 'completed',
  ): Promise<string[]> {
    const queue = await this.getOrCreateQueue(queueName);
    const removed = await queue.clean(grace, limit, status);
    this.logger.log(`Cleaned ${removed.length} ${status} jobs from queue ${queueName}`);
    return removed;
  }

  // Convenience methods for specific job types

  async sendEmail(data: EmailJobData, options?: JobsOptions): Promise<Job<EmailJobData>> {
    return this.addJob(QueueName.EMAIL, 'send-email', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      ...options,
    });
  }

  async generatePdf(data: PdfJobData, options?: JobsOptions): Promise<Job<PdfJobData>> {
    return this.addJob(QueueName.PDF, 'generate-pdf', data, {
      attempts: 2,
      ...options,
    });
  }

  async sendNotification(data: NotificationJobData, options?: JobsOptions): Promise<Job<NotificationJobData>> {
    return this.addJob(QueueName.NOTIFICATIONS, 'send-notification', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 500 },
      ...options,
    });
  }

  async triggerWebhook(data: WebhookJobData, options?: JobsOptions): Promise<Job<WebhookJobData>> {
    return this.addJob(QueueName.WEBHOOKS, 'trigger-webhook', data, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      ...options,
    });
  }

  async processStock(data: StockJobData, options?: JobsOptions): Promise<Job<StockJobData>> {
    return this.addJob(QueueName.STOCK, data.action, data, options);
  }

  async processAccounting(data: AccountingJobData, options?: JobsOptions): Promise<Job<AccountingJobData>> {
    return this.addJob(QueueName.ACCOUNTING, data.action, data, options);
  }

  async scheduleTask(data: ScheduledJobData, delay: number, options?: JobsOptions): Promise<Job<ScheduledJobData>> {
    return this.addJob(QueueName.SCHEDULED, data.taskType, data, {
      delay,
      ...options,
    });
  }

  async scheduleRecurringTask(
    data: ScheduledJobData,
    pattern: string, // cron pattern
    options?: JobsOptions,
  ): Promise<Job<ScheduledJobData>> {
    return this.addJob(QueueName.SCHEDULED, data.taskType, data, {
      repeat: { pattern },
      ...options,
    });
  }
}
