import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { Prisma } from '@prisma/client';

interface UpdateCustomerDto {
  firstName?: string;
  lastName?: string;
  phone?: string;
}

interface CustomerSegment {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  emailVerified: boolean;
  createdAt: Date;
  orderCount: number;
  totalSpent: number;
  lastOrderDate: Date | null;
  segment: 'new' | 'regular' | 'high_value' | 'at_risk' | 'vip';
}

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  /**
   * List all customers with filtering and segmentation
   */
  async listCustomers(
    tenantId: string,
    search?: string,
    segment?: string,
    limit = 50,
    offset = 0,
  ) {
    const where: Prisma.StoreCustomerWhereInput = { tenantId };

    // Search filter
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    // LOGIC-6: When segment filter is present, fetch all matching customers first,
    // then filter by segment and paginate in-memory for correct results
    const useInMemoryPagination = !!segment;

    // PERF-5: Fetch customers without loading all order rows
    const customers = await this.prisma.storeCustomer.findMany({
      where,
      include: {
        _count: {
          select: {
            orders: {
              where: { status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] } },
            },
          },
        },
        addresses: {
          take: 1,
          orderBy: { isDefault: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      ...(useInMemoryPagination ? {} : { take: limit, skip: offset }),
    });

    // Fetch order aggregates (totalSpent, lastOrderDate) per customer in one query
    const customerIds = customers.map((c) => c.id);
    const orderAggregates = customerIds.length > 0
      ? await this.prisma.order.groupBy({
          by: ['customerId'],
          where: {
            customerId: { in: customerIds },
            tenantId,
            status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] },
          },
          _sum: { grandTotal: true },
          _max: { createdAt: true },
        })
      : [];

    const aggMap = new Map(
      orderAggregates.map((a) => [
        a.customerId,
        {
          totalSpent: Number(a._sum.grandTotal || 0),
          lastOrderDate: a._max.createdAt || null,
        },
      ]),
    );

    // Calculate segments for each customer
    const customersWithSegments: CustomerSegment[] = customers.map((customer) => {
      const orderCount = customer._count.orders;
      const agg = aggMap.get(customer.id);
      const totalSpent = agg?.totalSpent || 0;
      const lastOrderDate = agg?.lastOrderDate || null;

      let customerSegment: CustomerSegment['segment'] = 'regular';
      const daysSinceSignup = Math.floor(
        (Date.now() - customer.createdAt.getTime()) / (1000 * 60 * 60 * 24),
      );
      const daysSinceLastOrder = lastOrderDate
        ? Math.floor((Date.now() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      if (totalSpent > 1000) {
        customerSegment = 'vip';
      } else if (totalSpent > 500) {
        customerSegment = 'high_value';
      } else if (daysSinceSignup <= 30) {
        customerSegment = 'new';
      } else if (daysSinceLastOrder && daysSinceLastOrder > 90) {
        customerSegment = 'at_risk';
      }

      return {
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
        emailVerified: customer.emailVerified,
        createdAt: customer.createdAt,
        orderCount,
        totalSpent,
        lastOrderDate,
        segment: customerSegment,
      };
    });

    // LOGIC-6: Filter by segment first, then paginate
    const filtered = segment
      ? customersWithSegments.filter((c) => c.segment === segment)
      : customersWithSegments;

    const total = useInMemoryPagination
      ? filtered.length
      : await this.prisma.storeCustomer.count({ where });

    const paginatedResults = useInMemoryPagination
      ? filtered.slice(offset, offset + limit)
      : filtered;

    return {
      customers: paginatedResults,
      total,
      limit,
      offset,
    };
  }

  /**
   * Get customer details with full order history
   */
  async getCustomer(tenantId: string, customerId: string) {
    const customer = await this.prisma.storeCustomer.findFirst({
      where: { id: customerId, tenantId },
      include: {
        addresses: {
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        },
        orders: {
          where: { status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] } },
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentStatus: true,
            grandTotal: true,
            createdAt: true,
            items: {
              select: {
                id: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        wishlists: {
          include: {
            items: true,
          },
        },
        reviews: {
          include: {
            productListing: {
              select: {
                displayName: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Calculate statistics
    const totalSpent = customer.orders.reduce(
      (sum, order) => sum + Number(order.grandTotal),
      0,
    );
    const avgOrderValue = customer.orders.length > 0 ? totalSpent / customer.orders.length : 0;
    const lastOrderDate =
      customer.orders.length > 0 ? customer.orders[0].createdAt : null;

    return {
      ...customer,
      stats: {
        totalOrders: customer.orders.length,
        totalSpent,
        avgOrderValue,
        lastOrderDate,
        wishlistCount: customer.wishlists.length,
        reviewCount: customer.reviews.length,
      },
    };
  }

  /**
   * Update customer profile
   */
  async updateCustomer(
    tenantId: string,
    customerId: string,
    dto: UpdateCustomerDto,
  ) {
    const customer = await this.prisma.storeCustomer.findFirst({
      where: { id: customerId, tenantId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return this.prisma.storeCustomer.update({
      where: { id: customerId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
      },
    });
  }

  /**
   * Soft delete customer (deactivate)
   */
  async deleteCustomer(tenantId: string, customerId: string) {
    const customer = await this.prisma.storeCustomer.findFirst({
      where: { id: customerId, tenantId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Soft delete by deactivating
    await this.prisma.storeCustomer.update({
      where: { id: customerId },
      data: { isActive: false },
    });

    return { success: true, message: 'Customer deactivated' };
  }

  /**
   * Get customer orders with details
   */
  async getCustomerOrders(tenantId: string, customerId: string) {
    const customer = await this.prisma.storeCustomer.findFirst({
      where: { id: customerId, tenantId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return this.prisma.order.findMany({
      where: { customerId, tenantId },
      include: {
        items: {
          select: {
            quantity: true,
            unitPrice: true,
            totalPrice: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get customer statistics summary
   */
  async getCustomerStats(tenantId: string) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Total customers
    const totalCustomers = await this.prisma.storeCustomer.count({
      where: { tenantId, isActive: true },
    });

    // New customers (last 30 days)
    const newCustomers = await this.prisma.storeCustomer.count({
      where: {
        tenantId,
        isActive: true,
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    // High value customers (>$1000 spent)
    const ordersWithTotals = await this.prisma.order.groupBy({
      by: ['customerId'],
      where: {
        tenantId,
        customerId: { not: null },
        status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] },
      },
      _sum: {
        grandTotal: true,
      },
    });

    const highValueCustomers = ordersWithTotals.filter(
      (o) => Number(o._sum.grandTotal) > 1000,
    ).length;

    // At-risk customers (no order in 90 days but have ordered before)
    const recentOrders = await this.prisma.order.findMany({
      where: {
        tenantId,
        customerId: { not: null },
        createdAt: { gte: ninetyDaysAgo },
        status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] },
      },
      select: { customerId: true },
      distinct: ['customerId'],
    });

    const recentCustomerIds = new Set(recentOrders.map((o) => o.customerId));

    const customersWithOrders = await this.prisma.order.findMany({
      where: {
        tenantId,
        customerId: { not: null },
        status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] },
      },
      select: { customerId: true },
      distinct: ['customerId'],
    });

    const atRiskCustomers = customersWithOrders.filter(
      (o) => !recentCustomerIds.has(o.customerId),
    ).length;

    return {
      totalCustomers,
      newCustomers,
      highValueCustomers,
      atRiskCustomers,
    };
  }
}
