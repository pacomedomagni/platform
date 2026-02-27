import { Injectable, Logger } from '@nestjs/common';
import { DbService } from '@platform/db';
import {
  DashboardSummary,
  RevenueStats,
  OrderStats,
  InventoryAlert,
  TopProduct,
  RecentActivity,
} from './dto';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly db: DbService) {}

  async getSummary(tenantId: string): Promise<DashboardSummary> {
    const [
      revenue,
      orders,
      inventory,
      payments,
      customers,
      topProducts,
      recentActivity,
    ] = await Promise.all([
      this.getRevenueStats(tenantId),
      this.getOrderStats(tenantId),
      this.getInventoryAlerts(tenantId),
      this.getPaymentStats(tenantId),
      this.getCustomerStats(tenantId),
      this.getTopProducts(tenantId),
      this.getRecentActivity(tenantId),
    ]);

    return {
      revenue,
      orders,
      inventory,
      payments,
      customers,
      topProducts,
      recentActivity,
    };
  }

  private async getRevenueStats(tenantId: string): Promise<RevenueStats> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(thisWeekStart);

    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Get revenue by period using captured payments
    const [todayOrders, yesterdayOrders, thisWeekOrders, lastWeekOrders, thisMonthOrders, lastMonthOrders] =
      await Promise.all([
        this.db.order.aggregate({
          where: {
            tenantId,
            paymentStatus: 'CAPTURED',
            createdAt: { gte: today },
          },
          _sum: { grandTotal: true },
        }),
        this.db.order.aggregate({
          where: {
            tenantId,
            paymentStatus: 'CAPTURED',
            createdAt: { gte: yesterday, lt: today },
          },
          _sum: { grandTotal: true },
        }),
        this.db.order.aggregate({
          where: {
            tenantId,
            paymentStatus: 'CAPTURED',
            createdAt: { gte: thisWeekStart },
          },
          _sum: { grandTotal: true },
        }),
        this.db.order.aggregate({
          where: {
            tenantId,
            paymentStatus: 'CAPTURED',
            createdAt: { gte: lastWeekStart, lt: lastWeekEnd },
          },
          _sum: { grandTotal: true },
        }),
        this.db.order.aggregate({
          where: {
            tenantId,
            paymentStatus: 'CAPTURED',
            createdAt: { gte: thisMonthStart },
          },
          _sum: { grandTotal: true },
        }),
        this.db.order.aggregate({
          where: {
            tenantId,
            paymentStatus: 'CAPTURED',
            createdAt: { gte: lastMonthStart, lt: thisMonthStart },
          },
          _sum: { grandTotal: true },
        }),
      ]);

    const todayRevenue = Number(todayOrders._sum.grandTotal || 0);
    const yesterdayRevenue = Number(yesterdayOrders._sum.grandTotal || 0);
    const thisWeekRevenue = Number(thisWeekOrders._sum.grandTotal || 0);
    const lastWeekRevenue = Number(lastWeekOrders._sum.grandTotal || 0);
    const thisMonthRevenue = Number(thisMonthOrders._sum.grandTotal || 0);
    const lastMonthRevenue = Number(lastMonthOrders._sum.grandTotal || 0);

    return {
      today: todayRevenue,
      yesterday: yesterdayRevenue,
      thisWeek: thisWeekRevenue,
      lastWeek: lastWeekRevenue,
      thisMonth: thisMonthRevenue,
      lastMonth: lastMonthRevenue,
      percentageChangeWeek:
        lastWeekRevenue > 0
          ? ((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100
          : 0,
      percentageChangeMonth:
        lastMonthRevenue > 0
          ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
          : 0,
    };
  }

  private async getOrderStats(tenantId: string): Promise<OrderStats> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [statusCounts, todayCount, weekCount, monthCount] = await Promise.all([
      this.db.order.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { status: true },
      }),
      this.db.order.count({
        where: { tenantId, createdAt: { gte: today } },
      }),
      this.db.order.count({
        where: { tenantId, createdAt: { gte: thisWeekStart } },
      }),
      this.db.order.count({
        where: { tenantId, createdAt: { gte: thisMonthStart } },
      }),
    ]);

    const statusMap = statusCounts.reduce(
      (acc, item) => {
        acc[item.status.toLowerCase()] = item._count.status;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      pending: statusMap.pending || 0,
      processing: statusMap.processing || 0,
      shipped: statusMap.shipped || 0,
      delivered: statusMap.delivered || 0,
      cancelled: statusMap.cancelled || 0,
      todayCount,
      weekCount,
      monthCount,
    };
  }

  private async getInventoryAlerts(tenantId: string): Promise<{
    lowStock: InventoryAlert[];
    outOfStock: InventoryAlert[];
    totalActive: number;
  }> {
    // Get items with warehouse balances.
    // NOTE: Limited to 500 items to prevent loading entire catalog. For tenants
    // with more stock items, consider a raw COUNT query or cursor-based pagination.
    const itemsWithStock = await this.db.item.findMany({
      where: {
        tenantId,
        isActive: true,
        isStockItem: true,
      },
      include: {
        warehouseItemBalances: {
          select: { actualQty: true },
        },
      },
      take: 500,
    });

    const lowStock: InventoryAlert[] = [];
    const outOfStock: InventoryAlert[] = [];

    for (const item of itemsWithStock) {
      const totalStock = item.warehouseItemBalances.reduce(
        (sum, b) => sum + Number(b.actualQty),
        0
      );
      const reorderLevel = Number(item.reorderLevel || 0);
      const reorderQty = Number(item.reorderQty || 0);

      if (totalStock <= 0) {
        outOfStock.push({
          id: item.id,
          code: item.code,
          name: item.name,
          currentStock: totalStock,
          reorderLevel,
          reorderQty,
          isOutOfStock: true,
        });
      } else if (reorderLevel > 0 && totalStock <= reorderLevel) {
        lowStock.push({
          id: item.id,
          code: item.code,
          name: item.name,
          currentStock: totalStock,
          reorderLevel,
          reorderQty,
          isOutOfStock: false,
        });
      }
    }

    return {
      lowStock: lowStock.slice(0, 10), // Limit to top 10
      lowStockCount: lowStock.length,
      outOfStock: outOfStock.slice(0, 10),
      outOfStockCount: outOfStock.length,
      totalActive: itemsWithStock.length,
    };
  }

  private async getPaymentStats(tenantId: string): Promise<{
    pendingCount: number;
    pendingTotal: number;
    capturedToday: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [pendingPayments, capturedToday] = await Promise.all([
      this.db.order.aggregate({
        where: {
          tenantId,
          paymentStatus: 'PENDING',
          status: { in: ['PENDING', 'CONFIRMED'] },
        },
        _count: { id: true },
        _sum: { grandTotal: true },
      }),
      this.db.order.aggregate({
        where: {
          tenantId,
          paymentStatus: 'CAPTURED',
          createdAt: { gte: today },
        },
        _sum: { grandTotal: true },
      }),
    ]);

    return {
      pendingCount: pendingPayments._count.id || 0,
      pendingTotal: Number(pendingPayments._sum.grandTotal || 0),
      capturedToday: Number(capturedToday._sum.grandTotal || 0),
    };
  }

  private async getCustomerStats(tenantId: string): Promise<{
    total: number;
    newThisWeek: number;
    newThisMonth: number;
  }> {
    const now = new Date();
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
    thisWeekStart.setHours(0, 0, 0, 0);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [total, newThisWeek, newThisMonth] = await Promise.all([
      this.db.storeCustomer.count({ where: { tenantId } }),
      this.db.storeCustomer.count({
        where: { tenantId, createdAt: { gte: thisWeekStart } },
      }),
      this.db.storeCustomer.count({
        where: { tenantId, createdAt: { gte: thisMonthStart } },
      }),
    ]);

    return { total, newThisWeek, newThisMonth };
  }

  private async getTopProducts(tenantId: string, limit = 5): Promise<TopProduct[]> {
    // Get top selling products from order items
    // Use raw query to avoid Prisma circular type inference issues with complex groupBy
    const topProducts = await this.db.$queryRaw<Array<{
      productCode: string;
      productName: string;
      totalQty: number;
      totalRevenue: number;
    }>>`
      SELECT
        oi."sku" as "productCode",
        oi."name" as "productName",
        SUM(oi."quantity")::float as "totalQty",
        SUM(oi."totalPrice")::float as "totalRevenue"
      FROM "order_items" oi
      INNER JOIN "orders" o ON o.id = oi."orderId"
      WHERE o."tenantId" = ${tenantId}
        AND o."paymentStatus" = 'CAPTURED'
      GROUP BY oi."sku", oi."name"
      ORDER BY "totalRevenue" DESC
      LIMIT ${limit}
    `;

    return topProducts.map((p, idx) => ({
      id: `top-${idx}`,
      code: p.productCode,
      name: p.productName,
      salesCount: Number(p.totalQty || 0),
      revenue: Number(p.totalRevenue || 0),
    }));
  }

  private async getRecentActivity(
    tenantId: string,
    limit = 10
  ): Promise<RecentActivity[]> {
    // Use a single combined query via UNION ALL for efficiency (L3)
    const combined = await this.db.$queryRaw<Array<{
      id: string;
      type: string;
      action: string;
      description: string;
      timestamp: Date;
      metadata: string;
    }>>`
      (
        SELECT
          o.id,
          'order' as type,
          'created' as action,
          CONCAT('Order #', o."orderNumber", ' placed for $', ROUND(o."grandTotal"::numeric, 2)) as description,
          o."createdAt" as timestamp,
          json_build_object('orderNumber', o."orderNumber", 'status', o."status", 'email', o."email")::text as metadata
        FROM orders o
        WHERE o."tenantId" = ${tenantId}
        ORDER BY o."createdAt" DESC
        LIMIT ${limit}
      )
      UNION ALL
      (
        SELECT
          sc.id,
          'customer' as type,
          'registered' as action,
          CONCAT('New customer: ', COALESCE(sc."firstName", ''), ' ', COALESCE(sc."lastName", ''), ' (', sc."email", ')') as description,
          sc."createdAt" as timestamp,
          json_build_object('email', sc."email")::text as metadata
        FROM store_customers sc
        WHERE sc."tenantId" = ${tenantId}
        ORDER BY sc."createdAt" DESC
        LIMIT 5
      )
      ORDER BY timestamp DESC
      LIMIT ${limit}
    `;

    return combined.map(row => ({
      id: row.id,
      type: row.type as 'order' | 'customer',
      action: row.action,
      description: row.description,
      timestamp: row.timestamp,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
    }));
  }

  /**
   * Get only revenue stats (H5 - lightweight endpoint instead of full summary)
   */
  async getRevenue(tenantId: string): Promise<RevenueStats> {
    return this.getRevenueStats(tenantId);
  }

  /**
   * Get only order stats (H5 - lightweight endpoint instead of full summary)
   */
  async getOrders(tenantId: string): Promise<OrderStats> {
    return this.getOrderStats(tenantId);
  }

  /**
   * Get only inventory alerts (H5 - lightweight endpoint instead of full summary)
   */
  async getInventory(tenantId: string) {
    return this.getInventoryAlerts(tenantId);
  }

  /**
   * Get "What needs attention" summary - items requiring action
   */
  async getAttentionItems(tenantId: string): Promise<{
    urgentOrders: number;
    lowStockCount: number;
    outOfStockCount: number;
    pendingPayments: number;
    unshippedOrders: number;
  }> {
    const [
      urgentOrders,
      inventory,
      pendingPayments,
      unshippedOrders,
    ] = await Promise.all([
      // Orders confirmed but not yet processing (need attention)
      this.db.order.count({
        where: {
          tenantId,
          status: 'CONFIRMED',
          paymentStatus: 'CAPTURED',
        },
      }),
      this.getInventoryAlerts(tenantId),
      // Pending payment orders
      this.db.order.count({
        where: {
          tenantId,
          paymentStatus: 'PENDING',
          status: { not: 'CANCELLED' },
        },
      }),
      // Orders processing but not shipped
      this.db.order.count({
        where: {
          tenantId,
          status: 'PROCESSING',
          shippedAt: null,
        },
      }),
    ]);

    return {
      urgentOrders,
      lowStockCount: inventory.lowStockCount,
      outOfStockCount: inventory.outOfStockCount,
      pendingPayments,
      unshippedOrders,
    };
  }
}
