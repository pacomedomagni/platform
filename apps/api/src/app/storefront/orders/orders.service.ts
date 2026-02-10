/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, Logger, NotFoundException, BadRequestException, Inject, Optional } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { EmailService } from '@platform/email';
import { Prisma, OrderStatus, PaymentStatus } from '@prisma/client';
import { ListOrdersDto } from './dto';
import { ActivityService } from '../activity/activity.service';

type OrderWithItems = Prisma.OrderGetPayload<{
  include: { items: true };
}>;

// PAY-13: Valid order status transitions
const VALID_ORDER_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'SHIPPED', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['REFUNDED', 'CANCELLED'],
  CANCELLED: [],
  REFUNDED: [],
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(EmailService) private readonly emailService?: EmailService,
    @Optional() private readonly activityService?: ActivityService,
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

    return this.mapOrderToDetail(order);
  }

  /**
   * Get order by order number (for guest checkout)
   */
  async getOrderByNumber(tenantId: string, orderNumber: string, email: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        tenantId,
        orderNumber,
        email: email.toLowerCase(),
      },
      include: {
        items: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return this.mapOrderToDetail(order);
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
   * List all orders (admin)
   */
  async listAllOrders(tenantId: string, dto: ListOrdersDto & { search?: string }) {
    const { status, search, limit = 20, offset = 0 } = dto;

    const where: Prisma.OrderWhereInput = {
      tenantId,
    };

    if (status) {
      where.status = status as any;
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
    trackingInfo?: { carrier?: string; trackingNumber?: string }
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // PAY-13: Validate status transition
    const allowedTransitions = VALID_ORDER_TRANSITIONS[order.status] || [];
    if (!allowedTransitions.includes(status)) {
      throw new BadRequestException(
        `Invalid status transition: ${order.status} → ${status}. Allowed: ${allowedTransitions.join(', ') || 'none'}`
      );
    }

    const updateData: Prisma.OrderUpdateInput = { status: status as OrderStatus };

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

    await this.prisma.order.update({
      where: { id: orderId },
      data: updateData,
    });

    // Log activity
    if (this.activityService) {
      this.activityService.logActivity({
        tenantId,
        entityType: 'order',
        entityId: orderId,
        eventType: 'status_changed',
        title: `Order status changed to ${status}`,
        description: `Order ${order.orderNumber} status changed from ${order.status} to ${status}`,
        metadata: {
          previousStatus: order.status,
          newStatus: status,
          trackingInfo,
        } as any,
        actorType: 'user',
      }).catch(err => this.logger.error(`Activity log failed: ${err.message}`));
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

    return this.getOrder(tenantId, orderId);
  }

  /**
   * Process refund for an order (admin)
   */
  async processRefund(
    tenantId: string,
    orderId: string,
    body: { amount: number; reason: string; type: 'full' | 'partial' },
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Validate the order is in a refundable state
    const refundableStatuses: string[] = ['DELIVERED', 'SHIPPED', 'CONFIRMED'];
    if (!refundableStatuses.includes(order.status)) {
      throw new BadRequestException(
        `Order cannot be refunded in status: ${order.status}. Must be one of: ${refundableStatuses.join(', ')}`,
      );
    }

    const refundAmount = body.type === 'full' ? Number(order.grandTotal) : body.amount;

    if (refundAmount <= 0) {
      throw new BadRequestException('Refund amount must be greater than zero');
    }

    if (refundAmount > Number(order.grandTotal)) {
      throw new BadRequestException('Refund amount cannot exceed order total');
    }

    const paymentStatus: PaymentStatus =
      body.type === 'full' ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'REFUNDED' as OrderStatus,
        paymentStatus,
        refundedAt: new Date(),
        internalNotes: order.internalNotes
          ? `${order.internalNotes}\nRefund (${body.type}): $${refundAmount} - ${body.reason}`
          : `Refund (${body.type}): $${refundAmount} - ${body.reason}`,
      },
    });

    this.logger.log(
      `Order ${order.orderNumber} refunded: type=${body.type}, amount=${refundAmount}, reason=${body.reason}`,
    );

    // Log refund activity
    if (this.activityService) {
      this.activityService.logActivity({
        tenantId,
        entityType: 'order',
        entityId: orderId,
        eventType: 'payment_received',
        title: `Order refunded - ${body.type}`,
        description: `${body.type === 'full' ? 'Full' : 'Partial'} refund of $${refundAmount} processed. Reason: ${body.reason}`,
        metadata: {
          refundType: body.type,
          refundAmount,
          reason: body.reason,
        } as any,
        actorType: 'user',
      }).catch(err => this.logger.error(`Activity log failed: ${err.message}`));
    }

    return this.getOrder(tenantId, orderId);
  }

  /**
   * Update internal notes for an order
   */
  async updateNotes(tenantId: string, orderId: string, internalNotes: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { internalNotes },
    });

    // Log note update activity
    if (this.activityService) {
      this.activityService.logActivity({
        tenantId,
        entityType: 'order',
        entityId: orderId,
        eventType: 'note_added',
        title: 'Internal notes updated',
        description: `Internal notes updated for order ${order.orderNumber}`,
        metadata: { notes: internalNotes } as any,
        actorType: 'user',
      }).catch(err => this.logger.error(`Activity log failed: ${err.message}`));
    }

    return updated;
  }

  /**
   * Fulfill order items (track per-item fulfillment for partial shipments)
   */
  async fulfillOrderItems(
    tenantId: string,
    orderId: string,
    body: {
      items: Array<{ orderItemId: string; quantityFulfilled: number }>;
      trackingInfo?: { carrier?: string; trackingNumber?: string; shipmentId?: string };
    },
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Validate order can be fulfilled
    if (!['CONFIRMED', 'PROCESSING'].includes(order.status)) {
      throw new BadRequestException(
        `Order cannot be fulfilled in status: ${order.status}. Must be CONFIRMED or PROCESSING.`,
      );
    }

    // Validate all items exist and quantities are valid
    for (const fulfillmentItem of body.items) {
      const orderItem = order.items.find((item) => item.id === fulfillmentItem.orderItemId);

      if (!orderItem) {
        throw new BadRequestException(`Order item ${fulfillmentItem.orderItemId} not found`);
      }

      const currentFulfilled = orderItem.quantityFulfilled;
      const totalOrdered = orderItem.quantity;
      const newFulfilled = currentFulfilled + fulfillmentItem.quantityFulfilled;

      if (newFulfilled > totalOrdered) {
        throw new BadRequestException(
          `Cannot fulfill ${fulfillmentItem.quantityFulfilled} of item ${orderItem.name}. ` +
          `Ordered: ${totalOrdered}, Already fulfilled: ${currentFulfilled}`,
        );
      }

      if (fulfillmentItem.quantityFulfilled <= 0) {
        throw new BadRequestException('Quantity fulfilled must be greater than 0');
      }
    }

    // Update each item's quantityFulfilled
    await Promise.all(
      body.items.map((fulfillmentItem) =>
        this.prisma.orderItem.update({
          where: { id: fulfillmentItem.orderItemId },
          data: {
            quantityFulfilled: {
              increment: fulfillmentItem.quantityFulfilled,
            },
          },
        }),
      ),
    );

    // Check if order is now fully fulfilled
    const updatedOrder = await this.prisma.order.findFirst({
      where: { id: orderId },
      include: { items: true },
    });

    const allItemsFulfilled = updatedOrder!.items.every(
      (item) => item.quantityFulfilled >= item.quantity,
    );

    // If all items fulfilled, update order status to SHIPPED
    if (allItemsFulfilled && updatedOrder!.status === 'PROCESSING') {
      const updateData: Prisma.OrderUpdateInput = {
        status: 'SHIPPED' as OrderStatus,
        shippedAt: new Date(),
      };

      if (body.trackingInfo?.carrier) {
        updateData.shippingCarrier = body.trackingInfo.carrier;
      }
      if (body.trackingInfo?.trackingNumber) {
        updateData.trackingNumber = body.trackingInfo.trackingNumber;
      }

      await this.prisma.order.update({
        where: { id: orderId },
        data: updateData,
      });

      // Send shipped email
      this.sendOrderStatusEmailAsync(orderId, 'store-order-shipped').catch(err =>
        this.logger.error(`Shipped email failed for order ${orderId}: ${err.message}`),
      );
    }

    // Log fulfillment activity
    if (this.activityService) {
      const fulfillmentSummary = body.items
        .map((item) => {
          const orderItem = order.items.find((i) => i.id === item.orderItemId);
          return `${orderItem?.name}: ${item.quantityFulfilled} units`;
        })
        .join(', ');

      this.activityService.logActivity({
        tenantId,
        entityType: 'order',
        entityId: orderId,
        eventType: 'fulfillment',
        title: allItemsFulfilled ? 'Order fully fulfilled' : 'Partial fulfillment',
        description: `Items fulfilled for order ${order.orderNumber}: ${fulfillmentSummary}`,
        metadata: {
          items: body.items,
          trackingInfo: body.trackingInfo,
          fullyFulfilled: allItemsFulfilled,
        } as any,
        actorType: 'user',
      }).catch(err => this.logger.error(`Activity log failed: ${err.message}`));
    }

    this.logger.log(
      `Order ${order.orderNumber} fulfillment processed: ${allItemsFulfilled ? 'fully fulfilled' : 'partial'}`,
    );

    return this.getOrder(tenantId, orderId);
  }

  /**
   * Get fulfillment status for an order
   */
  async getFulfillmentStatus(tenantId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const items = order.items.map((item) => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
      quantityFulfilled: item.quantityFulfilled,
      quantityRemaining: item.quantity - item.quantityFulfilled,
      fullyFulfilled: item.quantityFulfilled >= item.quantity,
    }));

    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalFulfilled = items.reduce((sum, item) => sum + item.quantityFulfilled, 0);
    const fullyFulfilled = items.every((item) => item.fullyFulfilled);

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      items,
      summary: {
        totalItems,
        totalFulfilled,
        totalRemaining: totalItems - totalFulfilled,
        fullyFulfilled,
        fulfillmentPercentage: totalItems > 0 ? Math.round((totalFulfilled / totalItems) * 100) : 0,
      },
    };
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

  private mapOrderToDetail(order: OrderWithItems) {
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
        name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        quantityFulfilled: item.quantityFulfilled,
        quantityRefunded: item.quantityRefunded,
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
      customerNotes: order.customerNotes,
      createdAt: order.createdAt,
      confirmedAt: order.confirmedAt,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
    };
  }
}
