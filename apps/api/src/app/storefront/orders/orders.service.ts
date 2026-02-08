/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, Logger, NotFoundException, BadRequestException, Inject, Optional } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { EmailService } from '@platform/email';
import { Prisma, OrderStatus } from '@prisma/client';
import { ListOrdersDto } from './dto';

type OrderWithItems = Prisma.OrderGetPayload<{
  include: { items: true };
}>;

// PAY-13: Valid order status transitions
const VALID_ORDER_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'SHIPPED', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'RETURNED'],
  DELIVERED: ['RETURNED', 'REFUNDED'],
  CANCELLED: [],
  RETURNED: ['REFUNDED'],
  REFUNDED: [],
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
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
      customerNotes: order.customerNotes,
      createdAt: order.createdAt,
      confirmedAt: order.confirmedAt,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
    };
  }
}
