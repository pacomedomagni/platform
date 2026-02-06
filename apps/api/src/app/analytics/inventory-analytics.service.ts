import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import {
  InventoryTurnover,
  DeadStock,
  SalesForecast,
} from './analytics.dto';

interface TenantContext {
  tenantId: string;
}

@Injectable()
export class InventoryAnalyticsService {
  private readonly logger = new Logger(InventoryAnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get inventory turnover analysis
   */
  async getInventoryTurnover(
    ctx: TenantContext,
    startDate: Date,
    endDate: Date,
    limit = 50
  ): Promise<InventoryTurnover[]> {
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    const turnover = await this.prisma.$queryRaw<Array<{
      product_id: string;
      product_name: string;
      product_code: string;
      current_stock: number;
      units_sold: number;
      avg_daily_sales: number;
    }>>`
      WITH sales_data AS (
        SELECT 
          oi."productId",
          COALESCE(SUM(oi."quantity")::float, 0) as units_sold
        FROM order_items oi
        INNER JOIN orders o ON o.id = oi."orderId"
        WHERE o."tenantId" = ${ctx.tenantId}
          AND o."paymentStatus" = 'CAPTURED'
          AND o."createdAt" >= ${startDate}
          AND o."createdAt" <= ${endDate}
        GROUP BY oi."productId"
      )
      SELECT 
        i.id as product_id,
        i.name as product_name,
        i.code as product_code,
        COALESCE(i."qtyOnHand"::float, 0) as current_stock,
        COALESCE(sd.units_sold, 0) as units_sold,
        COALESCE(sd.units_sold / ${daysDiff}::float, 0) as avg_daily_sales
      FROM items i
      LEFT JOIN sales_data sd ON sd."productId" = i.id
      WHERE i."tenantId" = ${ctx.tenantId}
        AND i."isActive" = true
      ORDER BY COALESCE(sd.units_sold, 0) DESC
      LIMIT ${limit}
    `;

    return turnover.map(t => {
      const avgDailySales = Number(t.avg_daily_sales);
      const currentStock = Number(t.current_stock);
      const unitsSold = Number(t.units_sold);
      
      // Turnover rate = units sold / average inventory (simplified as current stock)
      const turnoverRate = currentStock > 0 ? unitsSold / currentStock : 0;
      // Days of supply = current stock / average daily sales
      const daysOfSupply = avgDailySales > 0 ? currentStock / avgDailySales : Infinity;

      return {
        productId: t.product_id,
        productName: t.product_name,
        productCode: t.product_code,
        currentStock,
        unitsSold,
        turnoverRate: Math.round(turnoverRate * 100) / 100,
        daysOfSupply: daysOfSupply === Infinity ? 999 : Math.round(daysOfSupply),
      };
    });
  }

  /**
   * Get dead stock (items not sold in X days)
   */
  async getDeadStock(
    ctx: TenantContext,
    deadStockDays = 90
  ): Promise<DeadStock[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - deadStockDays);

    const deadStock = await this.prisma.$queryRaw<Array<{
      product_id: string;
      product_name: string;
      product_code: string;
      current_stock: number;
      cost_price: number;
      last_sold_date: Date | null;
    }>>`
      WITH last_sale AS (
        SELECT 
          oi."productId",
          MAX(o."createdAt") as last_sold_date
        FROM order_items oi
        INNER JOIN orders o ON o.id = oi."orderId"
        WHERE o."tenantId" = ${ctx.tenantId}
          AND o."paymentStatus" = 'CAPTURED'
        GROUP BY oi."productId"
      )
      SELECT 
        i.id as product_id,
        i.name as product_name,
        i.code as product_code,
        COALESCE(i."qtyOnHand"::float, 0) as current_stock,
        COALESCE(i."costPrice"::float, 0) as cost_price,
        ls.last_sold_date
      FROM items i
      LEFT JOIN last_sale ls ON ls."productId" = i.id
      WHERE i."tenantId" = ${ctx.tenantId}
        AND i."isActive" = true
        AND i."qtyOnHand" > 0
        AND (ls.last_sold_date IS NULL OR ls.last_sold_date < ${cutoffDate})
      ORDER BY current_stock DESC
    `;

    const now = new Date();

    return deadStock.map(d => ({
      productId: d.product_id,
      productName: d.product_name,
      productCode: d.product_code,
      currentStock: Number(d.current_stock),
      stockValue: Number(d.current_stock) * Number(d.cost_price),
      lastSoldDate: d.last_sold_date,
      daysSinceLastSale: d.last_sold_date 
        ? Math.floor((now.getTime() - new Date(d.last_sold_date).getTime()) / (1000 * 60 * 60 * 24))
        : 999,
    }));
  }

  /**
   * Get low stock items
   */
  async getLowStockItems(
    ctx: TenantContext,
    threshold?: number
  ): Promise<Array<{
    productId: string;
    productName: string;
    productCode: string;
    currentStock: number;
    reorderLevel: number;
    reorderQuantity: number;
    daysOfSupply: number;
  }>> {
    const items = await this.prisma.$queryRaw<Array<{
      product_id: string;
      product_name: string;
      product_code: string;
      current_stock: number;
      reorder_level: number;
      reorder_quantity: number;
      avg_daily_sales: number;
    }>>`
      WITH recent_sales AS (
        SELECT 
          oi."productId",
          COALESCE(SUM(oi."quantity")::float / 30, 0) as avg_daily_sales
        FROM order_items oi
        INNER JOIN orders o ON o.id = oi."orderId"
        WHERE o."tenantId" = ${ctx.tenantId}
          AND o."paymentStatus" = 'CAPTURED'
          AND o."createdAt" >= NOW() - INTERVAL '30 days'
        GROUP BY oi."productId"
      )
      SELECT 
        i.id as product_id,
        i.name as product_name,
        i.code as product_code,
        COALESCE(i."qtyOnHand"::float, 0) as current_stock,
        COALESCE(i."reorderLevel"::float, ${threshold ?? 10}) as reorder_level,
        COALESCE(i."reorderQty"::float, 0) as reorder_quantity,
        COALESCE(rs.avg_daily_sales, 0) as avg_daily_sales
      FROM items i
      LEFT JOIN recent_sales rs ON rs."productId" = i.id
      WHERE i."tenantId" = ${ctx.tenantId}
        AND i."isActive" = true
        AND i."qtyOnHand" <= COALESCE(i."reorderLevel", ${threshold ?? 10})
      ORDER BY current_stock ASC
    `;

    return items.map(i => ({
      productId: i.product_id,
      productName: i.product_name,
      productCode: i.product_code,
      currentStock: Number(i.current_stock),
      reorderLevel: Number(i.reorder_level),
      reorderQuantity: Number(i.reorder_quantity),
      daysOfSupply: i.avg_daily_sales > 0 
        ? Math.round(Number(i.current_stock) / Number(i.avg_daily_sales))
        : 999,
    }));
  }

  /**
   * Get stock value summary
   */
  async getStockValueSummary(ctx: TenantContext): Promise<{
    totalItems: number;
    totalUnits: number;
    totalCostValue: number;
    totalRetailValue: number;
    valueByCategory: Array<{
      categoryId: string;
      categoryName: string;
      costValue: number;
      retailValue: number;
      itemCount: number;
    }>;
  }> {
    const [totals, byCategory] = await Promise.all([
      this.prisma.$queryRaw<[{
        total_items: number;
        total_units: number;
        total_cost: number;
        total_retail: number;
      }]>`
        SELECT 
          COUNT(DISTINCT i.id)::int as total_items,
          COALESCE(SUM(i."qtyOnHand")::float, 0) as total_units,
          COALESCE(SUM(i."qtyOnHand" * i."costPrice")::float, 0) as total_cost,
          COALESCE(SUM(i."qtyOnHand" * i."sellPrice")::float, 0) as total_retail
        FROM items i
        WHERE i."tenantId" = ${ctx.tenantId}
          AND i."isActive" = true
          AND i."qtyOnHand" > 0
      `,
      this.prisma.$queryRaw<Array<{
        category_id: string;
        category_name: string;
        cost_value: number;
        retail_value: number;
        item_count: number;
      }>>`
        SELECT 
          COALESCE(pc.id, 'uncategorized') as category_id,
          COALESCE(pc.name, 'Uncategorized') as category_name,
          COALESCE(SUM(i."qtyOnHand" * i."costPrice")::float, 0) as cost_value,
          COALESCE(SUM(i."qtyOnHand" * i."sellPrice")::float, 0) as retail_value,
          COUNT(DISTINCT i.id)::int as item_count
        FROM items i
        LEFT JOIN product_listings pl ON pl."itemId" = i.id
        LEFT JOIN product_categories pc ON pc.id = pl."categoryId"
        WHERE i."tenantId" = ${ctx.tenantId}
          AND i."isActive" = true
          AND i."qtyOnHand" > 0
        GROUP BY pc.id, pc.name
        ORDER BY cost_value DESC
      `,
    ]);

    const t = totals[0] || { total_items: 0, total_units: 0, total_cost: 0, total_retail: 0 };

    return {
      totalItems: Number(t.total_items),
      totalUnits: Number(t.total_units),
      totalCostValue: Number(t.total_cost),
      totalRetailValue: Number(t.total_retail),
      valueByCategory: byCategory.map(c => ({
        categoryId: c.category_id,
        categoryName: c.category_name,
        costValue: Number(c.cost_value),
        retailValue: Number(c.retail_value),
        itemCount: Number(c.item_count),
      })),
    };
  }

  /**
   * Simple sales forecast based on moving average
   */
  async getSalesForecast(
    ctx: TenantContext,
    productId?: string,
    forecastDays = 30
  ): Promise<SalesForecast[]> {
    // Get historical sales data (last 90 days)
    const historicalData = await this.prisma.$queryRaw<Array<{
      sale_date: Date;
      units_sold: number;
      revenue: number;
    }>>`
      SELECT 
        DATE(o."createdAt") as sale_date,
        COALESCE(SUM(oi."quantity")::float, 0) as units_sold,
        COALESCE(SUM(oi."lineTotal")::float, 0) as revenue
      FROM order_items oi
      INNER JOIN orders o ON o.id = oi."orderId"
      WHERE o."tenantId" = ${ctx.tenantId}
        AND o."paymentStatus" = 'CAPTURED'
        AND o."createdAt" >= NOW() - INTERVAL '90 days'
        ${productId ? this.prisma.$queryRaw`AND oi."productId" = ${productId}` : this.prisma.$queryRaw``}
      GROUP BY DATE(o."createdAt")
      ORDER BY sale_date
    `;

    if (historicalData.length < 7) {
      return []; // Not enough data for forecast
    }

    // Calculate 7-day moving average
    const recentSales = historicalData.slice(-30);
    const avgUnits = recentSales.reduce((sum, d) => sum + Number(d.units_sold), 0) / recentSales.length;
    const avgRevenue = recentSales.reduce((sum, d) => sum + Number(d.revenue), 0) / recentSales.length;

    // Generate forecast
    const forecasts: SalesForecast[] = [];
    const today = new Date();

    for (let i = 1; i <= forecastDays; i++) {
      const forecastDate = new Date(today);
      forecastDate.setDate(forecastDate.getDate() + i);

      // Add some variance based on day of week
      const dayOfWeek = forecastDate.getDay();
      const weekendFactor = dayOfWeek === 0 || dayOfWeek === 6 ? 0.8 : 1.1;

      forecasts.push({
        period: forecastDate.toISOString().split('T')[0],
        predictedRevenue: Math.round(avgRevenue * weekendFactor * 100) / 100,
        predictedUnits: Math.round(avgUnits * weekendFactor),
        confidence: Math.max(0.5, 0.9 - (i * 0.01)), // Confidence decreases over time
      });
    }

    return forecasts;
  }

  /**
   * Get inventory aging report
   */
  async getInventoryAging(ctx: TenantContext): Promise<Array<{
    ageRange: string;
    itemCount: number;
    totalUnits: number;
    totalValue: number;
  }>> {
    // This would require tracking inventory receipt dates
    // For now, return a simplified version based on last sale date
    const aging = await this.prisma.$queryRaw<Array<{
      age_range: string;
      item_count: number;
      total_units: number;
      total_value: number;
    }>>`
      WITH last_movement AS (
        SELECT 
          i.id,
          i."qtyOnHand",
          i."costPrice",
          COALESCE(
            (SELECT MAX(o."createdAt") FROM order_items oi 
             INNER JOIN orders o ON o.id = oi."orderId"
             WHERE oi."productId" = i.id AND o."paymentStatus" = 'CAPTURED'),
            i."createdAt"
          ) as last_activity
        FROM items i
        WHERE i."tenantId" = ${ctx.tenantId}
          AND i."isActive" = true
          AND i."qtyOnHand" > 0
      )
      SELECT 
        CASE 
          WHEN last_activity >= NOW() - INTERVAL '30 days' THEN '0-30 days'
          WHEN last_activity >= NOW() - INTERVAL '60 days' THEN '31-60 days'
          WHEN last_activity >= NOW() - INTERVAL '90 days' THEN '61-90 days'
          WHEN last_activity >= NOW() - INTERVAL '180 days' THEN '91-180 days'
          ELSE '180+ days'
        END as age_range,
        COUNT(*)::int as item_count,
        COALESCE(SUM("qtyOnHand")::float, 0) as total_units,
        COALESCE(SUM("qtyOnHand" * "costPrice")::float, 0) as total_value
      FROM last_movement
      GROUP BY age_range
      ORDER BY 
        CASE age_range
          WHEN '0-30 days' THEN 1
          WHEN '31-60 days' THEN 2
          WHEN '61-90 days' THEN 3
          WHEN '91-180 days' THEN 4
          ELSE 5
        END
    `;

    return aging.map(a => ({
      ageRange: a.age_range,
      itemCount: Number(a.item_count),
      totalUnits: Number(a.total_units),
      totalValue: Number(a.total_value),
    }));
  }
}
