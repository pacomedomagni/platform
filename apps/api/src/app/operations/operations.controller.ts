import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Res,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
  Request,
} from '@nestjs/common';
import { Response, Request as ExpressRequest } from 'express';
import { AuthGuard, RolesGuard, Roles, AuthenticatedUser } from '@platform/auth';
import { Tenant } from '../tenant.middleware';
import { AuditLogService } from './audit-log.service';
import { WebhookService } from './webhook.service';
import { BackgroundJobService } from './background-job.service';
import { ImportExportService } from './import-export.service';
import { NotificationService } from './notification.service';
import {
  AuditLogQueryDto,
  CreateWebhookDto,
  UpdateWebhookDto,
  CreateJobDto,
} from './operations.dto';

interface TenantContext {
  tenantId: string;
  userId?: string;
}

interface RequestWithUser extends ExpressRequest {
  user: AuthenticatedUser;
}

@Controller('operations')
@UseGuards(AuthGuard, RolesGuard)
export class OperationsController {
  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly webhookService: WebhookService,
    private readonly jobService: BackgroundJobService,
    private readonly importExportService: ImportExportService,
    private readonly notificationService: NotificationService,
  ) {}

  private getContext(tenantId: string, req: RequestWithUser): TenantContext {
    return { tenantId, userId: req.user.userId };
  }

  // ==========================================
  // Audit Logs
  // ==========================================

  @Get('audit-logs')
  @Roles('admin')
  async getAuditLogs(
    @Tenant() tenantId: string,
    @Request() req: RequestWithUser,
    @Query() query: AuditLogQueryDto,
  ) {
    const ctx = this.getContext(tenantId, req);
    return this.auditLogService.queryLogs(ctx, {
      ...query,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    });
  }

  @Get('audit-logs/entity/:docType/:docName')
  @Roles('admin')
  async getEntityHistory(
    @Tenant() tenantId: string,
    @Request() req: RequestWithUser,
    @Param('docType') docType: string,
    @Param('docName') docName: string,
  ) {
    const ctx = this.getContext(tenantId, req);
    return this.auditLogService.getEntityHistory(ctx, docType, docName);
  }

  @Get('audit-logs/activity-summary')
  @Roles('admin')
  async getActivitySummary(
    @Tenant() tenantId: string,
    @Request() req: RequestWithUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const ctx = this.getContext(tenantId, req);
    return this.auditLogService.getActivitySummary(ctx, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get('audit-logs/export')
  @Roles('admin')
  async exportAuditLogs(
    @Tenant() tenantId: string,
    @Request() req: RequestWithUser,
    @Query() query: AuditLogQueryDto,
    @Res() res: Response,
  ) {
    const ctx = this.getContext(tenantId, req);
    return this.auditLogService.exportLogs(ctx, {
      ...query,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    }, res);
  }

  // ==========================================
  // Webhooks
  // ==========================================

  @Get('webhooks')
  @Roles('admin')
  async getWebhooks(@Tenant() tenantId: string, @Request() req: RequestWithUser) {
    const ctx = this.getContext(tenantId, req);
    return this.webhookService.findMany(ctx);
  }

  @Get('webhooks/:id')
  @Roles('admin')
  async getWebhook(@Tenant() tenantId: string, @Request() req: RequestWithUser, @Param('id') id: string) {
    const ctx = this.getContext(tenantId, req);
    return this.webhookService.findOne(ctx, id);
  }

  @Post('webhooks')
  @Roles('admin')
  async createWebhook(@Tenant() tenantId: string, @Request() req: RequestWithUser, @Body() dto: CreateWebhookDto) {
    const ctx = this.getContext(tenantId, req);
    return this.webhookService.create(ctx, dto);
  }

  @Put('webhooks/:id')
  @Roles('admin')
  async updateWebhook(
    @Tenant() tenantId: string,
    @Request() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    const ctx = this.getContext(tenantId, req);
    return this.webhookService.update(ctx, id, dto);
  }

  @Delete('webhooks/:id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteWebhook(@Tenant() tenantId: string, @Request() req: RequestWithUser, @Param('id') id: string) {
    const ctx = this.getContext(tenantId, req);
    await this.webhookService.delete(ctx, id);
  }

  @Post('webhooks/:id/test')
  @Roles('admin')
  async testWebhook(@Tenant() tenantId: string, @Request() req: RequestWithUser, @Param('id') id: string) {
    const ctx = this.getContext(tenantId, req);
    return this.webhookService.testWebhook(ctx, id);
  }

  @Get('webhooks/:id/deliveries')
  @Roles('admin')
  async getWebhookDeliveries(
    @Tenant() tenantId: string,
    @Request() req: RequestWithUser,
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const ctx = this.getContext(tenantId, req);
    return this.webhookService.getDeliveries(ctx, id, { page, limit });
  }

  @Post('webhooks/deliveries/:deliveryId/retry')
  @Roles('admin')
  async retryWebhookDelivery(
    @Tenant() tenantId: string,
    @Request() req: RequestWithUser,
    @Param('deliveryId') deliveryId: string,
  ) {
    const ctx = this.getContext(tenantId, req);
    return this.webhookService.retryDelivery(ctx, deliveryId);
  }

  // ==========================================
  // Background Jobs
  // ==========================================

  @Get('jobs')
  @Roles('admin')
  async getJobs(
    @Tenant() tenantId: string,
    @Request() req: RequestWithUser,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    const ctx = this.getContext(tenantId, req);
    return this.jobService.findMany(ctx, { type, status, page, limit });
  }

  @Get('jobs/stats')
  @Roles('admin')
  async getJobStats(@Tenant() tenantId: string, @Request() req: RequestWithUser) {
    const ctx = this.getContext(tenantId, req);
    return this.jobService.getStats(ctx);
  }

  @Get('jobs/:id')
  @Roles('admin')
  async getJob(@Tenant() tenantId: string, @Request() req: RequestWithUser, @Param('id') id: string) {
    const ctx = this.getContext(tenantId, req);
    return this.jobService.findOne(ctx, id);
  }

  @Post('jobs')
  @Roles('admin')
  async createJob(@Tenant() tenantId: string, @Request() req: RequestWithUser, @Body() dto: CreateJobDto) {
    const ctx = this.getContext(tenantId, req);
    return this.jobService.createJob(ctx, {
      type: dto.type,
      payload: dto.payload,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
      priority: dto.priority,
    });
  }

  @Post('jobs/:id/cancel')
  @Roles('admin')
  async cancelJob(@Tenant() tenantId: string, @Request() req: RequestWithUser, @Param('id') id: string) {
    const ctx = this.getContext(tenantId, req);
    return this.jobService.cancelJob(ctx, id);
  }

  @Post('jobs/:id/retry')
  @Roles('admin')
  async retryJob(@Tenant() tenantId: string, @Request() req: RequestWithUser, @Param('id') id: string) {
    const ctx = this.getContext(tenantId, req);
    return this.jobService.retryJob(ctx, id);
  }

  // ==========================================
  // Import
  // ==========================================

  @Post('import/:entityType/csv')
  @Roles('admin')
  async importCsv(
    @Tenant() tenantId: string,
    @Request() req: RequestWithUser,
    @Param('entityType') entityType: 'products' | 'customers' | 'inventory',
    @Body('content') content: string,
    @Query('skipDuplicates') skipDuplicates?: string,
    @Query('updateExisting') updateExisting?: string,
    @Query('dryRun') dryRun?: string,
  ) {
    const ctx = this.getContext(tenantId, req);
    return this.importExportService.importCsv(ctx, entityType, content, {
      skipDuplicates: skipDuplicates === 'true',
      updateExisting: updateExisting === 'true',
      dryRun: dryRun === 'true',
    });
  }

  @Post('import/:entityType/json')
  @Roles('admin')
  async importJson(
    @Tenant() tenantId: string,
    @Request() req: RequestWithUser,
    @Param('entityType') entityType: 'products' | 'customers' | 'inventory',
    @Body('content') content: string,
    @Query('skipDuplicates') skipDuplicates?: string,
    @Query('updateExisting') updateExisting?: string,
    @Query('dryRun') dryRun?: string,
  ) {
    const ctx = this.getContext(tenantId, req);
    return this.importExportService.importJson(ctx, entityType, content, {
      skipDuplicates: skipDuplicates === 'true',
      updateExisting: updateExisting === 'true',
      dryRun: dryRun === 'true',
    });
  }

  @Post('import/:entityType/async')
  @Roles('admin')
  async scheduleImport(
    @Tenant() tenantId: string,
    @Request() req: RequestWithUser,
    @Param('entityType') entityType: 'products' | 'customers' | 'inventory',
    @Body() body: { format: 'csv' | 'json'; content: string },
    @Query('skipDuplicates') skipDuplicates?: string,
    @Query('updateExisting') updateExisting?: string,
  ) {
    const ctx = this.getContext(tenantId, req);
    return this.importExportService.scheduleImport(
      ctx,
      entityType,
      body.format,
      body.content,
      {
        skipDuplicates: skipDuplicates === 'true',
        updateExisting: updateExisting === 'true',
      },
    );
  }

  // ==========================================
  // Export
  // ==========================================

  @Get('export/:entityType/csv')
  @Roles('admin')
  async exportCsv(
    @Tenant() tenantId: string,
    @Request() req: RequestWithUser,
    @Param('entityType') entityType: 'products' | 'customers' | 'inventory' | 'orders',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Res() res?: Response,
  ) {
    const ctx = this.getContext(tenantId, req);
    return this.importExportService.exportCsv(ctx, entityType, res!, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get('export/:entityType/json')
  @Roles('admin')
  async exportJson(
    @Tenant() tenantId: string,
    @Request() req: RequestWithUser,
    @Param('entityType') entityType: 'products' | 'customers' | 'inventory' | 'orders',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Res() res?: Response,
  ) {
    const ctx = this.getContext(tenantId, req);
    return this.importExportService.exportJson(ctx, entityType, res!, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  // ==========================================
  // Notifications
  // ==========================================

  @Get('notifications')
  async getNotifications(
    @Tenant() tenantId: string,
    @Request() req: RequestWithUser,
    @Query('types') types?: string,
    @Query('isRead') isRead?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    const ctx = this.getContext(tenantId, req);
    return this.notificationService.findMany(ctx, {
      userId: req.user.userId,
      types: types ? types.split(',') : undefined,
      isRead: isRead !== undefined ? isRead === 'true' : undefined,
      page,
      limit,
    });
  }

  @Get('notifications/unread-count')
  async getUnreadCount(@Tenant() tenantId: string, @Request() req: RequestWithUser) {
    const ctx = this.getContext(tenantId, req);
    const count = await this.notificationService.getUnreadCount(ctx, req.user.userId);
    return { count };
  }

  @Get('notifications/:id')
  async getNotification(@Tenant() tenantId: string, @Request() req: RequestWithUser, @Param('id') id: string) {
    const ctx = this.getContext(tenantId, req);
    return this.notificationService.findOne(ctx, id);
  }

  @Put('notifications/:id/read')
  async markAsRead(@Tenant() tenantId: string, @Request() req: RequestWithUser, @Param('id') id: string) {
    const ctx = this.getContext(tenantId, req);
    return this.notificationService.markAsRead(ctx, id);
  }

  @Put('notifications/read-all')
  async markAllAsRead(@Tenant() tenantId: string, @Request() req: RequestWithUser) {
    const ctx = this.getContext(tenantId, req);
    const count = await this.notificationService.markAllAsRead(ctx, req.user.userId);
    return { marked: count };
  }

  @Put('notifications/read-many')
  async markManyAsRead(@Tenant() tenantId: string, @Request() req: RequestWithUser, @Body('ids') ids: string[]) {
    const ctx = this.getContext(tenantId, req);
    const count = await this.notificationService.markManyAsRead(ctx, ids);
    return { marked: count };
  }

  @Delete('notifications/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteNotification(@Tenant() tenantId: string, @Request() req: RequestWithUser, @Param('id') id: string) {
    const ctx = this.getContext(tenantId, req);
    await this.notificationService.delete(ctx, id);
  }

  @Delete('notifications/read')
  async deleteReadNotifications(@Tenant() tenantId: string, @Request() req: RequestWithUser) {
    const ctx = this.getContext(tenantId, req);
    const count = await this.notificationService.deleteRead(ctx, req.user.userId);
    return { deleted: count };
  }
}
