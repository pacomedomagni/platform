import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { StripeConnectService } from '../../onboarding/stripe-connect.service';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeConnectService: StripeConnectService,
  ) {}

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

  /**
   * Get merchant earnings: Stripe balance + recent payouts
   */
  async getEarnings(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        stripeConnectAccountId: true,
        paymentProvider: true,
        paymentProviderStatus: true,
        platformFeePercent: true,
      },
    });

    if (!tenant?.stripeConnectAccountId || tenant.paymentProviderStatus !== 'active') {
      return {
        balance: null,
        payouts: [],
        platformFeePercent: Number(tenant?.platformFeePercent ?? 0),
        message: 'Payment provider not connected or not active',
      };
    }

    try {
      const [balance, payouts] = await Promise.all([
        this.stripeConnectService.getAccountBalance(tenant.stripeConnectAccountId),
        this.stripeConnectService.getPayouts(tenant.stripeConnectAccountId, 10),
      ]);

      return {
        balance,
        payouts,
        platformFeePercent: Number(tenant.platformFeePercent),
      };
    } catch (error) {
      this.logger.error(`Failed to fetch earnings for tenant ${tenantId}:`, error);
      return {
        balance: null,
        payouts: [],
        platformFeePercent: Number(tenant.platformFeePercent),
        message: 'Unable to retrieve earnings data. Please try again later.',
      };
    }
  }

  /**
   * Get inventory alerts for dashboard
   */
  async getInventoryAlerts(tenantId: string) {
    // Find products with low stock (available < 5)
    const lowStockProducts = await this.prisma.$queryRaw<
      Array<{ productId: string; displayName: string; availableQty: number }>
    >`
      SELECT
        pl.id as "productId",
        pl."displayName",
        COALESCE(SUM(wib."actualQty" - wib."reservedQty"), 0)::int as "availableQty"
      FROM product_listings pl
      JOIN items i ON pl."itemId" = i.id
      LEFT JOIN warehouse_item_balances wib ON wib."itemId" = i.id AND wib."tenantId" = ${tenantId}
      WHERE pl."tenantId" = ${tenantId}
        AND pl."isPublished" = true
      GROUP BY pl.id, pl."displayName"
      HAVING COALESCE(SUM(wib."actualQty" - wib."reservedQty"), 0) <= 5
      ORDER BY COALESCE(SUM(wib."actualQty" - wib."reservedQty"), 0) ASC
      LIMIT 20
    `;

    const outOfStock = lowStockProducts.filter(p => p.availableQty <= 0);
    const lowStock = lowStockProducts.filter(p => p.availableQty > 0);

    return {
      outOfStockCount: outOfStock.length,
      lowStockCount: lowStock.length,
      outOfStock: outOfStock.map(p => ({
        productId: p.productId,
        name: p.displayName,
        available: p.availableQty,
      })),
      lowStock: lowStock.map(p => ({
        productId: p.productId,
        name: p.displayName,
        available: p.availableQty,
      })),
    };
  }
}
