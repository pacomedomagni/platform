import { Injectable, BadRequestException } from '@nestjs/common';
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
      legalPageCount,
      adminUser,
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
      // Tenant details
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          paymentProviderStatus: true,
          paymentProvider: true,
          onboardingStep: true,
          defaultTaxRate: true,
          defaultShippingRate: true,
          storePublished: true,
          storePublishedAt: true,
        },
      }),
      // Legal page count
      this.prisma.storePage.count({
        where: { tenantId, isPublished: true },
      }),
      // Admin user email verification status
      this.prisma.user.findFirst({
        where: { tenantId, roles: { has: 'admin' } },
        select: { emailVerified: true },
      }),
    ]);

    const totalRevenue = Number(revenueResult._sum.grandTotal ?? 0);

    // Determine setup checklist
    const checklist = {
      emailVerified: adminUser?.emailVerified ?? false,
      paymentsConnected: tenant?.paymentProviderStatus === 'active',
      hasProducts: productCount > 0,
      hasCustomizedSettings:
        tenant &&
        (Number(tenant.defaultTaxRate) !== 0.0825 ||
          Number(tenant.defaultShippingRate) !== 9.99),
      hasLegalPages: legalPageCount >= 2,
      storePublished: tenant?.storePublished ?? false,
    };

    return {
      totalRevenue,
      totalOrders: orderCount,
      totalProducts: productCount,
      paymentProvider: tenant?.paymentProvider ?? null,
      paymentStatus: tenant?.paymentProviderStatus ?? 'pending',
      storePublished: tenant?.storePublished ?? false,
      storePublishedAt: tenant?.storePublishedAt ?? null,
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

  async getStoreReadiness(tenantId: string) {
    const [tenant, productCount, legalPageCount, adminUser] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          paymentProviderStatus: true,
          defaultTaxRate: true,
          defaultShippingRate: true,
          storePublished: true,
        },
      }),
      this.prisma.productListing.count({ where: { tenantId, isPublished: true } }),
      this.prisma.storePage.count({ where: { tenantId, isPublished: true } }),
      this.prisma.user.findFirst({
        where: { tenantId, roles: { has: 'admin' } },
        select: { emailVerified: true },
      }),
    ]);

    const checks = {
      emailVerified: adminUser?.emailVerified ?? false,
      paymentsConnected: tenant?.paymentProviderStatus === 'active',
      hasProducts: productCount > 0,
      hasLegalPages: legalPageCount >= 2,
      hasCustomizedSettings:
        tenant &&
        (Number(tenant.defaultTaxRate) !== 0.0825 ||
          Number(tenant.defaultShippingRate) !== 9.99),
    };

    const ready = checks.paymentsConnected && checks.hasProducts && checks.hasLegalPages;

    return { ready, checks, storePublished: tenant?.storePublished ?? false };
  }

  async publishStore(tenantId: string) {
    const readiness = await this.getStoreReadiness(tenantId);

    if (!readiness.ready) {
      throw new BadRequestException(
        'Store is not ready to publish. Ensure payments are connected, you have products, and at least 2 legal pages.',
      );
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { storePublished: true, storePublishedAt: new Date() },
    });

    return { success: true, storePublished: true };
  }

  async unpublishStore(tenantId: string) {
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { storePublished: false },
    });

    return { success: true, storePublished: false };
  }
}
