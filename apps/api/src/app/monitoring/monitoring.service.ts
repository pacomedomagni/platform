import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { OperationStatus } from '@prisma/client';

export interface MonitoringMetrics {
  failedOperations: {
    pending: number;
    retrying: number;
    failed: number;
    succeeded: number;
    retryRate: number; // percentage of operations that needed retry
    permanentFailureRate: number; // percentage that failed permanently
  };
  stockReservations: {
    totalReservedQty: number;
    totalActualQty: number;
    divergencePercentage: number; // (reserved / actual) * 100
    negativeStockCount: number; // items with negative actualQty
    overReservedCount: number; // items where reserved > actual
  };
  systemHealth: {
    activeCartsCount: number;
    expiredCartsCount: number;
    pendingOrdersCount: number;
    failedPaymentsCount: number;
  };
  performance: {
    avgStockLockWaitTime?: number; // from logs
    avgCartOperationDuration?: number; // from logs
    avgCheckoutDuration?: number; // from logs
  };
}

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get comprehensive system metrics
   */
  async getMetrics(tenantId: string): Promise<MonitoringMetrics> {
    const [
      failedOps,
      stockMetrics,
      systemHealth,
    ] = await Promise.all([
      this.getFailedOperationsMetrics(tenantId),
      this.getStockReservationMetrics(tenantId),
      this.getSystemHealthMetrics(tenantId),
    ]);

    return {
      failedOperations: failedOps,
      stockReservations: stockMetrics,
      systemHealth,
      performance: {
        // TODO: Implement performance metrics from logging
        avgStockLockWaitTime: undefined,
        avgCartOperationDuration: undefined,
        avgCheckoutDuration: undefined,
      },
    };
  }

  /**
   * Get failed operations metrics
   */
  private async getFailedOperationsMetrics(tenantId: string) {
    const [pending, retrying, failed, succeeded, total] = await Promise.all([
      this.prisma.failedOperation.count({
        where: { tenantId, status: OperationStatus.PENDING },
      }),
      this.prisma.failedOperation.count({
        where: { tenantId, status: OperationStatus.RETRYING },
      }),
      this.prisma.failedOperation.count({
        where: { tenantId, status: OperationStatus.FAILED },
      }),
      this.prisma.failedOperation.count({
        where: { tenantId, status: OperationStatus.SUCCEEDED },
      }),
      this.prisma.failedOperation.count({
        where: { tenantId },
      }),
    ]);

    const retryRate = total > 0 ? ((succeeded + failed) / total) * 100 : 0;
    const permanentFailureRate = total > 0 ? (failed / total) * 100 : 0;

    return {
      pending,
      retrying,
      failed,
      succeeded,
      retryRate: Math.round(retryRate * 100) / 100,
      permanentFailureRate: Math.round(permanentFailureRate * 100) / 100,
    };
  }

  /**
   * Get stock reservation metrics and detect anomalies
   */
  private async getStockReservationMetrics(tenantId: string) {
    const balances = await this.prisma.warehouseItemBalance.findMany({
      where: { tenantId },
      select: {
        actualQty: true,
        reservedQty: true,
      },
    });

    let totalReservedQty = 0;
    let totalActualQty = 0;
    let negativeStockCount = 0;
    let overReservedCount = 0;

    for (const balance of balances) {
      const actual = Number(balance.actualQty);
      const reserved = Number(balance.reservedQty);

      totalReservedQty += reserved;
      totalActualQty += actual;

      if (actual < 0) {
        negativeStockCount++;
      }

      if (reserved > actual) {
        overReservedCount++;
        this.logger.warn(`Over-reserved stock detected: actual=${actual}, reserved=${reserved}`);
      }
    }

    const divergencePercentage =
      totalActualQty > 0
        ? Math.round((totalReservedQty / totalActualQty) * 10000) / 100
        : 0;

    return {
      totalReservedQty,
      totalActualQty,
      divergencePercentage,
      negativeStockCount,
      overReservedCount,
    };
  }

  /**
   * Get system health metrics
   */
  private async getSystemHealthMetrics(tenantId: string) {
    const now = new Date();

    const [
      activeCartsCount,
      expiredCartsCount,
      pendingOrdersCount,
      failedPaymentsCount,
    ] = await Promise.all([
      this.prisma.cart.count({
        where: { tenantId, status: 'active', expiresAt: { gt: now } },
      }),
      this.prisma.cart.count({
        where: { tenantId, status: 'active', expiresAt: { lt: now } },
      }),
      this.prisma.order.count({
        where: { tenantId, status: 'PENDING', paymentStatus: 'PENDING' },
      }),
      this.prisma.payment.count({
        where: { tenantId, status: 'FAILED' },
      }),
    ]);

    return {
      activeCartsCount,
      expiredCartsCount,
      pendingOrdersCount,
      failedPaymentsCount,
    };
  }

  /**
   * Check for critical alerts
   */
  async checkAlerts(tenantId: string): Promise<{
    critical: string[];
    warnings: string[];
  }> {
    const metrics = await this.getMetrics(tenantId);
    const critical: string[] = [];
    const warnings: string[] = [];

    // Critical: Permanent failure rate > 10%
    if (metrics.failedOperations.permanentFailureRate > 10) {
      critical.push(
        `High permanent failure rate: ${metrics.failedOperations.permanentFailureRate}% (threshold: 10%)`
      );
    }

    // Critical: Over-reserved stock (reserved > actual)
    if (metrics.stockReservations.overReservedCount > 0) {
      critical.push(
        `Over-reserved stock detected: ${metrics.stockReservations.overReservedCount} items have reserved > actual`
      );
    }

    // Critical: Negative stock (shouldn't happen with proper controls)
    if (metrics.stockReservations.negativeStockCount > 0) {
      critical.push(
        `Negative stock detected: ${metrics.stockReservations.negativeStockCount} items have negative actualQty`
      );
    }

    // Warning: Retry rate > 5%
    if (metrics.failedOperations.retryRate > 5) {
      warnings.push(
        `High retry rate: ${metrics.failedOperations.retryRate}% (threshold: 5%)`
      );
    }

    // Warning: Large number of expired carts not cleaned up
    if (metrics.systemHealth.expiredCartsCount > 100) {
      warnings.push(
        `Many expired carts pending cleanup: ${metrics.systemHealth.expiredCartsCount} carts`
      );
    }

    // Warning: Stock reservation divergence > 30%
    if (metrics.stockReservations.divergencePercentage > 30) {
      warnings.push(
        `High stock reservation divergence: ${metrics.stockReservations.divergencePercentage}% (threshold: 30%)`
      );
    }

    return { critical, warnings };
  }

  /**
   * Get detailed failed operations report
   */
  async getFailedOperationsReport(tenantId: string, limit = 100) {
    const operations = await this.prisma.failedOperation.findMany({
      where: {
        tenantId,
        status: {
          in: [OperationStatus.PENDING, OperationStatus.RETRYING, OperationStatus.FAILED],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        operationType: true,
        status: true,
        referenceId: true,
        referenceType: true,
        errorMessage: true,
        attemptCount: true,
        maxAttempts: true,
        nextRetryAt: true,
        lastAttemptAt: true,
        createdAt: true,
      },
    });

    return operations;
  }

  /**
   * Get stock reservation anomalies
   */
  async getStockAnomalies(tenantId: string) {
    const anomalies = await this.prisma.warehouseItemBalance.findMany({
      where: {
        tenantId,
        OR: [
          { actualQty: { lt: 0 } }, // Negative stock
          {
            // Over-reserved (reservedQty > actualQty)
            AND: [
              { reservedQty: { gt: 0 } },
              // This is a workaround - ideally we'd use a computed field
            ],
          },
        ],
      },
      include: {
        item: {
          select: { code: true, name: true },
        },
        warehouse: {
          select: { code: true, name: true },
        },
      },
    });

    // Filter for over-reserved items
    return anomalies.filter((balance) => {
      const actual = Number(balance.actualQty);
      const reserved = Number(balance.reservedQty);
      return actual < 0 || reserved > actual;
    });
  }
}
