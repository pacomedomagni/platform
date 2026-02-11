import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { Response } from 'express';

interface TenantContext {
  tenantId: string;
}

type ExportFormat = 'csv' | 'json';

@Injectable()
export class ReportExportService {
  private readonly logger = new Logger(ReportExportService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Export sales report
   */
  async exportSalesReport(
    ctx: TenantContext,
    startDate: Date,
    endDate: Date,
    format: ExportFormat,
    res: Response
  ): Promise<void> {
    const orders = await this.prisma.order.findMany({
      where: {
        tenantId: ctx.tenantId,
        paymentStatus: 'CAPTURED',
        createdAt: { gte: startDate, lte: endDate },
      },
      include: {
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = orders.map(o => ({
      orderNumber: o.orderNumber,
      date: o.createdAt.toISOString().split('T')[0],
      customerEmail: o.email,
      subtotal: Number(o.subtotal),
      tax: Number(o.taxTotal),
      shipping: Number(o.shippingTotal),
      discount: Number(o.discountTotal),
      total: Number(o.grandTotal),
      status: o.status,
      paymentStatus: o.paymentStatus,
      itemCount: o.items.length,
    }));

    if (format === 'csv') {
      this.sendCsv(res, data, `sales-report-${startDate.toISOString().split('T')[0]}-${endDate.toISOString().split('T')[0]}.csv`);
    } else {
      this.sendJson(res, data, `sales-report-${startDate.toISOString().split('T')[0]}-${endDate.toISOString().split('T')[0]}.json`);
    }
  }

  /**
   * Export order items report
   */
  async exportOrderItemsReport(
    ctx: TenantContext,
    startDate: Date,
    endDate: Date,
    format: ExportFormat,
    res: Response
  ): Promise<void> {
    const items = await this.prisma.$queryRaw<Array<{
      order_number: string;
      order_date: Date;
      customer_email: string;
      product_sku: string;
      product_name: string;
      quantity: number;
      unit_price: number;
      line_total: number;
    }>>`
      SELECT 
        o."orderNumber" as order_number,
        o."createdAt" as order_date,
        o.email as customer_email,
        COALESCE(oi.sku, '') as product_sku,
        oi.name as product_name,
        oi.quantity::int as quantity,
        oi."unitPrice"::float as unit_price,
        oi."totalPrice"::float as line_total
      FROM order_items oi
      INNER JOIN orders o ON o.id = oi."orderId"
      WHERE o."tenantId" = ${ctx.tenantId}
        AND o."paymentStatus" = 'CAPTURED'
        AND o."createdAt" >= ${startDate}
        AND o."createdAt" <= ${endDate}
      ORDER BY o."createdAt" DESC
    `;

    const data = items.map(i => ({
      orderNumber: i.order_number,
      date: new Date(i.order_date).toISOString().split('T')[0],
      customerEmail: i.customer_email,
      productSku: i.product_sku,
      productName: i.product_name,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unit_price),
      lineTotal: Number(i.line_total),
    }));

    if (format === 'csv') {
      this.sendCsv(res, data, `order-items-${startDate.toISOString().split('T')[0]}-${endDate.toISOString().split('T')[0]}.csv`);
    } else {
      this.sendJson(res, data, `order-items-${startDate.toISOString().split('T')[0]}-${endDate.toISOString().split('T')[0]}.json`);
    }
  }

  /**
   * Export inventory report
   */
  async exportInventoryReport(
    ctx: TenantContext,
    format: ExportFormat,
    res: Response
  ): Promise<void> {
    // Use raw query to get inventory data with warehouse balances and product listings
    const items = await this.prisma.$queryRaw<Array<{
      code: string;
      name: string;
      qty_on_hand: number;
      cost_price: number;
      sell_price: number;
      reorder_level: number;
      reorder_qty: number;
    }>>`
      SELECT 
        i.code,
        i.name,
        COALESCE(SUM(wb."actualQty")::float, 0) as qty_on_hand,
        COALESCE(pl."costPrice"::float, 0) as cost_price,
        COALESCE(pl.price::float, 0) as sell_price,
        COALESCE(i."reorderLevel"::float, 0) as reorder_level,
        COALESCE(i."reorderQty"::float, 0) as reorder_qty
      FROM items i
      LEFT JOIN warehouse_item_balances wb ON wb."itemId" = i.id
      LEFT JOIN product_listings pl ON pl."itemId" = i.id
      WHERE i."tenantId" = ${ctx.tenantId}
        AND i."isActive" = true
      GROUP BY i.id, i.code, i.name, i."reorderLevel", i."reorderQty", pl."costPrice", pl.price
      ORDER BY i.code ASC
    `;

    const data = items.map(i => ({
      code: i.code,
      name: i.name,
      qtyOnHand: Number(i.qty_on_hand),
      costPrice: Number(i.cost_price),
      sellPrice: Number(i.sell_price),
      reorderLevel: Number(i.reorder_level),
      reorderQty: Number(i.reorder_qty),
      stockValue: Number(i.qty_on_hand) * Number(i.cost_price),
      retailValue: Number(i.qty_on_hand) * Number(i.sell_price),
    }));

    if (format === 'csv') {
      this.sendCsv(res, data, `inventory-report-${new Date().toISOString().split('T')[0]}.csv`);
    } else {
      this.sendJson(res, data, `inventory-report-${new Date().toISOString().split('T')[0]}.json`);
    }
  }

  /**
   * Export customers report
   */
  async exportCustomersReport(
    ctx: TenantContext,
    format: ExportFormat,
    res: Response
  ): Promise<void> {
    const customers = await this.prisma.$queryRaw<Array<{
      id: string;
      email: string;
      first_name: string;
      last_name: string;
      phone: string;
      created_at: Date;
      order_count: number;
      total_spent: number;
      last_order_date: Date | null;
    }>>`
      SELECT 
        sc.id,
        sc.email,
        sc."firstName" as first_name,
        sc."lastName" as last_name,
        COALESCE(sc.phone, '') as phone,
        sc."createdAt" as created_at,
        COUNT(o.id)::int as order_count,
        COALESCE(SUM(o."grandTotal")::float, 0) as total_spent,
        MAX(o."createdAt") as last_order_date
      FROM store_customers sc
      LEFT JOIN orders o ON o."customerId" = sc.id AND o."paymentStatus" = 'CAPTURED'
      WHERE sc."tenantId" = ${ctx.tenantId}
      GROUP BY sc.id, sc.email, sc."firstName", sc."lastName", sc.phone, sc."createdAt"
      ORDER BY total_spent DESC
    `;

    const data = customers.map(c => ({
      id: c.id,
      email: c.email,
      firstName: c.first_name || '',
      lastName: c.last_name || '',
      phone: c.phone,
      createdAt: new Date(c.created_at).toISOString().split('T')[0],
      orderCount: Number(c.order_count),
      totalSpent: Number(c.total_spent),
      lastOrderDate: c.last_order_date 
        ? new Date(c.last_order_date).toISOString().split('T')[0] 
        : '',
    }));

    if (format === 'csv') {
      this.sendCsv(res, data, `customers-report-${new Date().toISOString().split('T')[0]}.csv`);
    } else {
      this.sendJson(res, data, `customers-report-${new Date().toISOString().split('T')[0]}.json`);
    }
  }

  /**
   * Export products performance report
   */
  async exportProductsPerformanceReport(
    ctx: TenantContext,
    startDate: Date,
    endDate: Date,
    format: ExportFormat,
    res: Response
  ): Promise<void> {
    const products = await this.prisma.$queryRaw<Array<{
      product_code: string;
      product_name: string;
      qty_sold: number;
      revenue: number;
      order_count: number;
      avg_price: number;
      current_stock: number;
    }>>`
      SELECT 
        i.code as product_code,
        i.name as product_name,
        COALESCE(SUM(oi.quantity)::int, 0) as qty_sold,
        COALESCE(SUM(oi."totalPrice")::float, 0) as revenue,
        COUNT(DISTINCT oi."orderId")::int as order_count,
        CASE WHEN SUM(oi.quantity) > 0 
          THEN (SUM(oi."totalPrice") / SUM(oi.quantity))::float 
          ELSE 0 
        END as avg_price,
        COALESCE(SUM(wb."actualQty")::float, 0) as current_stock
      FROM items i
      LEFT JOIN product_listings pl ON pl."itemId" = i.id
      LEFT JOIN order_items oi ON oi."productId" = pl.id
      LEFT JOIN orders o ON o.id = oi."orderId" 
        AND o."paymentStatus" = 'CAPTURED'
        AND o."createdAt" >= ${startDate}
        AND o."createdAt" <= ${endDate}
      LEFT JOIN warehouse_item_balances wb ON wb."itemId" = i.id
      WHERE i."tenantId" = ${ctx.tenantId}
        AND i."isActive" = true
      GROUP BY i.id, i.code, i.name
      ORDER BY revenue DESC
    `;

    const data = products.map(p => ({
      productCode: p.product_code,
      productName: p.product_name,
      qtySold: Number(p.qty_sold),
      revenue: Number(p.revenue),
      orderCount: Number(p.order_count),
      avgPrice: Math.round(Number(p.avg_price) * 100) / 100,
      currentStock: Number(p.current_stock),
    }));

    if (format === 'csv') {
      this.sendCsv(res, data, `products-performance-${startDate.toISOString().split('T')[0]}-${endDate.toISOString().split('T')[0]}.csv`);
    } else {
      this.sendJson(res, data, `products-performance-${startDate.toISOString().split('T')[0]}-${endDate.toISOString().split('T')[0]}.json`);
    }
  }

  /**
   * Export gift cards report
   */
  async exportGiftCardsReport(
    ctx: TenantContext,
    format: ExportFormat,
    res: Response
  ): Promise<void> {
    const giftCards = await this.prisma.giftCard.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { createdAt: 'desc' },
    });

    const data = giftCards.map(gc => ({
      code: gc.code,
      initialValue: Number(gc.initialValue),
      currentBalance: Number(gc.currentBalance),
      currency: gc.currency,
      status: gc.status,
      recipientEmail: gc.recipientEmail || '',
      senderName: gc.senderName || '',
      createdAt: gc.createdAt.toISOString().split('T')[0],
      expiresAt: gc.expiresAt ? gc.expiresAt.toISOString().split('T')[0] : '',
    }));

    if (format === 'csv') {
      this.sendCsv(res, data, `gift-cards-${new Date().toISOString().split('T')[0]}.csv`);
    } else {
      this.sendJson(res, data, `gift-cards-${new Date().toISOString().split('T')[0]}.json`);
    }
  }

  // ==========================================
  // Helper Methods
  // ==========================================

  private sendCsv(res: Response, data: Record<string, unknown>[], filename: string): void {
    if (data.length === 0) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send('');
      return;
    }

    const headers = Object.keys(data[0]);
    const csvRows: string[] = [];

    // Header row
    csvRows.push(headers.map(h => `"${h}"`).join(','));

    // Data rows
    for (const row of data) {
      const values = headers.map(h => {
        const val = row[h];
        if (val === null || val === undefined) return '""';
        if (typeof val === 'string') {
          // Prevent CSV formula injection by prefixing dangerous characters
          let safe = val.replace(/"/g, '""');
          if (/^[=+\-@\t\r]/.test(safe)) {
            safe = `'${safe}`;
          }
          return `"${safe}"`;
        }
        return `"${val}"`;
      });
      csvRows.push(values.join(','));
    }

    res.setHeader('Content-Type', 'text/csv');
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.send(csvRows.join('\n'));
  }

  private sendJson(res: Response, data: unknown, filename: string): void {
    res.setHeader('Content-Type', 'application/json');
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.send(JSON.stringify(data, null, 2));
  }
}
