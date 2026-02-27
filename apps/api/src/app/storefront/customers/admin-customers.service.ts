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
    query: { search?: string; segment?: string }
  ) {
    const { search, segment } = query;

    // Build where clause
    const where: any = { tenantId };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Fetch customers with aggregated order data
    const customers = await this.prisma.storeCustomer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
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
    if (segment) {
      mapped = mapped.filter((c) => {
        switch (segment) {
          case 'new':
            return new Date(c.createdAt) > thirtyDaysAgo;
          case 'high_value':
            return c.totalSpent > 1000;
          case 'vip':
            return c.totalSpent > 1000;
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

    return { data: mapped };
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
   * Update a customer's basic info (admin).
   */
  async updateCustomer(
    tenantId: string,
    customerId: string,
    dto: { firstName?: string; lastName?: string; phone?: string; isActive?: boolean }
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
