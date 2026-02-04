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

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private queueEvents: Map<string, QueueEvents> = new Map();

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
    // Close all workers first
    for (const [name, worker] of this.workers) {
      this.logger.log(`Closing worker for queue: ${name}`);
      await worker.close();
    }

    // Close all queue events
    for (const [name, events] of this.queueEvents) {
      this.logger.log(`Closing queue events for: ${name}`);
      await events.close();
    }

    // Close all queues
    for (const [name, queue] of this.queues) {
      this.logger.log(`Closing queue: ${name}`);
      await queue.close();
    }
  }

  /**
   * Get or create a queue by name
   */
  async getOrCreateQueue(name: string): Promise<Queue> {
    if (!this.queues.has(name)) {
      const queue = new Queue(name, {
        connection: this.options.connection,
        defaultJobOptions: this.options.defaultJobOptions,
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
   * Register a worker for a queue
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

    worker.on('failed', (job, err) => {
      this.logger.error(`Worker failed job ${job?.id} in queue ${queueName}: ${err.message}`);
    });

    worker.on('error', (err) => {
      this.logger.error(`Worker error in queue ${queueName}: ${err.message}`);
    });

    this.workers.set(queueName, worker);
    this.logger.log(`Registered worker for queue: ${queueName} (concurrency: ${concurrency})`);

    return worker;
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
    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.getPausedCount(),
    ]);
    return { waiting, active, completed, failed, delayed, paused };
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
