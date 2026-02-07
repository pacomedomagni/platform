import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { QueueService, QueueName, ProductImportJobData } from '@platform/queue';
import { Job } from 'bullmq';
import { ProductImportService } from '../storefront/products/product-import.service';

@Injectable()
export class ProductImportWorker implements OnModuleInit {
  private readonly logger = new Logger(ProductImportWorker.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly importService: ProductImportService,
  ) {}

  onModuleInit() {
    this.queueService.registerWorker(
      QueueName.PRODUCT_IMPORT,
      this.processImportJob.bind(this),
      1, // concurrency - process imports one at a time
    );
    this.logger.log('Product import worker registered');
  }

  private async processImportJob(job: Job<ProductImportJobData>): Promise<void> {
    const { jobId } = job.data;
    this.logger.log(`Processing product import job: ${jobId}`);

    try {
      await this.importService.processImport(jobId);
      this.logger.log(`Product import job completed: ${jobId}`);
    } catch (error) {
      this.logger.error(
        `Product import job failed: ${jobId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }
}
