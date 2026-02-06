import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { Response } from 'express';

interface TenantContext {
  tenantId: string;
  userId?: string;
}

interface AuditLogEntry {
  action: string;
  docType: string;
  docName: string;
  meta?: Record<string, unknown>;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create an audit log entry
   */
  async log(ctx: TenantContext, entry: AuditLogEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          action: entry.action,
          docType: entry.docType,
          docName: entry.docName,
          meta: entry.meta as any || null,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to create audit log: ${error}`);
      // Don't throw - audit logging should not break the main operation
    }
  }

  /**
   * Query audit logs with filters
   */
  async queryLogs(
    ctx: TenantContext,
    filters: {
      startDate?: Date;
      endDate?: Date;
      userId?: string;
      docType?: string;
      action?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    const where: any = { tenantId: ctx.tenantId };

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    if (filters.userId) where.userId = filters.userId;
    if (filters.docType) where.docType = filters.docType;
    if (filters.action) where.action = filters.action;

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters.limit || 50,
        skip: filters.offset || 0,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs.map(log => ({
        id: log.id,
        action: log.action,
        docType: log.docType,
        docName: log.docName,
        meta: log.meta,
        userId: log.userId,
        createdAt: log.createdAt,
      })),
      total,
      hasMore: (filters.offset || 0) + logs.length < total,
    };
  }

  /**
   * Get entity history by document name
   */
  async getEntityHistory(ctx: TenantContext, docType: string, docName: string) {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        tenantId: ctx.tenantId,
        docType,
        docName,
      },
      orderBy: { createdAt: 'desc' },
    });

    return logs.map(log => ({
      id: log.id,
      action: log.action,
      docType: log.docType,
      docName: log.docName,
      meta: log.meta,
      userId: log.userId,
      createdAt: log.createdAt,
    }));
  }

  /**
   * Export audit logs to CSV
   */
  async exportLogs(
    ctx: TenantContext,
    filters: {
      startDate?: Date;
      endDate?: Date;
      userId?: string;
      docType?: string;
      action?: string;
    },
    res: Response
  ): Promise<void> {
    const where: any = { tenantId: ctx.tenantId };

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    if (filters.userId) where.userId = filters.userId;
    if (filters.docType) where.docType = filters.docType;
    if (filters.action) where.action = filters.action;

    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const csvRows: string[] = [
      '"id","action","docType","docName","userId","createdAt"',
    ];

    for (const log of logs) {
      csvRows.push(
        `"${log.id}","${log.action}","${log.docType}","${log.docName}","${log.userId || ''}","${log.createdAt.toISOString()}"`
      );
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
    res.send(csvRows.join('\n'));
  }

  /**
   * Get activity summary for a time period
   */
  async getActivitySummary(
    ctx: TenantContext,
    options: { startDate?: Date; endDate?: Date }
  ) {
    const where: any = { tenantId: ctx.tenantId };

    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) where.createdAt.gte = options.startDate;
      if (options.endDate) where.createdAt.lte = options.endDate;
    }

    // Get counts by action
    const actionCounts = await this.prisma.auditLog.groupBy({
      by: ['action'],
      where,
      _count: { action: true },
      orderBy: { _count: { action: 'desc' } },
    });

    // Get counts by docType
    const typeCounts = await this.prisma.auditLog.groupBy({
      by: ['docType'],
      where,
      _count: { docType: true },
      orderBy: { _count: { docType: 'desc' } },
    });

    // Get counts by user
    const userCounts = await this.prisma.auditLog.groupBy({
      by: ['userId'],
      where,
      _count: { userId: true },
      orderBy: { _count: { userId: 'desc' } },
      take: 10,
    });

    const totalCount = await this.prisma.auditLog.count({ where });

    return {
      total: totalCount,
      byAction: actionCounts.map(a => ({
        action: a.action,
        count: a._count.action,
      })),
      byDocType: typeCounts.map(t => ({
        docType: t.docType,
        count: t._count.docType,
      })),
      byUser: userCounts.map(u => ({
        userId: u.userId,
        count: u._count.userId,
      })),
    };
  }

  /**
   * Log common actions with helper methods
   */
  async logCreate(ctx: TenantContext, docType: string, docName: string, meta?: Record<string, unknown>) {
    return this.log(ctx, { action: 'create', docType, docName, meta });
  }

  async logUpdate(ctx: TenantContext, docType: string, docName: string, meta?: Record<string, unknown>) {
    return this.log(ctx, { action: 'update', docType, docName, meta });
  }

  async logDelete(ctx: TenantContext, docType: string, docName: string, meta?: Record<string, unknown>) {
    return this.log(ctx, { action: 'delete', docType, docName, meta });
  }

  async logView(ctx: TenantContext, docType: string, docName: string, meta?: Record<string, unknown>) {
    return this.log(ctx, { action: 'view', docType, docName, meta });
  }

  async logExport(ctx: TenantContext, docType: string, docName: string, meta?: Record<string, unknown>) {
    return this.log(ctx, { action: 'export', docType, docName, meta });
  }
}
