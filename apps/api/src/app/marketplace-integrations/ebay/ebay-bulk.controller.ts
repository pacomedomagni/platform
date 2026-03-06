import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard, RolesGuard, Roles } from '@platform/auth';
import { Tenant } from '../../tenant.middleware';
import { EbayBulkService } from './ebay-bulk.service';

/**
 * eBay Bulk Operations API Controller
 * Manages feed-based bulk inventory operations via the eBay Sell Feed API.
 */
@Controller('marketplace/bulk')
@UseGuards(AuthGuard, RolesGuard)
@Throttle({ short: { limit: 10, ttl: 1000 }, medium: { limit: 30, ttl: 60000 } })
export class EbayBulkController {
  constructor(private bulkService: EbayBulkService) {}

  /**
   * Create a bulk operation task
   * POST /api/marketplace/bulk
   */
  @Post()
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async createTask(
    @Tenant() tenantId: string,
    @Body() body: { connectionId: string; feedType: string }
  ) {
    if (!body.connectionId || !body.feedType) {
      throw new HttpException(
        'connectionId and feedType are required',
        HttpStatus.BAD_REQUEST
      );
    }

    const result = await this.bulkService.createInventoryTask(
      body.connectionId,
      body.feedType
    );
    return { success: true, ...result };
  }

  /**
   * Upload feed file to a task
   * POST /api/marketplace/bulk/:taskId/upload
   */
  @Post(':taskId/upload')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async uploadFile(
    @Tenant() tenantId: string,
    @Param('taskId') taskId: string,
    @Body() body: { connectionId: string; fileContent: string }
  ) {
    if (!body.connectionId || !body.fileContent) {
      throw new HttpException(
        'connectionId and fileContent (base64) are required',
        HttpStatus.BAD_REQUEST
      );
    }

    const fileBuffer = Buffer.from(body.fileContent, 'base64');
    const result = await this.bulkService.uploadFeedFile(
      body.connectionId,
      taskId,
      fileBuffer
    );
    return { success: true, ...result };
  }

  /**
   * Submit task for processing
   * POST /api/marketplace/bulk/:taskId/submit
   */
  @Post(':taskId/submit')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async submitTask(
    @Tenant() tenantId: string,
    @Param('taskId') taskId: string,
    @Body() body: { connectionId: string }
  ) {
    if (!body.connectionId) {
      throw new HttpException(
        'connectionId is required',
        HttpStatus.BAD_REQUEST
      );
    }

    const result = await this.bulkService.submitTask(body.connectionId, taskId);
    return { success: true, ...result };
  }

  /**
   * Get task status
   * GET /api/marketplace/bulk/:taskId?connectionId=...
   */
  @Get(':taskId')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async getTaskStatus(
    @Tenant() tenantId: string,
    @Param('taskId') taskId: string,
    @Query('connectionId') connectionId: string
  ) {
    if (!connectionId) {
      throw new HttpException(
        'connectionId query parameter is required',
        HttpStatus.BAD_REQUEST
      );
    }

    return this.bulkService.getTaskStatus(connectionId, taskId);
  }

  /**
   * Download result file for a completed task
   * GET /api/marketplace/bulk/:taskId/result?connectionId=...
   */
  @Get(':taskId/result')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async downloadResult(
    @Tenant() tenantId: string,
    @Param('taskId') taskId: string,
    @Query('connectionId') connectionId: string
  ) {
    if (!connectionId) {
      throw new HttpException(
        'connectionId query parameter is required',
        HttpStatus.BAD_REQUEST
      );
    }

    return this.bulkService.downloadResultFile(connectionId, taskId);
  }

  /**
   * Bulk update price and/or quantity for multiple SKUs
   * POST /api/marketplace/bulk/price-quantity
   */
  @Post('price-quantity')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async bulkUpdatePriceQuantity(
    @Tenant() tenantId: string,
    @Body()
    body: {
      connectionId: string;
      items: Array<{ sku: string; price?: number; quantity?: number }>;
    }
  ) {
    if (!body.connectionId || !body.items || !Array.isArray(body.items)) {
      throw new HttpException(
        'connectionId and items[] are required',
        HttpStatus.BAD_REQUEST
      );
    }

    if (body.items.length === 0) {
      throw new HttpException(
        'items array must not be empty',
        HttpStatus.BAD_REQUEST
      );
    }

    const result = await this.bulkService.bulkUpdatePriceQuantity(
      body.connectionId,
      body.items
    );
    return { success: true, ...result };
  }
}
