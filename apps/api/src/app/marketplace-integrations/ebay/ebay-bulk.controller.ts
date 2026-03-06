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
  ValidationPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard, RolesGuard, Roles } from '@platform/auth';
import { Tenant } from '../../tenant.middleware';
import { EbayBulkService } from './ebay-bulk.service';
import {
  CreateBulkTaskDto,
  UploadBulkFileDto,
  SubmitBulkTaskDto,
  BulkUpdatePriceQuantityDto,
} from '../shared/marketplace.dto';

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
    @Body(ValidationPipe) dto: CreateBulkTaskDto
  ) {
    const result = await this.bulkService.createInventoryTask(
      dto.connectionId,
      dto.feedType
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
    @Body(ValidationPipe) dto: UploadBulkFileDto
  ) {
    const fileBuffer = Buffer.from(dto.fileContent, 'base64');
    const result = await this.bulkService.uploadFeedFile(
      dto.connectionId,
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
    @Body(ValidationPipe) dto: SubmitBulkTaskDto
  ) {
    const result = await this.bulkService.submitTask(dto.connectionId, taskId);
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
    @Body(ValidationPipe) dto: BulkUpdatePriceQuantityDto
  ) {
    if (dto.items.length === 0) {
      throw new HttpException(
        'items array must not be empty',
        HttpStatus.BAD_REQUEST
      );
    }

    const result = await this.bulkService.bulkUpdatePriceQuantity(
      dto.connectionId,
      dto.items
    );
    return { success: true, ...result };
  }
}
