import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@platform/db';

@Injectable()
export class AdminCustomersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List all customers for a tenant with optional search and segment filtering.
   * Returns customers enriched with orderCount, totalSpent, and lastOrderDate.
   */
  async listCustomers(
    tenantId: string,
    query: { search?: string; segment?: string; page?: number; limit?: number }
  ) {
    const { search, segment } = query;
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(200, Math.max(1, query.limit || 50));
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = { tenantId };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get total count for stats (unfiltered by segment)
    const totalCount = await this.prisma.storeCustomer.count({ where });

    // Fetch customers with aggregated order data (paginated)
    const customers = await this.prisma.storeCustomer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        orders: {
          select: {
            grandTotal: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    // Map to response shape with computed fields
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    let mapped = customers.map((c) => {
      const orderCount = c.orders.length;
      const totalSpent = c.orders.reduce(
        (sum, o) => sum + Number(o.grandTotal),
        0
      );
      const lastOrderDate =
        c.orders.length > 0 ? c.orders[0].createdAt.toISOString() : null;

      return {
        id: c.id,
        email: c.email,
        firstName: c.firstName,
        lastName: c.lastName,
        phone: c.phone,
        emailVerified: c.emailVerified,
        isActive: c.isActive,
        createdAt: c.createdAt.toISOString(),
        orderCount,
        totalSpent,
        lastOrderDate,
      };
    });

    // Apply segment filtering after computing order stats
    // M-3: Differentiate high_value (totalSpent > 500) from vip (totalSpent > 1000 AND orderCount >= 5)
    if (segment) {
      mapped = mapped.filter((c) => {
        switch (segment) {
          case 'new':
            return new Date(c.createdAt) > thirtyDaysAgo;
          case 'high_value':
            return c.totalSpent > 500;
          case 'vip':
            return c.totalSpent > 1000 && c.orderCount >= 5;
          case 'at_risk':
            return (
              c.lastOrderDate !== null &&
              new Date(c.lastOrderDate) < ninetyDaysAgo
            );
          default:
            return true;
        }
      });
    }

    // Compute stats from the current page (best-effort; full stats require separate aggregation)
    const allMapped = customers.map((c) => {
      const orderCount = c.orders.length;
      const totalSpent = c.orders.reduce(
        (sum, o) => sum + Number(o.grandTotal),
        0
      );
      const lastOrderDate =
        c.orders.length > 0 ? c.orders[0].createdAt.toISOString() : null;
      return { createdAt: c.createdAt.toISOString(), totalSpent, lastOrderDate, orderCount };
    });

    const stats = {
      total: totalCount,
      new: allMapped.filter((c) => new Date(c.createdAt) > thirtyDaysAgo).length,
      highValue: allMapped.filter((c) => c.totalSpent > 500).length,
      atRisk: allMapped.filter(
        (c) => c.lastOrderDate !== null && new Date(c.lastOrderDate) < ninetyDaysAgo
      ).length,
    };

    return {
      data: mapped,
      stats,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }

  /**
   * Get a single customer by ID with addresses.
   */
  async getCustomer(tenantId: string, customerId: string) {
    const customer = await this.prisma.storeCustomer.findFirst({
      where: { id: customerId, tenantId },
      include: {
        addresses: {
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return {
      id: customer.id,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone,
      emailVerified: customer.emailVerified,
      isActive: customer.isActive,
      createdAt: customer.createdAt.toISOString(),
      addresses: customer.addresses.map((a) => ({
        id: a.id,
        label: a.label,
        firstName: a.firstName,
        lastName: a.lastName,
        company: a.company,
        phone: a.phone,
        addressLine1: a.addressLine1,
        addressLine2: a.addressLine2 || undefined,
        city: a.city,
        state: a.state || undefined,
        postalCode: a.postalCode,
        country: a.country,
        isDefault: a.isDefault,
      })),
    };
  }

  /**
   * Get orders for a specific customer.
   */
  async getCustomerOrders(tenantId: string, customerId: string) {
    // Verify customer exists
    const customer = await this.prisma.storeCustomer.findFirst({
      where: { id: customerId, tenantId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const orders = await this.prisma.order.findMany({
      where: { tenantId, customerId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          select: { id: true },
        },
      },
    });

    return {
      data: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        paymentStatus: o.paymentStatus,
        grandTotal: Number(o.grandTotal),
        itemCount: o.items.length,
        createdAt: o.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Update customer notes (admin).
   * Note: Requires 'adminNotes' field on StoreCustomer model.
   * Until the schema migration is applied, notes are accepted but not persisted.
   */
  async updateCustomerNotes(
    tenantId: string,
    customerId: string,
    notes: string
  ) {
    const customer = await this.prisma.storeCustomer.findFirst({
      where: { id: customerId, tenantId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // TODO: Persist notes once 'adminNotes' field is added to StoreCustomer schema
    // await this.prisma.storeCustomer.update({
    //   where: { id: customerId },
    //   data: { adminNotes: notes },
    // });

    return { success: true, notes };
  }

  /**
   * Update a customer's basic info (admin).
   */
  async updateCustomer(
    tenantId: string,
    customerId: string,
    dto: { firstName?: string; lastName?: string; phone?: string; isActive?: boolean; notes?: string }
  ) {
    const customer = await this.prisma.storeCustomer.findFirst({
      where: { id: customerId, tenantId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const updated = await this.prisma.storeCustomer.update({
      where: { id: customerId },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    return {
      id: updated.id,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      phone: updated.phone,
      emailVerified: updated.emailVerified,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
    };
  }
}
