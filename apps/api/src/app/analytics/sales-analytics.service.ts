import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import {
  SalesTrend,
  TopSellingProduct,
  CategoryPerformance,
  CustomerCohort,
  CustomerLifetimeValue,
  DashboardAnalytics,
} from './analytics.dto';

interface TenantContext {
  tenantId: string;
}

@Injectable()
export class SalesAnalyticsService {
  private readonly logger = new Logger(SalesAnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get sales trends over time
   */
  async getSalesTrends(
    ctx: TenantContext,
    startDate: Date,
    endDate: Date,
    groupBy: 'day' | 'week' | 'month' = 'day'
  ): Promise<SalesTrend[]> {
    const dateFormat = {
      day: 'YYYY-MM-DD',
      week: 'IYYY-IW',
      month: 'YYYY-MM',
    }[groupBy];

    const trends = await this.prisma.$queryRaw<Array<{
      period: string;
      revenue: number;
      order_count: number;
      items_sold: number;
    }>>`
      SELECT 
        TO_CHAR(o."createdAt", ${dateFormat}) as period,
        COALESCE(SUM(o."grandTotal")::float, 0) as revenue,
        COUNT(DISTINCT o.id)::int as order_count,
        COALESCE(SUM(oi."quantity")::int, 0) as items_sold
      FROM orders o
      LEFT JOIN order_items oi ON oi."orderId" = o.id
      WHERE o."tenantId" = ${ctx.tenantId}
        AND o."paymentStatus" = 'CAPTURED'
        AND o."createdAt" >= ${startDate}
        AND o."createdAt" <= ${endDate}
      GROUP BY TO_CHAR(o."createdAt", ${dateFormat})
      ORDER BY period ASC
    `;

    return trends.map(t => ({
      period: t.period,
      revenue: Number(t.revenue),
      orderCount: Number(t.order_count),
      averageOrderValue: t.order_count > 0 ? Number(t.revenue) / Number(t.order_count) : 0,
      itemsSold: Number(t.items_sold),
    }));
  }

  /**
   * Get top selling products
   */
  async getTopSellingProducts(
    ctx: TenantContext,
    startDate: Date,
    endDate: Date,
    limit = 10
  ): Promise<TopSellingProduct[]> {
    const products = await this.prisma.$queryRaw<Array<{
      product_id: string;
      product_name: string;
      product_code: string;
      quantity_sold: number;
      revenue: number;
      order_count: number;
    }>>`
      SELECT 
        oi."productId" as product_id,
        oi."productName" as product_name,
        oi."productCode" as product_code,
        COALESCE(SUM(oi."quantity")::int, 0) as quantity_sold,
        COALESCE(SUM(oi."lineTotal")::float, 0) as revenue,
        COUNT(DISTINCT oi."orderId")::int as order_count
      FROM order_items oi
      INNER JOIN orders o ON o.id = oi."orderId"
      WHERE o."tenantId" = ${ctx.tenantId}
        AND o."paymentStatus" = 'CAPTURED'
        AND o."createdAt" >= ${startDate}
        AND o."createdAt" <= ${endDate}
      GROUP BY oi."productId", oi."productName", oi."productCode"
      ORDER BY revenue DESC
      LIMIT ${limit}
    `;

    return products.map(p => ({
      productId: p.product_id,
      productName: p.product_name,
      productCode: p.product_code,
      quantitySold: Number(p.quantity_sold),
      revenue: Number(p.revenue),
      orderCount: Number(p.order_count),
    }));
  }

  /**
   * Get category performance
   */
  async getCategoryPerformance(
    ctx: TenantContext,
    startDate: Date,
    endDate: Date
  ): Promise<CategoryPerformance[]> {
    // Get total revenue for percentage calculation
    const totalResult = await this.prisma.$queryRaw<[{ total: number }]>`
      SELECT COALESCE(SUM(o."grandTotal")::float, 0) as total
      FROM orders o
      WHERE o."tenantId" = ${ctx.tenantId}
        AND o."paymentStatus" = 'CAPTURED'
        AND o."createdAt" >= ${startDate}
        AND o."createdAt" <= ${endDate}
    `;
    const totalRevenue = Number(totalResult[0]?.total || 0);

    const categories = await this.prisma.$queryRaw<Array<{
      category_id: string;
      category_name: string;
      revenue: number;
      order_count: number;
      items_sold: number;
    }>>`
      SELECT 
        pc.id as category_id,
        pc.name as category_name,
        COALESCE(SUM(oi."lineTotal")::float, 0) as revenue,
        COUNT(DISTINCT oi."orderId")::int as order_count,
        COALESCE(SUM(oi."quantity")::int, 0) as items_sold
      FROM order_items oi
      INNER JOIN orders o ON o.id = oi."orderId"
      LEFT JOIN product_listings pl ON pl."itemId" = oi."productId"
      LEFT JOIN product_categories pc ON pc.id = pl."categoryId"
      WHERE o."tenantId" = ${ctx.tenantId}
        AND o."paymentStatus" = 'CAPTURED'
        AND o."createdAt" >= ${startDate}
        AND o."createdAt" <= ${endDate}
      GROUP BY pc.id, pc.name
      ORDER BY revenue DESC
    `;

    return categories.map(c => ({
      categoryId: c.category_id || 'uncategorized',
      categoryName: c.category_name || 'Uncategorized',
      revenue: Number(c.revenue),
      orderCount: Number(c.order_count),
      itemsSold: Number(c.items_sold),
      percentageOfTotal: totalRevenue > 0 ? (Number(c.revenue) / totalRevenue) * 100 : 0,
    }));
  }

  /**
   * Get customer cohort analysis
   */
  async getCustomerCohorts(
    ctx: TenantContext,
    startDate: Date,
    endDate: Date,
    cohortMonths = 6
  ): Promise<CustomerCohort[]> {
    // Get customers grouped by their first purchase month
    const cohorts = await this.prisma.$queryRaw<Array<{
      cohort_month: string;
      customers_acquired: number;
      total_revenue: number;
      avg_order_value: number;
      repeat_customers: number;
    }>>`
      WITH customer_first_order AS (
        SELECT 
          "customerId",
          TO_CHAR(MIN("createdAt"), 'YYYY-MM') as cohort_month
        FROM orders
        WHERE "tenantId" = ${ctx.tenantId}
          AND "paymentStatus" = 'CAPTURED'
          AND "customerId" IS NOT NULL
        GROUP BY "customerId"
      ),
      cohort_stats AS (
        SELECT 
          cfo.cohort_month,
          COUNT(DISTINCT cfo."customerId") as customers_acquired,
          COALESCE(SUM(o."grandTotal")::float, 0) as total_revenue,
          COALESCE(AVG(o."grandTotal")::float, 0) as avg_order_value,
          COUNT(DISTINCT CASE WHEN order_count > 1 THEN cfo."customerId" END) as repeat_customers
        FROM customer_first_order cfo
        INNER JOIN orders o ON o."customerId" = cfo."customerId"
          AND o."paymentStatus" = 'CAPTURED'
        INNER JOIN (
          SELECT "customerId", COUNT(*) as order_count
          FROM orders
          WHERE "tenantId" = ${ctx.tenantId} AND "paymentStatus" = 'CAPTURED'
          GROUP BY "customerId"
        ) oc ON oc."customerId" = cfo."customerId"
        WHERE cfo.cohort_month >= TO_CHAR(${startDate}, 'YYYY-MM')
          AND cfo.cohort_month <= TO_CHAR(${endDate}, 'YYYY-MM')
        GROUP BY cfo.cohort_month
        ORDER BY cfo.cohort_month
        LIMIT ${cohortMonths}
      )
      SELECT * FROM cohort_stats
    `;

    return cohorts.map(c => ({
      cohortMonth: c.cohort_month,
      customersAcquired: Number(c.customers_acquired),
      totalRevenue: Number(c.total_revenue),
      averageOrderValue: Number(c.avg_order_value),
      repeatPurchaseRate: c.customers_acquired > 0 
        ? (Number(c.repeat_customers) / Number(c.customers_acquired)) * 100 
        : 0,
      retentionByMonth: {}, // Would need more complex query for monthly retention
    }));
  }

  /**
   * Get customer lifetime value analysis
   */
  async getCustomerLifetimeValue(
    ctx: TenantContext,
    limit = 20
  ): Promise<CustomerLifetimeValue> {
    // Get LTV statistics
    const ltvStats = await this.prisma.$queryRaw<Array<{
      customer_id: string;
      email: string;
      total_spent: number;
      order_count: number;
      first_order: Date;
      last_order: Date;
    }>>`
      SELECT 
        sc.id as customer_id,
        sc.email,
        COALESCE(SUM(o."grandTotal")::float, 0) as total_spent,
        COUNT(o.id)::int as order_count,
        MIN(o."createdAt") as first_order,
        MAX(o."createdAt") as last_order
      FROM store_customers sc
      INNER JOIN orders o ON o."customerId" = sc.id
      WHERE sc."tenantId" = ${ctx.tenantId}
        AND o."paymentStatus" = 'CAPTURED'
      GROUP BY sc.id, sc.email
      ORDER BY total_spent DESC
    `;

    if (ltvStats.length === 0) {
      return {
        averageLTV: 0,
        medianLTV: 0,
        topCustomers: [],
      };
    }

    const totalSpents = ltvStats.map(c => Number(c.total_spent));
    const avgLTV = totalSpents.reduce((a, b) => a + b, 0) / totalSpents.length;
    
    // Calculate median
    const sorted = [...totalSpents].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const medianLTV = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

    return {
      averageLTV: avgLTV,
      medianLTV: medianLTV,
      topCustomers: ltvStats.slice(0, limit).map(c => ({
        customerId: c.customer_id,
        email: c.email,
        totalSpent: Number(c.total_spent),
        orderCount: Number(c.order_count),
        firstOrderDate: c.first_order,
        lastOrderDate: c.last_order,
      })),
    };
  }

  /**
   * Get revenue by payment method
   */
  async getRevenueByPaymentMethod(
    ctx: TenantContext,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ method: string; revenue: number; count: number }>> {
    const results = await this.prisma.$queryRaw<Array<{
      payment_method: string;
      revenue: number;
      count: number;
    }>>`
      SELECT 
        COALESCE(o."paymentMethod", 'unknown') as payment_method,
        COALESCE(SUM(o."grandTotal")::float, 0) as revenue,
        COUNT(*)::int as count
      FROM orders o
      WHERE o."tenantId" = ${ctx.tenantId}
        AND o."paymentStatus" = 'CAPTURED'
        AND o."createdAt" >= ${startDate}
        AND o."createdAt" <= ${endDate}
      GROUP BY o."paymentMethod"
      ORDER BY revenue DESC
    `;

    return results.map(r => ({
      method: r.payment_method,
      revenue: Number(r.revenue),
      count: Number(r.count),
    }));
  }

  /**
   * Get comprehensive dashboard analytics
   */
  async getDashboardAnalytics(
    ctx: TenantContext,
    startDate: Date,
    endDate: Date
  ): Promise<DashboardAnalytics> {
    // Calculate previous period for comparison
    const periodLength = endDate.getTime() - startDate.getTime();
    const prevEndDate = new Date(startDate.getTime() - 1);
    const prevStartDate = new Date(prevEndDate.getTime() - periodLength);

    const [
      currentPeriod,
      previousPeriod,
      revenueByDay,
      topProducts,
      topCategories,
      recentOrders,
    ] = await Promise.all([
      // Current period stats
      this.prisma.$queryRaw<[{
        revenue: number;
        orders: number;
        customers: number;
      }]>`
        SELECT 
          COALESCE(SUM(o."grandTotal")::float, 0) as revenue,
          COUNT(DISTINCT o.id)::int as orders,
          COUNT(DISTINCT o."customerId")::int as customers
        FROM orders o
        WHERE o."tenantId" = ${ctx.tenantId}
          AND o."paymentStatus" = 'CAPTURED'
          AND o."createdAt" >= ${startDate}
          AND o."createdAt" <= ${endDate}
      `,
      // Previous period stats for comparison
      this.prisma.$queryRaw<[{
        revenue: number;
        orders: number;
      }]>`
        SELECT 
          COALESCE(SUM(o."grandTotal")::float, 0) as revenue,
          COUNT(DISTINCT o.id)::int as orders
        FROM orders o
        WHERE o."tenantId" = ${ctx.tenantId}
          AND o."paymentStatus" = 'CAPTURED'
          AND o."createdAt" >= ${prevStartDate}
          AND o."createdAt" <= ${prevEndDate}
      `,
      this.getSalesTrends(ctx, startDate, endDate, 'day'),
      this.getTopSellingProducts(ctx, startDate, endDate, 5),
      this.getCategoryPerformance(ctx, startDate, endDate),
      // Recent orders
      this.prisma.order.findMany({
        where: {
          tenantId: ctx.tenantId,
          createdAt: { gte: startDate, lte: endDate },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          orderNumber: true,
          email: true,
          grandTotal: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    const current = currentPeriod[0] || { revenue: 0, orders: 0, customers: 0 };
    const previous = previousPeriod[0] || { revenue: 0, orders: 0 };

    return {
      summary: {
        totalRevenue: Number(current.revenue),
        totalOrders: Number(current.orders),
        totalCustomers: Number(current.customers),
        averageOrderValue: current.orders > 0 
          ? Number(current.revenue) / Number(current.orders) 
          : 0,
        revenueGrowth: previous.revenue > 0 
          ? ((Number(current.revenue) - Number(previous.revenue)) / Number(previous.revenue)) * 100 
          : 0,
        orderGrowth: previous.orders > 0 
          ? ((Number(current.orders) - Number(previous.orders)) / Number(previous.orders)) * 100 
          : 0,
      },
      revenueByDay,
      topProducts,
      topCategories: topCategories.slice(0, 5),
      recentOrders: recentOrders.map(o => ({
        orderId: o.id,
        orderNumber: o.orderNumber,
        customerEmail: o.email,
        total: Number(o.grandTotal),
        status: o.status,
        createdAt: o.createdAt,
      })),
    };
  }
}
