import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { Prisma } from '@prisma/client';

interface TenantContext {
  tenantId: string;
  userId?: string;
}

export enum NotificationType {
  ORDER_RECEIVED = 'order.received',
  ORDER_SHIPPED = 'order.shipped',
  ORDER_DELIVERED = 'order.delivered',
  ORDER_CANCELLED = 'order.cancelled',
  PAYMENT_RECEIVED = 'payment.received',
  PAYMENT_FAILED = 'payment.failed',
  INVENTORY_LOW = 'inventory.low',
  INVENTORY_OUT = 'inventory.out',
  CUSTOMER_REGISTERED = 'customer.registered',
  REPORT_READY = 'report.ready',
  IMPORT_COMPLETE = 'import.complete',
  EXPORT_READY = 'export.ready',
  SYSTEM_ALERT = 'system.alert',
}

// Internal interfaces for the service (different from API DTOs)
export interface CreateNotificationInput {
  userId: string;
  type: NotificationType | string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  link?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  expiresAt?: Date;
}

export interface NotificationQuery {
  userId?: string;
  types?: string[];
  isRead?: boolean;
  priority?: string;
  page?: number;
  limit?: number;
}

// Notification record type returned from Prisma
type NotificationRecord = {
  id: string;
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  data: Prisma.JsonValue | null;
  link: string | null;
  priority: string;
  isRead: boolean;
  readAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  
  // Real-time subscriptions (kept in-memory since these are ephemeral WebSocket callbacks)
  private notificationSubscriptions: Map<string, Array<(notification: NotificationRecord) => void>> = new Map();

  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // Create Notifications
  // ==========================================

  /**
   * Create a notification for a user
   */
  async create(ctx: TenantContext, dto: CreateNotificationInput): Promise<NotificationRecord> {
    const notification = await this.prisma.notification.create({
      data: {
        tenantId: ctx.tenantId,
        userId: dto.userId,
        type: dto.type,
        title: dto.title,
        message: dto.message,
        data: dto.data ? (dto.data as Prisma.InputJsonValue) : Prisma.JsonNull,
        link: dto.link,
        priority: dto.priority || 'normal',
        isRead: false,
        expiresAt: dto.expiresAt,
      },
    });

    // Notify subscribers (real-time)
    this.notifySubscribers(notification);

    this.logger.debug(`Created notification ${notification.id} for user ${dto.userId}`);
    return notification;
  }

  /**
   * Create notifications for multiple users
   */
  async createBulk(
    ctx: TenantContext,
    userIds: string[],
    dto: Omit<CreateNotificationInput, 'userId'>
  ): Promise<NotificationRecord[]> {
    const notifications: NotificationRecord[] = [];

    for (const userId of userIds) {
      const notification = await this.create(ctx, { ...dto, userId });
      notifications.push(notification);
    }

    return notifications;
  }

  /**
   * Create notification for all users with a specific role
   */
  async createForRole(
    ctx: TenantContext,
    role: string,
    dto: Omit<CreateNotificationInput, 'userId'>
  ): Promise<NotificationRecord[]> {
    // Get all users with the role
    const users = await this.prisma.user.findMany({
      where: {
        tenantId: ctx.tenantId,
        roles: { has: role },
      },
      select: { id: true },
    });

    const userIds = users.map(u => u.id);
    return this.createBulk(ctx, userIds, dto);
  }

  // ==========================================
  // Query Notifications
  // ==========================================

  /**
   * Get notifications for a user
   */
  async findMany(
    ctx: TenantContext,
    query: NotificationQuery
  ): Promise<{ data: NotificationRecord[]; total: number; unreadCount: number }> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = {
      tenantId: ctx.tenantId,
      ...(query.userId && { userId: query.userId }),
      ...(query.types && query.types.length > 0 && { type: { in: query.types } }),
      ...(query.isRead !== undefined && { isRead: query.isRead }),
      ...(query.priority && { priority: query.priority }),
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    };

    const [data, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { ...where, isRead: false },
      }),
    ]);

    return { data, total, unreadCount };
  }

  /**
   * Get a single notification
   */
  async findOne(ctx: TenantContext, id: string): Promise<NotificationRecord> {
    const notification = await this.prisma.notification.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return notification;
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(ctx: TenantContext, userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        tenantId: ctx.tenantId,
        userId,
        isRead: false,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });
  }

  // ==========================================
  // Update Notifications
  // ==========================================

  /**
   * Mark a notification as read
   */
  async markAsRead(ctx: TenantContext, id: string): Promise<NotificationRecord> {
    // Verify ownership
    await this.findOne(ctx, id);

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * Mark multiple notifications as read
   */
  async markManyAsRead(ctx: TenantContext, ids: string[]): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: {
        id: { in: ids },
        tenantId: ctx.tenantId,
        isRead: false,
      },
      data: { isRead: true, readAt: new Date() },
    });

    return result.count;
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(ctx: TenantContext, userId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: {
        tenantId: ctx.tenantId,
        userId,
        isRead: false,
      },
      data: { isRead: true, readAt: new Date() },
    });

    return result.count;
  }

  // ==========================================
  // Delete Notifications
  // ==========================================

  /**
   * Delete a notification
   */
  async delete(ctx: TenantContext, id: string): Promise<void> {
    // Verify ownership
    await this.findOne(ctx, id);

    await this.prisma.notification.delete({ where: { id } });
  }

  /**
   * Delete all read notifications for a user
   */
  async deleteRead(ctx: TenantContext, userId: string): Promise<number> {
    const result = await this.prisma.notification.deleteMany({
      where: {
        tenantId: ctx.tenantId,
        userId,
        isRead: true,
      },
    });

    return result.count;
  }

  /**
   * Delete expired notifications
   */
  async deleteExpired(): Promise<number> {
    const result = await this.prisma.notification.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    return result.count;
  }

  // ==========================================
  // Real-time Subscriptions
  // ==========================================

  /**
   * Subscribe to notifications for a user
   */
  subscribe(userId: string, callback: (notification: NotificationRecord) => void): () => void {
    if (!this.notificationSubscriptions.has(userId)) {
      this.notificationSubscriptions.set(userId, []);
    }

    this.notificationSubscriptions.get(userId)!.push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.notificationSubscriptions.get(userId);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  private notifySubscribers(notification: NotificationRecord): void {
    const callbacks = this.notificationSubscriptions.get(notification.userId);
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          callback(notification);
        } catch (error) {
          this.logger.error(`Error notifying subscriber: ${error}`);
        }
      }
    }
  }

  // ==========================================
  // Pre-built Notification Templates
  // ==========================================

  /**
   * Notify about a new order
   */
  async notifyNewOrder(ctx: TenantContext, orderNumber: string, total: number): Promise<void> {
    // Notify admins
    await this.createForRole(ctx, 'admin', {
      type: NotificationType.ORDER_RECEIVED,
      title: 'New Order Received',
      message: `Order #${orderNumber} has been placed for $${total.toFixed(2)}`,
      link: `/orders/${orderNumber}`,
      priority: 'normal',
    });
  }

  /**
   * Notify about low inventory
   */
  async notifyLowInventory(
    ctx: TenantContext,
    itemCode: string,
    itemName: string,
    currentQty: number,
    reorderLevel: number
  ): Promise<void> {
    await this.createForRole(ctx, 'admin', {
      type: NotificationType.INVENTORY_LOW,
      title: 'Low Inventory Alert',
      message: `${itemName} (${itemCode}) is low on stock. Current: ${currentQty}, Reorder level: ${reorderLevel}`,
      link: `/inventory/${itemCode}`,
      priority: 'high',
    });
  }

  /**
   * Notify about out of stock
   */
  async notifyOutOfStock(ctx: TenantContext, itemCode: string, itemName: string): Promise<void> {
    await this.createForRole(ctx, 'admin', {
      type: NotificationType.INVENTORY_OUT,
      title: 'Out of Stock Alert',
      message: `${itemName} (${itemCode}) is out of stock`,
      link: `/inventory/${itemCode}`,
      priority: 'urgent',
    });
  }

  /**
   * Notify about report ready
   */
  async notifyReportReady(
    ctx: TenantContext,
    userId: string,
    reportName: string,
    downloadLink: string
  ): Promise<void> {
    await this.create(ctx, {
      userId,
      type: NotificationType.REPORT_READY,
      title: 'Report Ready',
      message: `Your ${reportName} report is ready for download`,
      link: downloadLink,
      priority: 'normal',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Expires in 7 days
    });
  }

  /**
   * Notify about import completion
   */
  async notifyImportComplete(
    ctx: TenantContext,
    userId: string,
    entityType: string,
    result: { created: number; updated: number; errors: number }
  ): Promise<void> {
    const hasErrors = result.errors > 0;

    await this.create(ctx, {
      userId,
      type: NotificationType.IMPORT_COMPLETE,
      title: hasErrors ? 'Import Completed with Errors' : 'Import Completed',
      message: `${entityType} import: ${result.created} created, ${result.updated} updated${hasErrors ? `, ${result.errors} errors` : ''}`,
      priority: hasErrors ? 'high' : 'normal',
      data: result,
    });
  }
}
