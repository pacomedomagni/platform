import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { QueueService, QueueName } from '@platform/queue';
import { ProductsService } from './products.service';
import { parse } from 'csv-parse/sync';

@Injectable()
export class ProductImportService {
  private readonly logger = new Logger(ProductImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly productsService: ProductsService,
  ) {}

  async startImport(tenantId: string, file: Express.Multer.File) {
    const job = await this.prisma.productImportJob.create({
      data: {
        tenantId,
        fileName: file.originalname,
        status: 'pending',
      },
    });

    await this.queueService.addJob(
      QueueName.PRODUCT_IMPORT,
      'import-products',
      { jobId: job.id, tenantId },
      { attempts: 1 },
    );

    // Store file content temporarily in the job
    await this.prisma.productImportJob.update({
      where: { id: job.id },
      data: {
        errors: { fileContent: file.buffer.toString('utf-8') },
      },
    });

    return { jobId: job.id, status: 'pending' };
  }

  async processImport(jobId: string) {
    const job = await this.prisma.productImportJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException('Import job not found');
    }

    await this.prisma.productImportJob.update({
      where: { id: jobId },
      data: { status: 'processing', startedAt: new Date() },
    });

    const fileContent = (job.errors as any)?.fileContent;
    if (!fileContent) {
      await this.prisma.productImportJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          errors: [{ row: 0, error: 'No file content found' }],
          completedAt: new Date(),
        },
      });
      return;
    }

    let records: any[];
    try {
      records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch (err: any) {
      await this.prisma.productImportJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          errors: [{ row: 0, error: `CSV parse error: ${err.message}` }],
          completedAt: new Date(),
        },
      });
      return;
    }

    const totalRows = records.length;
    let processedRows = 0;
    let successCount = 0;
    let errorCount = 0;
    const errors: { row: number; error: string }[] = [];

    await this.prisma.productImportJob.update({
      where: { id: jobId },
      data: { totalRows },
    });

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      processedRows++;

      try {
        const name = row.name || row.Name || row.product_name;
        const priceStr = row.price || row.Price || row.product_price;

        if (!name) {
          throw new Error('Missing required field: name');
        }

        const price = parseFloat(priceStr);
        if (isNaN(price) || price < 0) {
          throw new Error(`Invalid price: "${priceStr}"`);
        }

        const compareAtPrice = row.compareAtPrice || row.compare_at_price;
        const description = row.description || row.Description || '';
        const category = row.category || row.Category || undefined;
        const isFeatured =
          row.isFeatured === 'true' || row.is_featured === 'true' || false;
        const isPublished =
          row.isPublished !== 'false' && row.is_published !== 'false';

        await this.productsService.createSimpleProduct(job.tenantId, {
          name,
          price,
          description: description || undefined,
          compareAtPrice: compareAtPrice
            ? parseFloat(compareAtPrice)
            : undefined,
          isFeatured,
          isPublished,
        });

        successCount++;
      } catch (err: any) {
        errorCount++;
        errors.push({ row: i + 2, error: err.message }); // +2 for 1-indexed + header row
      }

      // Update progress every 10 rows
      if (processedRows % 10 === 0 || processedRows === totalRows) {
        await this.prisma.productImportJob.update({
          where: { id: jobId },
          data: { processedRows, successCount, errorCount, errors },
        });
      }
    }

    await this.prisma.productImportJob.update({
      where: { id: jobId },
      data: {
        status: errorCount === totalRows ? 'failed' : 'completed',
        processedRows,
        successCount,
        errorCount,
        errors,
        completedAt: new Date(),
      },
    });

    this.logger.log(
      `Import job ${jobId}: ${successCount} success, ${errorCount} errors out of ${totalRows} rows`,
    );
  }

  async getImportStatus(tenantId: string, jobId: string) {
    const job = await this.prisma.productImportJob.findFirst({
      where: { id: jobId, tenantId },
    });

    if (!job) {
      throw new NotFoundException('Import job not found');
    }

    return {
      id: job.id,
      fileName: job.fileName,
      status: job.status,
      totalRows: job.totalRows,
      processedRows: job.processedRows,
      successCount: job.successCount,
      errorCount: job.errorCount,
      errors: Array.isArray(job.errors) ? job.errors : [],
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      createdAt: job.createdAt,
    };
  }

  async listImports(tenantId: string) {
    const jobs = await this.prisma.productImportJob.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        fileName: true,
        status: true,
        totalRows: true,
        successCount: true,
        errorCount: true,
        createdAt: true,
        completedAt: true,
      },
    });

    return jobs;
  }
}
