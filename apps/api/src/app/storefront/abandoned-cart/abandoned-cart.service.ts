import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { Prisma } from '@prisma/client';

@Injectable()
export class AbandonedCartService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find carts that are abandoned: status 'active', lastActivityAt > 1 hour ago,
   * have items, and have an email via linked customer.
   */
  async findAbandonedCarts(tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const abandonedCarts = await this.prisma.cart.findMany({
      where: {
        tenantId,
        status: 'active',
        lastActivityAt: { lt: oneHourAgo },
        items: { some: {} },
        customer: {
          isNot: null,
        },
      },
      include: {
        customer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                displayName: true,
                price: true,
                images: true,
              },
            },
          },
        },
      },
      orderBy: { lastActivityAt: 'desc' },
    });

    // Filter to only carts where customer has an email
    return abandonedCarts.filter((cart) => cart.customer?.email);
  }

  /**
   * Create AbandonedCartEmail records for abandoned carts.
   * Sequence 1 at 1hr, sequence 2 at 24hr, sequence 3 at 72hr after last activity.
   */
  async scheduleRecoveryEmails(tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const abandonedCarts = await this.findAbandonedCarts(tenantId);

    const sequences = [
      { sequence: 1, delayMs: 1 * 60 * 60 * 1000 },       // 1 hour
      { sequence: 2, delayMs: 24 * 60 * 60 * 1000 },      // 24 hours
      { sequence: 3, delayMs: 72 * 60 * 60 * 1000 },      // 72 hours
    ];

    let scheduledCount = 0;

    for (const cart of abandonedCarts) {
      if (!cart.customer?.email) continue;

      for (const seq of sequences) {
        // Check if this sequence already exists for this cart
        const existing = await this.prisma.abandonedCartEmail.findFirst({
          where: {
            tenantId,
            cartId: cart.id,
            sequence: seq.sequence,
          },
        });

        if (existing) continue;

        const scheduledFor = new Date(cart.lastActivityAt.getTime() + seq.delayMs);

        await this.prisma.abandonedCartEmail.create({
          data: {
            tenantId,
            cartId: cart.id,
            email: cart.customer.email,
            customerId: cart.customer.id,
            sequence: seq.sequence,
            status: 'pending',
            scheduledFor,
          },
        });

        scheduledCount++;
      }
    }

    return {
      cartsProcessed: abandonedCarts.length,
      emailsScheduled: scheduledCount,
    };
  }

  /**
   * List recovery emails with pagination.
   */
  async listRecoveryEmails(
    tenantId: string,
    query: { limit?: number; offset?: number; status?: string; cartId?: string },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const { limit = 20, offset = 0, status, cartId } = query;

    const where: Prisma.AbandonedCartEmailWhereInput = { tenantId };

    if (status) {
      where.status = status;
    }

    if (cartId) {
      where.cartId = cartId;
    }

    const [data, total] = await Promise.all([
      this.prisma.abandonedCartEmail.findMany({
        where,
        orderBy: { scheduledFor: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.abandonedCartEmail.count({ where }),
    ]);

    return {
      data,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + data.length < total,
      },
    };
  }

  /**
   * Get recovery stats: total abandoned, emails sent, recovered, recovery rate, recovered revenue.
   */
  async getRecoveryStats(tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const [totalAbandoned, emailsSent, recovered, recoveredCarts] = await Promise.all([
      // Total carts that have been abandoned (have abandoned emails scheduled)
      this.prisma.cart.count({
        where: {
          tenantId,
          status: 'active',
          lastActivityAt: { lt: new Date(Date.now() - 60 * 60 * 1000) },
          items: { some: {} },
          customer: { isNot: null },
        },
      }),
      // Total emails sent
      this.prisma.abandonedCartEmail.count({
        where: {
          tenantId,
          status: { in: ['sent', 'opened', 'clicked', 'recovered'] },
        },
      }),
      // Recovered carts (converted after recovery email)
      this.prisma.abandonedCartEmail.count({
        where: {
          tenantId,
          status: 'recovered',
        },
      }),
      // Recovered carts with their cart totals for revenue
      this.prisma.cart.findMany({
        where: {
          tenantId,
          recoveredAt: { not: null },
        },
        select: {
          grandTotal: true,
        },
      }),
    ]);

    const recoveredRevenue = recoveredCarts.reduce(
      (sum, cart) => sum + Number(cart.grandTotal),
      0,
    );

    const recoveryRate = totalAbandoned > 0
      ? Math.round((recovered / totalAbandoned) * 10000) / 100
      : 0;

    return {
      totalAbandoned,
      emailsSent,
      recovered,
      recoveryRate,
      recoveredRevenue,
    };
  }

  /**
   * Mark a cart as recovered when converted to an order.
   */
  async markRecovered(tenantId: string, cartId: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const cart = await this.prisma.cart.findFirst({
      where: { id: cartId, tenantId },
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    // Update the cart
    await this.prisma.cart.update({
      where: { id: cartId },
      data: {
        recoveredAt: new Date(),
      },
    });

    // Mark all pending/sent emails for this cart as recovered
    await this.prisma.abandonedCartEmail.updateMany({
      where: {
        tenantId,
        cartId,
        status: { in: ['pending', 'sent', 'opened', 'clicked'] },
      },
      data: {
        status: 'recovered',
        recoveredAt: new Date(),
      },
    });

    return { success: true, cartId };
  }
}
