import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@platform/db';
import { DistributedLockService } from '@platform/queue';
import { WebhookService } from '../operations/webhook.service';

/**
 * Cleanup Service
 * Handles periodic cleanup of expired data.
 *
 * Phase 3 W3.2: every @Cron handler is wrapped in a Redis distributed lock
 * via `withCronLock()` so it fires on exactly one API pod per interval.
 * Without this, every pod runs the same cron — N pods × N× cleanup work,
 * duplicate password-reset deletions, the failed-operations queue polled
 * N×, etc. Lock TTLs are sized to be 2× the expected job runtime; the
 * cleanup tasks are short enough that no heartbeat is needed.
 */
@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly webhookService: WebhookService,
    private readonly lockService: DistributedLockService,
  ) {}

  /** Helper that wraps a cron handler in the W3.2 distributed lock. */
  private async withCronLock<T>(
    name: string,
    ttlMs: number,
    fn: () => Promise<T>,
  ): Promise<T | null> {
    return this.lockService.withLock(`cron:cleanup:${name}`, ttlMs, fn);
  }

  /**
   * Clean up expired carts and release stock reservations
   * Runs every 10 minutes
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async cleanupExpiredCarts() {
    return this.withCronLock('expiredCarts', 5 * 60_000, () => this.runExpiredCartCleanup());
  }

  private async runExpiredCartCleanup() {
    this.logger.log('Starting expired cart cleanup...');

    try {
      const now = new Date();
      const batchSize = 100;

      // Find expired carts
      const expiredCarts = await this.prisma.cart.findMany({
        where: {
          status: 'active',
          expiresAt: { lt: now },
        },
        take: batchSize,
        include: {
          items: {
            include: {
              product: {
                include: {
                  item: true,
                },
              },
            },
          },
        },
      });

      if (expiredCarts.length === 0) {
        this.logger.log('No expired carts found');
        return;
      }

      this.logger.log(`Found ${expiredCarts.length} expired carts`);

      let cleanedCount = 0;
      let failedCount = 0;

      // Process each cart in a transaction
      for (const cart of expiredCarts) {
        try {
          await this.prisma.$transaction(async (tx) => {
            // Re-check expiry inside transaction to prevent race with concurrent checkout
            const freshCart = await tx.cart.findUnique({
              where: { id: cart.id },
              select: { status: true, expiresAt: true },
            });
            if (!freshCart || freshCart.status !== 'active' || !freshCart.expiresAt || freshCart.expiresAt > now) {
              return; // Cart was extended by concurrent checkout or already processed
            }

            // Release stock reservations for all items
            const warehouse = await tx.warehouse.findFirst({
              where: {
                tenantId: cart.tenantId,
                isActive: true,
              },
              orderBy: { createdAt: 'asc' },
            });

            if (warehouse) {
              for (const item of cart.items) {
                // Safe decrement: only release if reservedQty >= quantity to prevent negative values
                await tx.$executeRaw`
                  UPDATE warehouse_item_balances
                  SET "reservedQty" = "reservedQty" - ${item.quantity}
                  WHERE "tenantId" = ${cart.tenantId}
                    AND "itemId" = ${item.product.item.id}
                    AND "warehouseId" = ${warehouse.id}
                    AND "reservedQty" >= ${item.quantity}
                `;
              }
            }

            // Mark cart as abandoned
            await tx.cart.update({
              where: { id: cart.id },
              data: {
                status: 'abandoned',
                abandonedAt: now,
              },
            });
          });

          cleanedCount++;
        } catch (error) {
          failedCount++;
          this.logger.error(
            `Failed to clean up cart ${cart.id}:`,
            error instanceof Error ? error.message : String(error)
          );
        }
      }

      this.logger.log(
        `Cart cleanup complete: ${cleanedCount} cleaned, ${failedCount} failed`
      );
    } catch (error) {
      this.logger.error(
        'Error during cart cleanup:',
        error instanceof Error ? error.stack : String(error)
      );
    }
  }

  /**
   * Clean up expired password reset tokens
   * Runs daily at 2 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupExpiredPasswordResets() {
    return this.withCronLock('expiredPasswordResets', 30 * 60_000, () => this.runExpiredPasswordResetCleanup());
  }

  private async runExpiredPasswordResetCleanup() {
    this.logger.log('Starting password reset token cleanup...');

    try {
      const now = new Date();

      const result = await this.prisma.passwordReset.deleteMany({
        where: {
          expiresAt: { lt: now },
        },
      });

      this.logger.log(`Deleted ${result.count} expired password reset tokens`);
    } catch (error) {
      this.logger.error(
        'Error during password reset cleanup:',
        error instanceof Error ? error.stack : String(error)
      );
    }
  }

  /**
   * Clean up old abandoned carts (older than 30 days)
   * Runs daily at 3 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupOldAbandonedCarts() {
    return this.withCronLock('oldAbandonedCarts', 30 * 60_000, () => this.runOldAbandonedCartCleanup());
  }

  private async runOldAbandonedCartCleanup() {
    this.logger.log('Starting old abandoned cart cleanup...');

    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // M-4: Process in batches of 1000 and loop until no more found
      let totalDeleted = 0;

      while (true) {
        const cartIds = await this.prisma.cart.findMany({
          where: {
            status: 'abandoned',
            abandonedAt: { lt: thirtyDaysAgo },
          },
          select: { id: true },
          take: 1000,
        });

        if (cartIds.length === 0) break;

        // Delete cart items first (foreign key constraint)
        await this.prisma.$transaction([
          this.prisma.cartItem.deleteMany({
            where: {
              cartId: { in: cartIds.map((c) => c.id) },
            },
          }),
          this.prisma.cart.deleteMany({
            where: {
              id: { in: cartIds.map((c) => c.id) },
            },
          }),
        ]);

        totalDeleted += cartIds.length;

        if (cartIds.length < 1000) break;
      }

      if (totalDeleted === 0) {
        this.logger.log('No old abandoned carts found');
      } else {
        this.logger.log(`Deleted ${totalDeleted} old abandoned carts`);
      }
    } catch (error) {
      this.logger.error(
        'Error during abandoned cart cleanup:',
        error instanceof Error ? error.stack : String(error)
      );
    }
  }

  /**
   * Clean up old audit logs (older than 90 days)
   * Runs weekly on Sunday at 4 AM
   *
   * Design note: This cleanup is intentionally global (not scoped per tenant).
   * Audit logs older than 90 days are deleted regardless of tenant because the
   * retention policy is system-wide. Per-tenant retention would require iterating
   * all tenants and adds complexity with minimal benefit since the age threshold
   * applies uniformly.
   */
  @Cron(CronExpression.EVERY_WEEK)
  async cleanupOldAuditLogs() {
    return this.withCronLock('oldAuditLogs', 60 * 60_000, () => this.runOldAuditLogCleanup());
  }

  private async runOldAuditLogCleanup() {
    this.logger.log('Starting old audit log cleanup...');

    try {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const result = await this.prisma.auditLog.deleteMany({
        where: {
          createdAt: { lt: ninetyDaysAgo },
        },
      });

      this.logger.log(`Deleted ${result.count} old audit log entries`);
    } catch (error) {
      this.logger.error(
        'Error during audit log cleanup:',
        error instanceof Error ? error.stack : String(error)
      );
    }

    // L-8: Clean up old webhook deliveries as part of the weekly cleanup
    try {
      await this.webhookService.cleanupOldDeliveries();
    } catch (error) {
      this.logger.error(
        'Error during webhook delivery cleanup:',
        error instanceof Error ? error.stack : String(error)
      );
    }

    // M2: Clean up old processed webhook events (older than 7 days)
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const result = await this.prisma.$executeRaw`
        DELETE FROM processed_webhook_events
        WHERE "processedAt" < ${sevenDaysAgo}
      `;

      this.logger.log(`Deleted ${result} old processed webhook events`);
    } catch (error) {
      this.logger.error(
        'Error during webhook events cleanup:',
        error instanceof Error ? error.stack : String(error)
      );
    }
  }
}
