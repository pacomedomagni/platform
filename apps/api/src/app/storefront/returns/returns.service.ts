import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
  Optional,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { Prisma, ReturnStatus } from '@prisma/client';
import { StripeService } from '../payments/stripe.service';
import { ActivityService } from '../activity/activity.service';
import { StockMovementService } from '../../inventory-management/stock-movement.service';
import { MovementType } from '../../inventory-management/inventory-management.dto';

@Injectable()
export class ReturnsService {
  private readonly logger = new Logger(ReturnsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(StripeService) private readonly stripeService?: StripeService,
    @Optional() @Inject(ActivityService) private readonly activityService?: ActivityService,
    @Optional() @Inject(StockMovementService) private readonly stockMovementService?: StockMovementService,
  ) {}

  /**
   * List returns with pagination, filter by status.
   */
  async listReturns(
    tenantId: string,
    query: { limit?: number; offset?: number; status?: ReturnStatus },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const { limit = 20, offset = 0, status } = query;

    const where: Prisma.ReturnRequestWhereInput = { tenantId };

    if (status) {
      where.status = status;
    }

    const [data, total] = await Promise.all([
      this.prisma.returnRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          items: true,
        },
      }),
      this.prisma.returnRequest.count({ where }),
    ]);

    return {
      data: data.map((r) => this.mapReturnToResponse(r)),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + data.length < total,
      },
    };
  }

  /**
   * Get a single return with items.
   */
  async getReturn(tenantId: string, id: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const returnRequest = await this.prisma.returnRequest.findFirst({
      where: { id, tenantId },
      include: {
        items: true,
      },
    });

    if (!returnRequest) {
      throw new NotFoundException('Return request not found');
    }

    return this.mapReturnToResponse(returnRequest);
  }

  /**
   * Create a return request with auto-number RET-00001.
   * Validates that the order exists.
   */
  async createReturn(
    tenantId: string,
    data: {
      orderId: string;
      reason: string;
      notes?: string;
      resolution?: string;
      items: Array<{
        orderItemId?: string;
        productName: string;
        sku?: string;
        quantity: number;
        unitPrice: number;
        reason?: string;
      }>;
    },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    // Validate order exists
    const order = await this.prisma.order.findFirst({
      where: { id: data.orderId, tenantId },
      select: {
        id: true,
        orderNumber: true,
        customerId: true,
        email: true,
        customer: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const customerName = order.customer
      ? [order.customer.firstName, order.customer.lastName].filter(Boolean).join(' ')
      : undefined;

    // RACE-3: Atomic return number generation using tenant counter (same pattern as order numbers)
    const returnRequest = await this.prisma.$transaction(async (tx) => {
      const result = await tx.$queryRaw<any[]>`
        UPDATE tenants
        SET "nextReturnNumber" = "nextReturnNumber" + 1
        WHERE id = ${tenantId}
        RETURNING "nextReturnNumber"
      `;
      const seq = result[0]?.nextReturnNumber || 1;
      const returnNumber = `RET-${String(seq).padStart(5, '0')}`;

      return tx.returnRequest.create({
        data: {
          tenantId,
          returnNumber,
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerId: order.customerId,
          customerName: customerName || undefined,
          customerEmail: order.email,
          reason: data.reason,
          notes: data.notes,
          resolution: data.resolution,
          status: 'REQUESTED',
          items: {
            create: data.items.map((item) => ({
              tenantId,
              orderItemId: item.orderItemId,
              productName: item.productName,
              sku: item.sku,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              reason: item.reason,
            })),
          },
        },
        include: {
          items: true,
        },
      });
    });

    return this.mapReturnToResponse(returnRequest);
  }

  /**
   * Approve a return request.
   */
  async approveReturn(tenantId: string, id: string, approvedBy: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const returnRequest = await this.prisma.returnRequest.findFirst({
      where: { id, tenantId },
    });

    if (!returnRequest) {
      throw new NotFoundException('Return request not found');
    }

    if (returnRequest.status !== 'REQUESTED') {
      throw new ConflictException(
        `Cannot approve return in status ${returnRequest.status}`,
      );
    }

    const updated = await this.prisma.returnRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy,
      },
      include: { items: true },
    });

    // Log activity
    this.activityService?.logActivity(tenantId, {
      entityType: 'return',
      entityId: id,
      eventType: 'status_changed',
      title: 'Return approved',
      description: `Return ${returnRequest.returnNumber} approved by ${approvedBy}`,
      metadata: { previousStatus: 'REQUESTED', newStatus: 'APPROVED', approvedBy },
      actorType: 'user',
    }).catch(err => this.logger.error('Failed to log activity:', err));

    return this.mapReturnToResponse(updated);
  }

  /**
   * Reject a return request.
   */
  async rejectReturn(tenantId: string, id: string, reason: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const returnRequest = await this.prisma.returnRequest.findFirst({
      where: { id, tenantId },
    });

    if (!returnRequest) {
      throw new NotFoundException('Return request not found');
    }

    if (returnRequest.status !== 'REQUESTED') {
      throw new ConflictException(
        `Cannot reject return in status ${returnRequest.status}`,
      );
    }

    const updated = await this.prisma.returnRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
      include: { items: true },
    });

    // Log activity
    this.activityService?.logActivity(tenantId, {
      entityType: 'return',
      entityId: id,
      eventType: 'status_changed',
      title: 'Return rejected',
      description: `Return ${returnRequest.returnNumber} rejected: ${reason}`,
      metadata: { previousStatus: 'REQUESTED', newStatus: 'REJECTED', rejectionReason: reason },
      actorType: 'user',
    }).catch(err => this.logger.error('Failed to log activity:', err));

    return this.mapReturnToResponse(updated);
  }

  /**
   * Mark items as received.
   */
  async receiveItems(tenantId: string, id: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const returnRequest = await this.prisma.returnRequest.findFirst({
      where: { id, tenantId },
    });

    if (!returnRequest) {
      throw new NotFoundException('Return request not found');
    }

    if (returnRequest.status !== 'APPROVED') {
      throw new ConflictException(
        `Cannot receive items for return in status ${returnRequest.status}`,
      );
    }

    const updated = await this.prisma.returnRequest.update({
      where: { id },
      data: {
        status: 'ITEMS_RECEIVED',
        itemsReceivedAt: new Date(),
      },
      include: { items: true },
    });

    // Log activity
    this.activityService?.logActivity(tenantId, {
      entityType: 'return',
      entityId: id,
      eventType: 'status_changed',
      title: 'Return items received',
      description: `Items received for return ${returnRequest.returnNumber}`,
      metadata: { previousStatus: 'APPROVED', newStatus: 'ITEMS_RECEIVED' },
      actorType: 'user',
    }).catch(err => this.logger.error('Failed to log activity:', err));

    return this.mapReturnToResponse(updated);
  }

  /**
   * Restock items - set status to RESTOCKED, mark all items as restocked.
   */
  async restockItems(tenantId: string, id: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const returnRequest = await this.prisma.returnRequest.findFirst({
      where: { id, tenantId },
      include: { items: true },
    });

    if (!returnRequest) {
      throw new NotFoundException('Return request not found');
    }

    if (returnRequest.status !== 'ITEMS_RECEIVED') {
      throw new ConflictException(
        `Cannot restock items for return in status ${returnRequest.status}`,
      );
    }

    const now = new Date();

    // FLOW-5: Actually increment inventory via stock movements
    if (this.stockMovementService) {
      // Find default warehouse for restocking
      const defaultWarehouse = await this.prisma.warehouse.findFirst({
        where: { tenantId, isActive: true },
        orderBy: { createdAt: 'asc' },
      });

      if (defaultWarehouse) {
        // Build stock receipt items from return items that have SKUs
        const receiptItems = returnRequest.items
          .filter((item) => item.sku)
          .map((item) => ({
            itemCode: item.sku!,
            quantity: item.quantity,
            rate: Number(item.unitPrice),
          }));

        if (receiptItems.length > 0) {
          try {
            await this.stockMovementService.createMovement(
              { tenantId },
              {
                movementType: MovementType.RECEIPT,
                postingDate: now.toISOString().split('T')[0],
                warehouseCode: defaultWarehouse.code,
                items: receiptItems,
                reference: `Return ${returnRequest.returnNumber}`,
                remarks: `Stock restocked from return ${returnRequest.returnNumber}`,
              },
            );
            this.logger.log(
              `Stock receipt created for return ${returnRequest.returnNumber}: ${receiptItems.length} items`,
            );
          } catch (err) {
            this.logger.error(
              `Failed to create stock receipt for return ${returnRequest.returnNumber}:`,
              err,
            );
          }
        }
      } else {
        this.logger.warn(
          `No active warehouse found for restocking return ${returnRequest.returnNumber}`,
        );
      }
    }

    // Mark all items as restocked
    await this.prisma.returnItem.updateMany({
      where: {
        returnRequestId: id,
        tenantId,
      },
      data: {
        restocked: true,
        restockedAt: now,
      },
    });

    const updated = await this.prisma.returnRequest.update({
      where: { id },
      data: {
        status: 'RESTOCKED',
        restockedAt: now,
      },
      include: { items: true },
    });

    // Log activity
    this.activityService?.logActivity(tenantId, {
      entityType: 'return',
      entityId: id,
      eventType: 'status_changed',
      title: 'Return items restocked',
      description: `Items restocked for return ${returnRequest.returnNumber}`,
      metadata: {
        previousStatus: 'ITEMS_RECEIVED',
        newStatus: 'RESTOCKED',
        itemsCount: returnRequest.items.length
      },
      actorType: 'user',
    }).catch(err => this.logger.error('Failed to log activity:', err));

    return this.mapReturnToResponse(updated);
  }

  /**
   * Process refund - attempts Stripe refund if original_payment, then marks REFUNDED.
   */
  async processRefund(
    tenantId: string,
    id: string,
    data: { refundAmount: number; refundMethod?: string },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const returnRequest = await this.prisma.returnRequest.findFirst({
      where: { id, tenantId },
    });

    if (!returnRequest) {
      throw new NotFoundException('Return request not found');
    }

    if (!['ITEMS_RECEIVED', 'RESTOCKED'].includes(returnRequest.status)) {
      throw new ConflictException(
        `Cannot process refund for return in status ${returnRequest.status}`,
      );
    }

    const refundMethod = data.refundMethod || 'original_payment';
    let stripeRefundId: string | null = null;

    // If refunding to original payment method, attempt Stripe refund
    if (refundMethod === 'original_payment' && returnRequest.orderId) {
      const order = await this.prisma.order.findFirst({
        where: { id: returnRequest.orderId, tenantId },
        select: { stripePaymentIntentId: true },
      });

      if (order?.stripePaymentIntentId && this.stripeService?.isConfigured()) {
        try {
          const refund = await this.stripeService.createRefund(
            order.stripePaymentIntentId,
            data.refundAmount,
            'requested_by_customer',
            `refund_return_${id}`,
          );
          stripeRefundId = refund.id;
          this.logger.log(`Stripe refund ${refund.id} created for return ${id}`);
        } catch (err) {
          this.logger.error(`Stripe refund failed for return ${id}: ${err}`);
          throw new BadRequestException(
            'Failed to process Stripe refund. Please try again or use a different refund method.',
          );
        }
      }
    }

    const updated = await this.prisma.returnRequest.update({
      where: { id },
      data: {
        status: 'REFUNDED',
        refundAmount: data.refundAmount,
        refundMethod,
        refundedAt: new Date(),
        ...(stripeRefundId && { notes: `${returnRequest.notes || ''}\nStripe Refund: ${stripeRefundId}`.trim() }),
      },
      include: { items: true },
    });

    // Log activity
    this.activityService?.logActivity(tenantId, {
      entityType: 'return',
      entityId: id,
      eventType: 'refund_processed',
      title: 'Return refunded',
      description: `Refund of $${data.refundAmount.toFixed(2)} processed for return ${returnRequest.returnNumber}`,
      metadata: {
        previousStatus: returnRequest.status,
        newStatus: 'REFUNDED',
        refundAmount: data.refundAmount,
        refundMethod,
        stripeRefundId
      },
      actorType: 'user',
    }).catch(err => this.logger.error('Failed to log activity:', err));

    return this.mapReturnToResponse(updated);
  }

  /**
   * Return stats: total, by status, refund totals.
   */
  async getReturnStats(tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const [total, byStatus, refundedReturns] = await Promise.all([
      this.prisma.returnRequest.count({ where: { tenantId } }),
      this.prisma.returnRequest.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { id: true },
      }),
      this.prisma.returnRequest.findMany({
        where: { tenantId, status: 'REFUNDED' },
        select: { refundAmount: true },
      }),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const entry of byStatus) {
      statusCounts[entry.status] = entry._count.id;
    }

    const totalRefunded = refundedReturns.reduce(
      (sum, r) => sum + (r.refundAmount ? Number(r.refundAmount) : 0),
      0,
    );

    return {
      total,
      byStatus: statusCounts,
      refundTotals: {
        count: refundedReturns.length,
        totalRefunded: Math.round(totalRefunded * 100) / 100,
      },
    };
  }

  // ─── Helpers ────────────────────────────────────────────────

  /* eslint-disable @typescript-eslint/no-explicit-any */
  private mapReturnToResponse(returnRequest: any) {
    return {
      id: returnRequest.id,
      returnNumber: returnRequest.returnNumber,
      status: returnRequest.status,
      orderId: returnRequest.orderId,
      orderNumber: returnRequest.orderNumber,
      customerId: returnRequest.customerId,
      customerName: returnRequest.customerName,
      customerEmail: returnRequest.customerEmail,
      reason: returnRequest.reason,
      notes: returnRequest.notes,
      resolution: returnRequest.resolution,
      refundAmount: returnRequest.refundAmount
        ? Number(returnRequest.refundAmount)
        : null,
      refundMethod: returnRequest.refundMethod,
      approvedAt: returnRequest.approvedAt,
      approvedBy: returnRequest.approvedBy,
      rejectedAt: returnRequest.rejectedAt,
      rejectionReason: returnRequest.rejectionReason,
      itemsReceivedAt: returnRequest.itemsReceivedAt,
      restockedAt: returnRequest.restockedAt,
      refundedAt: returnRequest.refundedAt,
      items: returnRequest.items?.map((item: any) => ({
        id: item.id,
        orderItemId: item.orderItemId,
        productName: item.productName,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        reason: item.reason,
        restocked: item.restocked,
        restockedAt: item.restockedAt,
      })),
      createdAt: returnRequest.createdAt,
      updatedAt: returnRequest.updatedAt,
    };
  }
}
