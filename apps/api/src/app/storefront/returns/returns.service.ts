import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { Prisma, ReturnStatus } from '@prisma/client';

@Injectable()
export class ReturnsService {
  constructor(private readonly prisma: PrismaService) {}

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

    // Generate return number: RET-00001
    const lastReturn = await this.prisma.returnRequest.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: { returnNumber: true },
    });

    let nextNumber = 1;
    if (lastReturn?.returnNumber) {
      const match = lastReturn.returnNumber.match(/RET-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    const returnNumber = `RET-${String(nextNumber).padStart(5, '0')}`;

    const customerName = order.customer
      ? [order.customer.firstName, order.customer.lastName].filter(Boolean).join(' ')
      : undefined;

    const returnRequest = await this.prisma.returnRequest.create({
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

    return this.mapReturnToResponse(updated);
  }

  /**
   * Process refund - set REFUNDED with refund amount.
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

    const updated = await this.prisma.returnRequest.update({
      where: { id },
      data: {
        status: 'REFUNDED',
        refundAmount: data.refundAmount,
        refundMethod: data.refundMethod || 'original_payment',
        refundedAt: new Date(),
      },
      include: { items: true },
    });

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
