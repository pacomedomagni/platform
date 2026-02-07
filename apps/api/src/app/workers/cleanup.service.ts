import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@platform/db';

/**
 * Cleanup Service
 * Handles periodic cleanup of expired data
 */
@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Clean up expired carts and release stock reservations
   * Runs every 15 minutes
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async cleanupExpiredCarts() {
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
                await tx.warehouseItemBalance.updateMany({
                  where: {
                    tenantId: cart.tenantId,
                    itemId: item.product.item.id,
                    warehouseId: warehouse.id,
                  },
                  data: {
                    reservedQty: { decrement: item.quantity },
                  },
                });
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
    this.logger.log('Starting old abandoned cart cleanup...');

    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Delete cart items first (foreign key constraint)
      const cartIds = await this.prisma.cart.findMany({
        where: {
          status: 'abandoned',
          abandonedAt: { lt: thirtyDaysAgo },
        },
        select: { id: true },
      });

      if (cartIds.length === 0) {
        this.logger.log('No old abandoned carts found');
        return;
      }

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

      this.logger.log(`Deleted ${cartIds.length} old abandoned carts`);
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
   */
  @Cron(CronExpression.EVERY_WEEK)
  async cleanupOldAuditLogs() {
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
  }
}
