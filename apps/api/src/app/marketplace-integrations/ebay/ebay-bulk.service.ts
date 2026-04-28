import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { ClsService } from 'nestjs-cls';
import { EbayStoreService } from './ebay-store.service';
import { MarketplaceAuditService } from '../shared/marketplace-audit.service';

/**
 * eBay Bulk Operations Service
 * Manages bulk inventory and listing operations via the eBay Sell Feed API.
 * Supports creating feed tasks, uploading feed files, submitting tasks for
 * processing, checking task status, and downloading result files.
 */
@Injectable()
export class EbayBulkService {
  private readonly logger = new Logger(EbayBulkService.name);
  private readonly mockMode = process.env.MOCK_EXTERNAL_SERVICES === 'true';

  constructor(
    private prisma: PrismaService,
    private cls: ClsService,
    private ebayStore: EbayStoreService,
    private audit: MarketplaceAuditService
  ) {}

  /**
   * Create a feed task on eBay for a given feed type.
   * Supported feed types: CREATE_INVENTORY, UPDATE_INVENTORY, DELETE_INVENTORY,
   * LMS_ADD_FIXED_PRICE_ITEM, LMS_REVISE_FIXED_PRICE_ITEM, etc.
   */
  async createInventoryTask(
    connectionId: string,
    feedType: string
  ): Promise<any> {
    if (this.mockMode) {
      const mockTaskId = `mock_task_${Date.now()}`;
      this.logger.log(
        `[MOCK] Created feed task: ${feedType} (${mockTaskId}) for connection ${connectionId}`
      );
      return {
        taskId: mockTaskId,
        feedType,
        status: 'CREATED',
        creationDate: new Date().toISOString(),
      };
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const response = await (client.sell as any).feed.createTask({
        feedType,
        schemaVersion: '1.0',
      });

      const taskId =
        response?.taskId ||
        response?.taskHref?.split('/').pop() ||
        `ebay_task_${Date.now()}`;

      this.logger.log(
        `Created feed task: ${feedType} (${taskId}) for connection ${connectionId}`
      );

      return {
        taskId,
        feedType,
        status: response?.status || 'CREATED',
        creationDate: response?.creationDate || new Date().toISOString(),
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to create feed task ${feedType} for connection ${connectionId}: ${error?.message || String(error)}`,
        error
      );
      throw error;
    }
  }

  /**
   * Upload a feed file (TSV or XML content) to an existing task.
   * The file content should be provided as a Buffer.
   */
  async uploadFeedFile(
    connectionId: string,
    taskId: string,
    fileContent: Buffer
  ): Promise<any> {
    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Uploaded feed file (${fileContent.length} bytes) to task ${taskId} for connection ${connectionId}`
      );
      return {
        taskId,
        status: 'COMPLETED',
        message: '[MOCK] Feed file uploaded successfully',
      };
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const response = await (client.sell as any).feed.uploadFile(taskId, {
        fileName: `feed_${taskId}.tsv`,
        content: fileContent,
      });

      this.logger.log(
        `Uploaded feed file (${fileContent.length} bytes) to task ${taskId} for connection ${connectionId}`
      );

      return {
        taskId,
        status: response?.status || 'COMPLETED',
        message: 'Feed file uploaded successfully',
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to upload feed file to task ${taskId} for connection ${connectionId}: ${error?.message || String(error)}`,
        error
      );
      throw error;
    }
  }

  /**
   * Submit a task for processing after the feed file has been uploaded.
   * This starts the asynchronous processing of the feed.
   */
  async submitTask(connectionId: string, taskId: string): Promise<any> {
    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Submitted task ${taskId} for processing for connection ${connectionId}`
      );
      return {
        taskId,
        status: 'IN_PROCESS',
        message: '[MOCK] Task submitted for processing',
      };
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const response = await (client.sell as any).feed.submitTask(taskId);

      this.logger.log(
        `Submitted task ${taskId} for processing for connection ${connectionId}`
      );

      return {
        taskId,
        status: response?.status || 'IN_PROCESS',
        message: 'Task submitted for processing',
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to submit task ${taskId} for connection ${connectionId}: ${error?.message || String(error)}`,
        error
      );
      throw error;
    }
  }

  /**
   * Get the current status of a feed task.
   * Returns task metadata including status, completion percentage, and result summary.
   */
  async getTaskStatus(connectionId: string, taskId: string): Promise<any> {
    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Fetched status for task ${taskId} for connection ${connectionId}`
      );
      return {
        taskId,
        status: 'COMPLETED',
        feedType: 'CREATE_INVENTORY',
        creationDate: new Date(Date.now() - 3600000).toISOString(),
        completionDate: new Date().toISOString(),
        uploadSummary: {
          successCount: 50,
          failureCount: 2,
        },
      };
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const response = await (client.sell as any).feed.getTask(taskId);

      this.logger.log(
        `Fetched status for task ${taskId}: ${response?.status || 'UNKNOWN'} for connection ${connectionId}`
      );

      return {
        taskId: response?.taskId || taskId,
        status: response?.status || 'UNKNOWN',
        feedType: response?.feedType || null,
        creationDate: response?.creationDate || null,
        completionDate: response?.completionDate || null,
        uploadSummary: response?.uploadSummary || null,
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch status for task ${taskId} for connection ${connectionId}: ${error?.message || String(error)}`,
        error
      );
      throw error;
    }
  }

  /**
   * Download the result file for a completed feed task.
   * Returns the result file content as a Buffer.
   */
  async downloadResultFile(
    connectionId: string,
    taskId: string
  ): Promise<any> {
    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Downloaded result file for task ${taskId} for connection ${connectionId}`
      );
      const mockContent =
        'SKU\tStatus\tMessage\n' +
        'SKU001\tSUCCESS\tItem created\n' +
        'SKU002\tSUCCESS\tItem created\n' +
        'SKU003\tFAILURE\tInvalid category\n';
      return {
        taskId,
        content: Buffer.from(mockContent).toString('base64'),
        contentType: 'text/tab-separated-values',
      };
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const response = await (client.sell as any).feed.getResultFile(taskId);

      this.logger.log(
        `Downloaded result file for task ${taskId} for connection ${connectionId}`
      );

      // The response may be a Buffer or a stream; normalize to base64
      const content =
        response instanceof Buffer
          ? response.toString('base64')
          : typeof response === 'string'
            ? Buffer.from(response).toString('base64')
            : response?.data
              ? Buffer.from(response.data).toString('base64')
              : null;

      return {
        taskId,
        content,
        contentType: 'text/tab-separated-values',
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to download result file for task ${taskId} for connection ${connectionId}: ${error?.message || String(error)}`,
        error
      );
      throw error;
    }
  }

  /**
   * Convenience method: bulk update price and/or quantity for multiple SKUs.
   * Creates an inventory feed task, generates TSV content, uploads the file,
   * and submits the task for processing.
   */
  async bulkUpdatePriceQuantity(
    connectionId: string,
    items: Array<{ sku: string; price?: number; quantity?: number }>
  ): Promise<any> {
    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Bulk update price/quantity for ${items.length} items on connection ${connectionId}`
      );
      return {
        taskId: `mock_bulk_${Date.now()}`,
        status: 'IN_PROCESS',
        itemCount: items.length,
        message: `[MOCK] Bulk update submitted for ${items.length} items`,
      };
    }

    try {
      // Step 1: Create feed task
      const task = await this.createInventoryTask(connectionId, 'LMS_REVISE_INVENTORY_STATUS');

      // Step 2: Generate TSV content
      const tsvLines = ['SKU\tPrice\tQuantity'];
      for (const item of items) {
        const price = item.price !== undefined ? String(item.price) : '';
        const quantity = item.quantity !== undefined ? String(item.quantity) : '';
        tsvLines.push(`${item.sku}\t${price}\t${quantity}`);
      }
      const tsvContent = tsvLines.join('\n');
      const fileBuffer = Buffer.from(tsvContent, 'utf-8');

      // Step 3: Upload feed file
      await this.uploadFeedFile(connectionId, task.taskId, fileBuffer);

      // Step 4: Submit task
      const result = await this.submitTask(connectionId, task.taskId);

      this.logger.log(
        `Bulk update price/quantity submitted: task ${task.taskId} with ${items.length} items for connection ${connectionId}`
      );

      try {
        // Cap the SKU sample to keep the audit row's metadata column from
        // ballooning on huge bulk updates; the full feed file is on eBay
        // and reachable via task.taskId if forensic detail is needed.
        const skuSample = items.slice(0, 25).map((i) => i.sku);
        const truncated = items.length > skuSample.length;
        await this.audit.logBulkOperation(task.taskId, 'BULK_UPDATE_PRICE_QUANTITY', {
          connectionId,
          itemCount: items.length,
          skuSample,
          skuSampleTruncated: truncated,
          firstSku: items[0]?.sku,
          lastSku: items[items.length - 1]?.sku,
        });
      } catch {
        // Non-critical
      }

      return {
        taskId: task.taskId,
        status: result.status,
        itemCount: items.length,
        message: `Bulk update submitted for ${items.length} items`,
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to bulk update price/quantity for connection ${connectionId}: ${error?.message || String(error)}`,
        error
      );
      throw error;
    }
  }
}
