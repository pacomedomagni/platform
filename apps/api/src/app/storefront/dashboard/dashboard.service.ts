import { Injectable } from '@nestjs/common';
import { PrismaService } from '@platform/db';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardStats(tenantId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      revenueResult,
      orderCount,
      productCount,
      recentOrders,
      tenant,
    ] = await Promise.all([
      // Total revenue this month
      this.prisma.order.aggregate({
        where: {
          tenantId,
          createdAt: { gte: startOfMonth },
          status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] },
        },
        _sum: { grandTotal: true },
      }),
      // Total orders this month
      this.prisma.order.count({
        where: {
          tenantId,
          createdAt: { gte: startOfMonth },
        },
      }),
      // Published products
      this.prisma.productListing.count({
        where: {
          tenantId,
          isPublished: true,
        },
      }),
      // Recent orders
      this.prisma.order.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          orderNumber: true,
          email: true,
          grandTotal: true,
          status: true,
          createdAt: true,
        },
      }),
      // Tenant payment status
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          paymentProviderStatus: true,
          paymentProvider: true,
          onboardingStep: true,
          defaultTaxRate: true,
          defaultShippingRate: true,
        },
      }),
    ]);

    const totalRevenue = Number(revenueResult._sum.grandTotal ?? 0);

    // Determine setup checklist
    const checklist = {
      paymentsConnected: tenant?.paymentProviderStatus === 'active',
      hasProducts: productCount > 0,
      hasCustomizedSettings:
        tenant &&
        (Number(tenant.defaultTaxRate) !== 0.0825 ||
          Number(tenant.defaultShippingRate) !== 9.99),
    };

    return {
      totalRevenue,
      totalOrders: orderCount,
      totalProducts: productCount,
      paymentProvider: tenant?.paymentProvider ?? null,
      paymentStatus: tenant?.paymentProviderStatus ?? 'pending',
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        email: o.email,
        grandTotal: Number(o.grandTotal),
        status: o.status,
        createdAt: o.createdAt,
      })),
      checklist,
    };
  }
}
