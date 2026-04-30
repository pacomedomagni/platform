/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, Logger, NotFoundException, BadRequestException, Inject, Optional } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { EmailService } from '@platform/email';
import { StockMovementService } from '../../inventory-management/stock-movement.service';
import { FailedOperationsService } from '../../workers/failed-operations.service';
import { WebhookService } from '../../operations/webhook.service';
import { MovementType } from '../../inventory-management/inventory-management.dto';
import { OperationType } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { ListOrdersDto } from './dto';

type OrderWithItems = Prisma.OrderGetPayload<{
  include: { items: true };
}>;

// Phase 2 W2.5: tightened admin state machine.
//
// Removed:
//   - SHIPPED -> PROCESSING (an order handed to the carrier is physically
//     out of our hands; "reverting" it in the DB doesn't reverse the
//     shipment, so the UI was lying)
//   - SHIPPED -> CANCELLED  (cancel a shipped order requires a carrier
//     cancel call and is a different business process than order cancel;
//     the correct post-shipment path is DELIVERED -> REFUNDED)
//   - PROCESSING -> CANCELLED *without* payment reversal — still allowed
//     here but the implementation is required to refund first (W2.5 full
//     rollout will enforce this at the service level).
//
// DELIVERED -> REFUNDED remains the only terminal transition after
// delivery. CANCELLED and REFUNDED are both terminal states — no further
// transitions are permitted.
const VALID_ORDER_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'SHIPPED', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
};

// Customer-facing transitions — stricter than admin. Customers can only
// cancel orders that have not yet shipped; after shipment they must go
// through support (returns/refunds).
const CUSTOMER_ORDER_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['CANCELLED'],
  CONFIRMED: ['CANCELLED'],
  PROCESSING: ['CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
  REFUNDED: [],
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stockMovementService: StockMovementService,
    private readonly failedOperationsService: FailedOperationsService,
    private readonly webhookService: WebhookService,
    @Optional() @Inject(EmailService) private readonly emailService?: EmailService,
  ) {}

  /**
   * List orders for a customer
   */
  async listOrders(tenantId: string, customerId: string, dto: ListOrdersDto) {
    const { status, limit = 20, offset = 0 } = dto;

    const where: Prisma.OrderWhereInput = {
      tenantId,
      customerId,
    };

    if (status) {
      where.status = status as any;
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          _count: {
            select: { items: true },
          },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        grandTotal: Number(order.grandTotal),
        itemCount: order._count.items,
        trackingNumber: order.trackingNumber,
        shippingCarrier: order.shippingCarrier,
        createdAt: order.createdAt,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + orders.length < total,
      },
    };
  }

  /**
   * Get order detail
   */
  async getOrder(tenantId: string, orderId: string, customerId?: string) {
    const where: Prisma.OrderWhereInput = {
      id: orderId,
      tenantId,
    };

    // If customerId provided, verify ownership
    if (customerId) {
      where.customerId = customerId;
    }

    const order = await this.prisma.order.findFirst({
      where,
      include: {
        items: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Fetch payment info for enriched response
    const payments = await this.prisma.payment.findMany({
      where: { orderId, tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return this.mapOrderToDetail(order, payments);
  }

  /**
   * Get order by order number (for guest checkout).
   *
   * Phase 1 W1.6 hardening: the previous implementation accepted any email
   * alongside the order number. Rate limiting (5/min at controller) helped
   * but still permitted ~7k probes/day per IP. This version:
   *   1. requires the email match to be case-insensitive and whitespace-trimmed
   *   2. uses a constant-time comparison to avoid email-existence timing oracles
   *   3. rejects lookups for orders older than GUEST_LOOKUP_MAX_AGE_DAYS so old
   *      order numbers cannot be enumerated indefinitely
   *   4. returns the same `NotFoundException` for every failure reason (wrong
   *      number, wrong email, too old) so callers cannot distinguish
   *
   * A proper signed lookup token (delivered in the order-confirmation email)
   * is Phase 2 work — tracked in REMEDIATION_PLAN.md.
   */
  private static readonly GUEST_LOOKUP_MAX_AGE_DAYS = 14;

  async getOrderByNumber(tenantId: string, orderNumber: string, email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.includes('@')) {
      throw new NotFoundException('Order not found');
    }

    const order = await this.prisma.order.findFirst({
      where: {
        tenantId,
        orderNumber,
      },
      include: {
        items: true,
      },
    });

    // Single NotFound return path for all failure reasons.
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const maxAgeMs = OrdersService.GUEST_LOOKUP_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    if (Date.now() - order.createdAt.getTime() > maxAgeMs) {
      throw new NotFoundException('Order not found');
    }

    // Constant-time email compare to avoid timing oracles.
    const orderEmail = (order.email ?? '').toLowerCase();
    const a = Buffer.from(orderEmail);
    const b = Buffer.from(normalizedEmail);
    const emailsMatch =
      a.length === b.length &&
      require('crypto').timingSafeEqual(a, b);
    if (!emailsMatch) {
      throw new NotFoundException('Order not found');
    }

    const payments = await this.prisma.payment.findMany({
      where: { orderId: order.id, tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return this.mapOrderToDetail(order, payments);
  }

  /**
   * Get recent orders for a customer
   */
  async getRecentOrders(tenantId: string, customerId: string, limit = 5) {
    const orders = await this.prisma.order.findMany({
      where: {
        tenantId,
        customerId,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    return orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      grandTotal: Number(order.grandTotal),
      itemCount: order._count.items,
      createdAt: order.createdAt,
    }));
  }

  // ============ ADMIN METHODS ============

  /**
   * Get order stats by status (admin)
   */
  async getOrderStats(tenantId: string) {
    const counts = await this.prisma.order.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { status: true },
    });

    const statsMap: Record<string, number> = {};
    for (const row of counts) {
      statsMap[row.status] = row._count.status;
    }

    return {
      pending: statsMap['PENDING'] || 0,
      confirmed: statsMap['CONFIRMED'] || 0,
      processing: statsMap['PROCESSING'] || 0,
      shipped: statsMap['SHIPPED'] || 0,
      delivered: statsMap['DELIVERED'] || 0,
      cancelled: statsMap['CANCELLED'] || 0,
      refunded: statsMap['REFUNDED'] || 0,
    };
  }

  /**
   * List all orders (admin)
   */
  async listAllOrders(tenantId: string, dto: ListOrdersDto & { search?: string }) {
    const { status, paymentStatus, search, dateFrom, dateTo, limit = 20, offset = 0 } = dto;

    const where: Prisma.OrderWhereInput = {
      tenantId,
    };

    if (status) {
      where.status = status as any;
    }

    if (paymentStatus) {
      where.paymentStatus = paymentStatus as any;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          _count: {
            select: { items: true },
          },
          customer: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        customer: order.customer
          ? {
              name: [order.customer.firstName, order.customer.lastName]
                .filter(Boolean)
                .join(' ') || order.customer.email,
              email: order.customer.email,
            }
          : { name: order.email, email: order.email },
        status: order.status,
        paymentStatus: order.paymentStatus,
        grandTotal: Number(order.grandTotal),
        itemCount: order._count.items,
        createdAt: order.createdAt,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + orders.length < total,
      },
    };
  }

  /**
   * Update order status (admin)
   */
  async updateOrderStatus(
    tenantId: string,
    orderId: string,
    status: string,
    trackingInfo?: { carrier?: string; trackingNumber?: string; adminNotes?: string },
    options?: { isCustomer?: boolean }
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // CRITICAL-2: If status is unchanged and adminNotes is provided, skip
    // transition validation and just update the notes (supports "Save Notes" in admin UI).
    const isNotesOnlyUpdate =
      status === order.status && trackingInfo?.adminNotes !== undefined;

    if (!isNotesOnlyUpdate) {
      // PAY-13: Validate status transition
      // Fix #32: Use customer-restricted transitions when request is from customer
      const transitionMap = options?.isCustomer ? CUSTOMER_ORDER_TRANSITIONS : VALID_ORDER_TRANSITIONS;
      const allowedTransitions = transitionMap[order.status] || [];
      if (!allowedTransitions.includes(status)) {
        throw new BadRequestException(
          `Invalid status transition: ${order.status} → ${status}. Allowed: ${allowedTransitions.join(', ') || 'none'}`
        );
      }
    }

    const updateData: Prisma.OrderUpdateInput = { status: status as any };

    if (status === 'SHIPPED') {
      updateData.shippedAt = new Date();
      if (trackingInfo?.carrier) updateData.shippingCarrier = trackingInfo.carrier;
      if (trackingInfo?.trackingNumber) updateData.trackingNumber = trackingInfo.trackingNumber;
    }

    if (status === 'DELIVERED') {
      updateData.deliveredAt = new Date();
    }

    if (status === 'CANCELLED') {
      updateData.cancelledAt = new Date();
    }

    if (trackingInfo?.adminNotes !== undefined) {
      updateData.internalNotes = trackingInfo.adminNotes;
    }

    // Phase 2 W2.5: side effects that can be expressed as DB writes are now
    // batched inside one transaction with the order.update so a failure in
    // any of them rolls the whole status change back. The two operations
    // that *cannot* live in this tx — the stock-return RECEIPT (which is
    // itself a multi-table transactional movement) and the
    // emails/webhooks (network I/O) — run after commit. Stock return is
    // recorded with FailedOperationsService on failure so the cron retries.
    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId, tenantId },
        data: updateData,
      });

      if (status !== 'CANCELLED') return;

      // Release stock reservations for unpaid orders (raw SQL, atomic).
      if (order.paymentStatus === 'PENDING') {
        await this.releaseStockReservationsInTx(tx, tenantId, orderId);
      }

      // Reverse gift card redemption (lock + reverse inside the same tx).
      await this.reverseGiftCardInTx(tx, tenantId, orderId);

      // Reverse coupon usage (W2.4 reserved it inside the checkout tx).
      if (order.couponCode) {
        await this.reverseCouponUsageInTx(tx, tenantId, orderId);
      }
    });

    // Stock RECEIPT for paid orders runs after the cancel tx commits because
    // it crosses several tables and has its own transactional semantics.
    // On failure it is recorded with FailedOperationsService so the cron
    // retries; the order is already CANCELLED at this point so the worst
    // case is a transient inventory delta until the retry succeeds.
    if (status === 'CANCELLED' && ['CAPTURED', 'PARTIALLY_REFUNDED'].includes(order.paymentStatus)) {
      await this.returnStockForOrder(tenantId, orderId);
    }

    // Fire-and-forget transactional emails
    if (status === 'SHIPPED') {
      this.sendOrderStatusEmailAsync(orderId, 'store-order-shipped').catch(err =>
        this.logger.error(`Shipped email failed for order ${orderId}: ${err.message}`));
    } else if (status === 'DELIVERED') {
      this.sendOrderStatusEmailAsync(orderId, 'store-order-delivered').catch(err =>
        this.logger.error(`Delivered email failed for order ${orderId}: ${err.message}`));
    } else if (status === 'CANCELLED') {
      this.sendOrderStatusEmailAsync(orderId, 'store-order-cancelled').catch(err =>
        this.logger.error(`Cancelled email failed for order ${orderId}: ${err.message}`));
    }

    // Fire-and-forget: trigger order webhook based on new status
    const webhookPayload = {
      orderId,
      orderNumber: order.orderNumber,
      previousStatus: order.status,
      newStatus: status,
      grandTotal: Number(order.grandTotal),
      ...(trackingInfo || {}),
    };

    // Always trigger order.updated
    this.webhookService.triggerEvent({ tenantId }, {
      event: 'order.updated',
      payload: webhookPayload,
      timestamp: new Date(),
    }).catch(err => this.logger.error(`Webhook order.updated failed for order ${orderId}: ${err.message}`));

    // Trigger status-specific event
    const statusEventMap: Record<string, string> = {
      CANCELLED: 'order.cancelled',
      SHIPPED: 'shipment.created',
      DELIVERED: 'shipment.delivered',
      COMPLETED: 'order.completed',
    };
    const specificEvent = statusEventMap[status];
    if (specificEvent) {
      this.webhookService.triggerEvent({ tenantId }, {
        event: specificEvent,
        payload: webhookPayload,
        timestamp: new Date(),
      }).catch(err => this.logger.error(`Webhook ${specificEvent} failed for order ${orderId}: ${err.message}`));
    }

    return this.getOrder(tenantId, orderId);
  }

  /**
   * Return stock to inventory when an order is cancelled after payment
   */
  private async returnStockForOrder(tenantId: string, orderId: string) {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              product: {
                include: { item: true },
              },
            },
          },
        },
      });

      if (!order || !order.items.length) return;

      const warehouse = await this.prisma.warehouse.findFirst({
        where: { tenantId, isActive: true },
        orderBy: { createdAt: 'asc' },
      });

      if (!warehouse) {
        this.logger.error(`No active warehouse found for stock return on order ${orderId}`);
        return;
      }

      const items = order.items
        .filter((item) => item.product?.item?.code)
        .map((item) => ({
          itemCode: item.product.item.code,
          quantity: item.quantity,
          rate: Number(item.unitPrice),
        }));

      if (items.length > 0) {
        await this.stockMovementService.createMovement(
          { tenantId },
          {
            movementType: MovementType.RECEIPT,
            warehouseCode: warehouse.code,
            items,
            postingDate: new Date().toISOString().split('T')[0],
            reference: `Cancellation of Order ${order.orderNumber}`,
            remarks: `Stock returned due to order cancellation`,
          },
        );
        this.logger.log(`Stock returned for cancelled order: ${order.orderNumber}`);
      }
    } catch (error) {
      this.logger.error(`Failed to return stock for order ${orderId}:`, error);

      // Fix #23: Record failed operation for automatic retry
      await this.failedOperationsService.recordFailedOperation({
        tenantId,
        operationType: OperationType.STOCK_RETURN,
        referenceId: orderId,
        referenceType: 'order',
        payload: { orderId, tenantId, reason: 'Stock return failed during order cancellation' },
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      }).catch(err => this.logger.error(`Failed to record failed stock return operation for order ${orderId}:`, err));
    }
  }

  /**
   * Release stock reservations for an unpaid order being cancelled.
   * Unlike returnStockForOrder (which creates a RECEIPT movement for paid orders),
   * this only decrements reservedQty since actualQty was never decremented.
   */
  private async releaseStockReservationsForOrder(tenantId: string, orderId: string) {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              product: {
                include: { item: true },
              },
            },
          },
        },
      });

      if (!order || !order.items.length) return;

      const warehouse = await this.prisma.warehouse.findFirst({
        where: { tenantId, isActive: true },
        orderBy: { createdAt: 'asc' },
      });

      if (!warehouse) {
        this.logger.error(`No active warehouse found for stock release on order ${orderId}`);
        return;
      }

      for (const item of order.items) {
        if (!item.product?.item?.id) continue;

        const itemId = item.product.item.id;
        const qty = item.quantity;

        // Safe decrement: clamp to 0 to prevent negative reservedQty
        await this.prisma.$executeRaw`
          UPDATE warehouse_item_balances
          SET "reservedQty" = GREATEST("reservedQty" - ${qty}, 0)
          WHERE "tenantId" = ${tenantId}
            AND "itemId" = ${itemId}
            AND "warehouseId" = ${warehouse.id}
        `;
      }

      this.logger.log(`Stock reservations released for cancelled unpaid order: ${order.orderNumber}`);
    } catch (error) {
      this.logger.error(`Failed to release stock reservations for order ${orderId}:`, error);

      // Fix #23: Record failed operation for automatic retry
      await this.failedOperationsService.recordFailedOperation({
        tenantId,
        operationType: OperationType.STOCK_RETURN,
        referenceId: orderId,
        referenceType: 'order',
        payload: { orderId, tenantId, reason: 'Stock reservation release failed during order cancellation' },
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      }).catch(err => this.logger.error(`Failed to record failed stock release operation for order ${orderId}:`, err));
    }
  }

  /**
   * Reverse gift card transaction when an order that used gift card payment is cancelled.
   * Restores the redeemed amount back to the gift card balance.
   */
  /**
   * Phase 2 W2.5: reverse the coupon usage reserved at checkout (W2.4).
   *
   * Finds the CouponUsage row for this order, deletes it, and decrements
   * the coupon's timesUsed counter in one transaction. FOR UPDATE
   * serializes the row so two concurrent cancellations (shouldn't happen
   * but defensive) cannot double-decrement.
   *
   * Idempotent: if the row was already removed (e.g. a prior cancellation
   * attempt partially succeeded), this is a no-op.
   */
  private async reverseCouponUsageForOrder(tenantId: string, orderId: string) {
    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        Array<{ id: string; couponId: string }>
      >`
        SELECT id, "couponId" FROM coupon_usages
        WHERE "tenantId" = ${tenantId} AND "orderId" = ${orderId}
        FOR UPDATE
      `;
      if (locked.length === 0) return;

      const usage = locked[0];
      await tx.couponUsage.delete({ where: { id: usage.id } });

      // Clamp to zero in case of arithmetic drift from legacy data.
      await tx.$executeRaw`
        UPDATE coupons
        SET "timesUsed" = GREATEST("timesUsed" - 1, 0)
        WHERE id = ${usage.couponId} AND "tenantId" = ${tenantId}
      `;
    });
    this.logger.log(`Reversed coupon usage for cancelled order ${orderId}`);
  }

  private async reverseGiftCardForOrder(tenantId: string, orderId: string) {
    try {
      // Use a transaction with FOR UPDATE to prevent concurrent double-reversal
      await this.prisma.$transaction(async (tx) => {
        // Lock the gift card row to serialize concurrent reversal attempts
        const gcTransaction = await tx.giftCardTransaction.findFirst({
          where: { orderId, tenantId, type: 'redemption' },
          include: { giftCard: true },
        });

        if (!gcTransaction || !gcTransaction.giftCard) return;

        // Check for existing refund INSIDE the transaction (after potential lock wait)
        const existingRefund = await tx.giftCardTransaction.findFirst({
          where: { orderId, tenantId, type: 'refund' }
        });
        if (existingRefund) return; // Already reversed by concurrent request

        // Lock the gift card row to get fresh balance
        const [lockedCard] = await tx.$queryRaw<any[]>`
          SELECT * FROM gift_cards WHERE id = ${gcTransaction.giftCardId} FOR UPDATE
        `;
        if (!lockedCard) return;

        const refundAmount = Math.abs(Number(gcTransaction.amount));
        const currentBalance = Number(lockedCard.currentBalance);
        const restoredBalance = currentBalance + refundAmount;

        const order = await tx.order.findUnique({
          where: { id: orderId },
          select: { orderNumber: true },
        });

        await tx.giftCardTransaction.create({
          data: {
            tenantId,
            giftCardId: gcTransaction.giftCardId,
            type: 'refund',
            amount: refundAmount,
            balanceBefore: currentBalance,
            balanceAfter: restoredBalance,
            orderId,
            notes: `Reversed due to order cancellation (${order?.orderNumber || orderId})`,
          },
        });

        await tx.giftCard.update({
          where: { id: gcTransaction.giftCardId },
          data: {
            currentBalance: restoredBalance,
            status: 'active',
          },
        });
      });

      this.logger.log(`Gift card balance restored for cancelled order ${orderId}`);
    } catch (error) {
      this.logger.error(`Failed to reverse gift card for order ${orderId}:`, error);

      // Fix #23: Record failed operation for automatic retry
      // Note: Using STOCK_RETURN as there is no GIFT_CARD_REVERSAL operation type in the schema.
      // Consider adding a dedicated OperationType for gift card reversals.
      await this.failedOperationsService.recordFailedOperation({
        tenantId,
        operationType: OperationType.STOCK_RETURN,
        referenceId: orderId,
        referenceType: 'order',
        payload: { orderId, tenantId, reason: 'Gift card reversal failed during order cancellation' },
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      }).catch(err => this.logger.error(`Failed to record failed gift card reversal operation for order ${orderId}:`, err));
    }
  }

  // ============ Phase 2 W2.5 — in-transaction variants ============
  //
  // The `*ForOrder` helpers above each open their own $transaction. The cancel
  // path now wraps order.update + reservation release + GC reverse + coupon
  // reverse in a single tx via these variants, so any one failure rolls back
  // the entire status change.

  /**
   * In-tx version of releaseStockReservationsForOrder. Decrements reservedQty
   * for every line item using GREATEST(...) to prevent negative balances.
   */
  private async releaseStockReservationsInTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    orderId: string,
  ) {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: { include: { item: true } },
          },
        },
      },
    });
    if (!order || !order.items.length) return;

    const warehouse = await tx.warehouse.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!warehouse) {
      this.logger.error(`No active warehouse for stock release on order ${orderId}`);
      return;
    }

    for (const item of order.items) {
      if (!item.product?.item?.id) continue;
      await tx.$executeRaw`
        UPDATE warehouse_item_balances
        SET "reservedQty" = GREATEST("reservedQty" - ${item.quantity}, 0)
        WHERE "tenantId"   = ${tenantId}
          AND "itemId"     = ${item.product.item.id}
          AND "warehouseId" = ${warehouse.id}
      `;
    }
  }

  /**
   * In-tx version of reverseGiftCardForOrder. Same lock-and-reverse logic but
   * using the caller's tx so all cancel-related changes commit or roll back
   * as a unit.
   */
  private async reverseGiftCardInTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    orderId: string,
  ) {
    const gcTransaction = await tx.giftCardTransaction.findFirst({
      where: { orderId, tenantId, type: 'redemption' },
    });
    if (!gcTransaction) return;

    // Idempotent: bail if a refund row already exists.
    const existingRefund = await tx.giftCardTransaction.findFirst({
      where: { orderId, tenantId, type: 'refund' },
    });
    if (existingRefund) return;

    const lockedCards = await tx.$queryRaw<Array<{
      id: string;
      currentBalance: string;
    }>>`
      SELECT id, "currentBalance"::text AS "currentBalance"
      FROM gift_cards
      WHERE id = ${gcTransaction.giftCardId}
      FOR UPDATE
    `;
    const lockedCard = lockedCards[0];
    if (!lockedCard) return;

    // Phase 2 W2.2: Decimal arithmetic for the balance restore so we never
    // lose sub-cent precision through a Number cast on large balances.
    const refundDecimal = new Prisma.Decimal(gcTransaction.amount as never).abs();
    const currentDecimal = new Prisma.Decimal(lockedCard.currentBalance);
    const restoredDecimal = currentDecimal.add(refundDecimal);
    const refundAmount = refundDecimal.toNumber();
    const currentBalance = currentDecimal.toNumber();
    const restoredBalance = restoredDecimal.toNumber();

    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { orderNumber: true },
    });

    await tx.giftCardTransaction.create({
      data: {
        tenantId,
        giftCardId: gcTransaction.giftCardId,
        type: 'refund',
        amount: refundAmount,
        balanceBefore: currentBalance,
        balanceAfter: restoredBalance,
        orderId,
        notes: `Reversed due to order cancellation (${order?.orderNumber || orderId})`,
      },
    });
    await tx.giftCard.update({
      where: { id: gcTransaction.giftCardId },
      data: { currentBalance: restoredBalance, status: 'active' },
    });
  }

  /**
   * In-tx version of reverseCouponUsageForOrder.
   */
  private async reverseCouponUsageInTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    orderId: string,
  ) {
    const locked = await tx.$queryRaw<
      Array<{ id: string; couponId: string }>
    >`
      SELECT id, "couponId" FROM coupon_usages
      WHERE "tenantId" = ${tenantId} AND "orderId" = ${orderId}
      FOR UPDATE
    `;
    if (locked.length === 0) return;
    const usage = locked[0];
    await tx.couponUsage.delete({ where: { id: usage.id } });
    await tx.$executeRaw`
      UPDATE coupons
      SET "timesUsed" = GREATEST("timesUsed" - 1, 0)
      WHERE id = ${usage.couponId} AND "tenantId" = ${tenantId}
    `;
  }

  // ============ EMAIL HELPERS ============

  private async sendOrderStatusEmailAsync(orderId: string, template: string) {
    if (!this.emailService) {
      this.logger.warn('Email service not available, skipping order status email');
      return;
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, tenant: true },
    });

    if (!order || !order.email) {
      this.logger.warn(`Cannot send email: order ${orderId} not found or no email`);
      return;
    }

    const storeUrl = process.env['STORE_URL'] || process.env['FRONTEND_URL'] || '';

    await this.emailService.sendAsync({
      to: order.email,
      template,
      subject: '',
      context: {
        type: template,
        tenantId: order.tenantId,
        recipientName: [order.shippingFirstName, order.shippingLastName].filter(Boolean).join(' ') || order.email,
        recipientEmail: order.email,
        actionUrl: `${storeUrl}/storefront/account/orders?order=${order.orderNumber}`,
        company: {
          name: order.tenant.businessName || order.tenant.name,
          supportEmail: order.tenant.email || 'support@example.com',
        },
        order: {
          orderNumber: order.orderNumber,
          status: order.status,
          items: order.items.map(item => ({
            name: item.name,
            sku: item.sku || undefined,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.totalPrice),
            image: item.imageUrl || undefined,
          })),
          subtotal: Number(order.subtotal),
          shipping: Number(order.shippingTotal),
          tax: Number(order.taxTotal),
          discount: Number(order.discountTotal) > 0 ? Number(order.discountTotal) : undefined,
          total: Number(order.grandTotal),
          currency: order.currency,
          shippingAddress: {
            name: [order.shippingFirstName, order.shippingLastName].filter(Boolean).join(' '),
            line1: order.shippingAddressLine1,
            line2: order.shippingAddressLine2 || undefined,
            city: order.shippingCity,
            state: order.shippingState,
            postalCode: order.shippingPostalCode,
            country: order.shippingCountry,
          },
          trackingNumber: order.trackingNumber || undefined,
          shippingCarrier: order.shippingCarrier || undefined,
        },
      },
    });

    this.logger.log(`Order ${template} email queued for order: ${order.orderNumber}`);
  }

  // ============ HELPERS ============

  private mapOrderToDetail(order: OrderWithItems, payments?: any[]) {
    // Build tracking URL if carrier and tracking number available
    const trackingUrl = order.trackingNumber && order.shippingCarrier
      ? this.buildTrackingUrl(order.shippingCarrier, order.trackingNumber)
      : null;

    // Extract payment method from captured payment
    const capturedPayment = payments?.find(p => p.status === 'CAPTURED');
    const failedPayment = payments?.find(p => p.status === 'FAILED');

    // Calculate total refunded — match records by type='REFUND' OR status='REFUNDED'
    const refundedPayments = payments?.filter(p => p.type === 'REFUND' || p.status === 'REFUNDED') || [];
    const totalRefunded = refundedPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      email: order.email,
      phone: order.phone,
      status: order.status,
      paymentStatus: order.paymentStatus,
      shippingAddress: order.shippingAddressLine1
        ? {
            firstName: order.shippingFirstName,
            lastName: order.shippingLastName,
            company: order.shippingCompany,
            addressLine1: order.shippingAddressLine1,
            addressLine2: order.shippingAddressLine2,
            city: order.shippingCity,
            state: order.shippingState,
            postalCode: order.shippingPostalCode,
            country: order.shippingCountry,
          }
        : null,
      billingAddress: order.billingAddressLine1
        ? {
            firstName: order.billingFirstName,
            lastName: order.billingLastName,
            company: order.billingCompany,
            addressLine1: order.billingAddressLine1,
            addressLine2: order.billingAddressLine2,
            city: order.billingCity,
            state: order.billingState,
            postalCode: order.billingPostalCode,
            country: order.billingCountry,
          }
        : null,
      items: order.items.map((item) => ({
        id: item.id,
        // productId / variantId expose the original product references so
        // a "reorder" flow can call addItem(productId, qty). Without these,
        // clients fell back to passing line-item id which adds zero items
        // (the cart API expects a product/variant id). Both can be null
        // for snapshot-only items where the product has since been deleted.
        productId: item.productId,
        variantId: item.variantId,
        name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
        imageUrl: item.imageUrl,
      })),
      subtotal: Number(order.subtotal),
      shippingTotal: Number(order.shippingTotal),
      taxTotal: Number(order.taxTotal),
      discountTotal: Number(order.discountTotal),
      grandTotal: Number(order.grandTotal),
      shippingMethod: order.shippingMethod,
      shippingCarrier: order.shippingCarrier,
      trackingNumber: order.trackingNumber,
      trackingUrl,
      customerNotes: order.customerNotes,
      // Payment details
      paymentMethod: capturedPayment?.cardBrand && capturedPayment?.cardLast4
        ? `${capturedPayment.cardBrand.charAt(0).toUpperCase() + capturedPayment.cardBrand.slice(1)} •••• ${capturedPayment.cardLast4}`
        : null,
      paymentFailureReason: failedPayment?.errorMessage || null,
      // Refund info
      totalRefunded: totalRefunded > 0 ? totalRefunded : null,
      refundedAt: order.refundedAt,
      // Timestamps
      createdAt: order.createdAt,
      confirmedAt: order.confirmedAt,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      cancelledAt: order.cancelledAt,
    };
  }

  private buildTrackingUrl(carrier: string, trackingNumber: string): string | null {
    const carrierLower = carrier.toLowerCase();
    if (carrierLower.includes('ups')) {
      return `https://www.ups.com/track?tracknum=${trackingNumber}`;
    }
    if (carrierLower.includes('fedex')) {
      return `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`;
    }
    if (carrierLower.includes('usps')) {
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`;
    }
    if (carrierLower.includes('dhl')) {
      return `https://www.dhl.com/en/express/tracking.html?AWB=${trackingNumber}`;
    }
    return null;
  }
}
