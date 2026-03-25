import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@platform/db';
import { OperationType, OperationStatus, Prisma, FailedOperation } from '@prisma/client';
import { StockMovementService } from '../inventory-management/stock-movement.service';
import { WebhookService } from '../operations/webhook.service';
import { EmailService } from '@platform/email';

interface CreateFailedOperationDto {
  tenantId: string;
  operationType: OperationType;
  referenceId: string;
  referenceType: string;
  payload: Prisma.JsonValue;
  errorMessage?: string;
  errorStack?: string;
}

/**
 * Failed Operations Service
 * Tracks and retries critical operations that failed after payment capture
 */
@Injectable()
export class FailedOperationsService {
  private readonly logger = new Logger(FailedOperationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stockMovementService: StockMovementService,
    private readonly webhookService: WebhookService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Record a failed operation for retry
   */
  async recordFailedOperation(dto: CreateFailedOperationDto) {
    const nextRetryAt = this.calculateNextRetryTime(0);

    try {
      const operation = await this.prisma.failedOperation.create({
        data: {
          tenantId: dto.tenantId,
          operationType: dto.operationType,
          status: OperationStatus.PENDING,
          referenceId: dto.referenceId,
          referenceType: dto.referenceType,
          payload: dto.payload,
          errorMessage: dto.errorMessage,
          errorStack: dto.errorStack,
          attemptCount: 0,
          nextRetryAt,
        },
      });

      this.logger.warn(
        `Recorded failed operation: ${dto.operationType} for ${dto.referenceType} ${dto.referenceId}`
      );

      return operation;
    } catch (error) {
      this.logger.error(
        `Failed to record failed operation:`,
        error instanceof Error ? error.stack : String(error)
      );
      throw error;
    }
  }

  /**
   * Retry pending failed operations
   * Runs every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async retryFailedOperations() {
    this.logger.log('Starting failed operations retry...');

    try {
      const now = new Date();
      const batchSize = 50;

      // M-5: Use SELECT FOR UPDATE SKIP LOCKED to atomically claim operations,
      // preventing duplicate processing across distributed workers
      const operations = await this.prisma.$queryRaw<FailedOperation[]>`
        UPDATE failed_operations
        SET status = ${OperationStatus.RETRYING}::"OperationStatus",
            "attemptCount" = "attemptCount" + 1,
            "lastAttemptAt" = ${now}
        WHERE id IN (
          SELECT id FROM failed_operations
          WHERE status IN (${OperationStatus.PENDING}::"OperationStatus", ${OperationStatus.RETRYING}::"OperationStatus")
            AND "nextRetryAt" <= ${now}
            AND "attemptCount" < 5
          ORDER BY "nextRetryAt" ASC
          LIMIT ${batchSize}
          FOR UPDATE SKIP LOCKED
        )
        RETURNING *
      `;

      if (operations.length === 0) {
        this.logger.log('No failed operations to retry');
        return;
      }

      this.logger.log(`Found ${operations.length} operations to retry`);

      let successCount = 0;
      let failedCount = 0;
      let permanentlyFailedCount = 0;

      for (const operation of operations) {
        try {
          // Execute the operation based on type (already marked as RETRYING by the claim query)
          await this.executeOperation(operation);

          // Mark as succeeded
          await this.prisma.failedOperation.update({
            where: { id: operation.id },
            data: {
              status: OperationStatus.SUCCEEDED,
              succeededAt: now,
            },
          });

          successCount++;
          this.logger.log(
            `Successfully retried ${operation.operationType} for ${operation.referenceType} ${operation.referenceId}`
          );
        } catch (error) {
          failedCount++;
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorStack = error instanceof Error ? error.stack : undefined;

          // attemptCount was already incremented by the claiming UPDATE...RETURNING query above
          const newAttemptCount = operation.attemptCount;
          const maxed = newAttemptCount >= operation.maxAttempts;

          if (maxed) {
            // Permanently failed
            await this.prisma.failedOperation.update({
              where: { id: operation.id },
              data: {
                status: OperationStatus.FAILED,
                errorMessage,
                errorStack,
                failedAt: now,
              },
            });

            permanentlyFailedCount++;
            this.logger.error(
              `Operation ${operation.id} permanently failed after ${newAttemptCount} attempts`
            );
          } else {
            // Schedule next retry with exponential backoff
            const nextRetryAt = this.calculateNextRetryTime(newAttemptCount);

            await this.prisma.failedOperation.update({
              where: { id: operation.id },
              data: {
                status: OperationStatus.PENDING,
                errorMessage,
                errorStack,
                nextRetryAt,
              },
            });

            this.logger.warn(
              `Operation ${operation.id} failed (attempt ${newAttemptCount}/${operation.maxAttempts}), next retry at ${nextRetryAt}`
            );
          }
        }
      }

      this.logger.log(
        `Retry complete: ${successCount} succeeded, ${failedCount} failed, ${permanentlyFailedCount} permanently failed`
      );
    } catch (error) {
      this.logger.error(
        'Error during failed operations retry:',
        error instanceof Error ? error.stack : String(error)
      );
    }
  }

  /**
   * Execute a failed operation based on its type
   */
  private async executeOperation(operation: FailedOperation): Promise<void> {
    switch (operation.operationType) {
      case OperationType.STOCK_DEDUCTION:
        await this.retryStockDeduction(operation);
        break;

      case OperationType.COUPON_TRACKING:
        await this.retryCouponTracking(operation);
        break;

      case OperationType.EMAIL_SEND:
        await this.retryEmailSend(operation);
        break;

      case OperationType.WEBHOOK_DELIVERY:
        await this.retryWebhookDelivery(operation);
        break;

      case OperationType.STOCK_RETURN:
        await this.retryStockReturn(operation);
        break;

      default:
        throw new Error(`Unknown operation type: ${operation.operationType}`);
    }
  }

  /**
   * Retry stock deduction for an order
   */
  private async retryStockDeduction(operation: FailedOperation): Promise<void> {
    const payload = operation.payload as any;
    const { orderId, items, warehouseId } = payload;

    // Idempotency: check if a stock movement audit log already exists for this order
    const existingMovement = await this.prisma.auditLog.findFirst({
      where: {
        tenantId: operation.tenantId,
        docType: 'StockMovement',
        action: 'STOCK_MOVEMENT_CREATED',
        meta: {
          path: ['reference'],
          equals: `Order ${payload.orderNumber}`,
        },
      },
    });
    if (existingMovement) {
      this.logger.log(`Stock deduction already exists for order ${payload.orderNumber}, skipping retry`);
      return;
    }

    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: warehouseId },
    });

    if (!warehouse) {
      throw new Error(`Warehouse ${warehouseId} not found`);
    }

    // Issue stock via stock movement service
    await this.stockMovementService.createMovement(
      { tenantId: operation.tenantId },
      {
        movementType: 'ISSUE' as any,
        postingDate: new Date().toISOString().split('T')[0],
        warehouseCode: warehouse.code,
        items,
        reference: `Order ${payload.orderNumber} (Retry)`,
        remarks: `Stock deduction retry for order ${payload.orderNumber}`,
      }
    );

    this.logger.log(`Successfully deducted stock for order ${payload.orderNumber}`);
  }

  /**
   * Retry stock return for a refunded order
   */
  private async retryStockReturn(operation: FailedOperation): Promise<void> {
    const payload = operation.payload as any;
    const { orderId, orderNumber } = payload;

    // Idempotency: check if a stock return audit log already exists for this refund
    const existingMovement = await this.prisma.auditLog.findFirst({
      where: {
        tenantId: operation.tenantId,
        docType: 'StockMovement',
        action: 'STOCK_MOVEMENT_CREATED',
        meta: {
          path: ['reference'],
          equals: `Refund for Order ${orderNumber}`,
        },
      },
    });
    if (existingMovement) {
      this.logger.log(`Stock return already exists for order ${orderNumber}, skipping retry`);
      return;
    }

    // Load full order with items
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: { include: { item: true } },
            variant: { include: { item: true } },
          },
        },
      },
    });

    if (!order || !order.items.length) {
      throw new Error(`Order ${orderId} not found or has no items`);
    }

    const warehouse = await this.prisma.warehouse.findFirst({
      where: { tenantId: operation.tenantId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!warehouse) {
      throw new Error(`No active warehouse found for tenant ${operation.tenantId}`);
    }

    const items = order.items.map((orderItem: any) => ({
      itemCode: orderItem.variant?.item?.code || orderItem.product.item.code,
      quantity: orderItem.quantity,
      rate: Number(orderItem.unitPrice),
    }));

    await this.stockMovementService.createMovement(
      { tenantId: operation.tenantId },
      {
        movementType: 'RECEIPT' as any,
        postingDate: new Date().toISOString().split('T')[0],
        warehouseCode: warehouse.code,
        items,
        reference: `Refund for Order ${orderNumber} (Retry)`,
        remarks: `Stock return retry for refunded order ${orderNumber}`,
      }
    );

    this.logger.log(`Successfully returned stock for refunded order ${orderNumber}`);
  }

  /**
   * Retry coupon tracking for an order
   */
  private async retryCouponTracking(operation: FailedOperation): Promise<void> {
    const payload = operation.payload as any;
    const { couponId, customerId, orderId } = payload;

    // H-3: Idempotency check - if couponUsage already exists for this order+coupon, skip
    const existingUsage = await this.prisma.couponUsage.findFirst({
      where: { orderId, couponId },
    });
    if (existingUsage) {
      this.logger.log(`Coupon usage already recorded for order ${orderId} and coupon ${couponId}, marking as resolved`);
      return;
    }

    await this.prisma.$transaction([
      // Increment coupon usage
      this.prisma.coupon.update({
        where: { id: couponId },
        data: { timesUsed: { increment: 1 } },
      }),
      // Create usage tracking record
      this.prisma.couponUsage.create({
        data: {
          tenantId: operation.tenantId,
          couponId,
          customerId,
          orderId,
          usedAt: new Date(),
        },
      }),
    ]);

    this.logger.log(`Successfully tracked coupon usage for order ${orderId}`);
  }

  /**
   * Retry email send
   */
  private async retryEmailSend(operation: FailedOperation): Promise<void> {
    const payload = operation.payload as any;
    const { emailOptions } = payload;

    if (!emailOptions) {
      throw new Error('Email payload missing emailOptions');
    }

    await this.emailService.send(emailOptions);

    this.logger.log(`Successfully retried email send for ${operation.referenceId}`);
  }

  /**
   * Retry webhook delivery
   */
  private async retryWebhookDelivery(operation: FailedOperation): Promise<void> {
    const payload = operation.payload as any;
    const { webhookId, event: webhookEvent } = payload;

    if (!webhookId || !webhookEvent) {
      throw new Error('Webhook payload missing webhookId or event');
    }

    const webhook = await this.prisma.webhook.findUnique({
      where: { id: webhookId },
    });

    if (!webhook) {
      throw new Error(`Webhook ${webhookId} not found`);
    }

    await this.webhookService.triggerEvent(
      { tenantId: operation.tenantId },
      {
        event: webhookEvent.event,
        payload: webhookEvent.payload || {},
        timestamp: new Date(),
      },
    );

    this.logger.log(`Successfully retried webhook delivery for ${operation.referenceId}`);
  }

  /**
   * Calculate next retry time with exponential backoff
   * Retry intervals: 5min, 15min, 1hour, 4hours, 12hours
   */
  private calculateNextRetryTime(attemptCount: number): Date {
    const backoffMinutes = [5, 15, 60, 240, 720];
    const minutes = backoffMinutes[Math.min(attemptCount, backoffMinutes.length - 1)];
    const nextRetry = new Date();
    nextRetry.setMinutes(nextRetry.getMinutes() + minutes);
    return nextRetry;
  }

  /**
   * Clean up old succeeded operations
   * Runs daily at 1 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async cleanupOldOperations() {
    this.logger.log('Starting cleanup of old succeeded operations...');

    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const result = await this.prisma.failedOperation.deleteMany({
        where: {
          status: OperationStatus.SUCCEEDED,
          succeededAt: { lt: sevenDaysAgo },
        },
      });

      this.logger.log(`Deleted ${result.count} old succeeded operations`);
    } catch (error) {
      this.logger.error(
        'Error during operation cleanup:',
        error instanceof Error ? error.stack : String(error)
      );
    }
  }
}
