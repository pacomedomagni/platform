import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@platform/db';

@Injectable()
export class ReorderAlertsService {
  constructor(private readonly prisma: PrismaService) {}

  async generateAlerts(tenantId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get all active stock items with reorder levels set
    const items = await this.prisma.item.findMany({
      where: {
        tenantId,
        isStockItem: true,
        isActive: true,
        reorderLevel: { not: null },
      },
      include: {
        warehouseItemBalances: {
          select: { actualQty: true, warehouseId: true },
        },
      },
    });

    // Get sales velocity for last 30 days (quantity sold per item)
    const salesData = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        tenantId,
        order: {
          createdAt: { gte: thirtyDaysAgo },
          status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] },
        },
        productId: { not: null },
      },
      _sum: { quantity: true },
    });

    // Map productId -> item via productListing
    const productListings = await this.prisma.productListing.findMany({
      where: { tenantId },
      select: { id: true, itemId: true },
    });

    const productToItemMap = new Map<string, string>();
    for (const pl of productListings) {
      productToItemMap.set(pl.id, pl.itemId);
    }

    const salesByItemId = new Map<string, number>();
    for (const sale of salesData) {
      if (sale.productId) {
        const itemId = productToItemMap.get(sale.productId);
        if (itemId) {
          salesByItemId.set(itemId, (salesByItemId.get(itemId) || 0) + (sale._sum.quantity ?? 0));
        }
      }
    }

    const alerts: Array<{
      itemId: string;
      itemName: string;
      currentStock: number;
      reorderLevel: number;
      suggestedQty: number;
      daysUntilStockout: number | null;
      dailySalesRate: number | null;
      severity: string;
    }> = [];

    for (const item of items) {
      const totalStock = item.warehouseItemBalances.reduce(
        (sum, b) => sum + Number(b.actualQty),
        0,
      );
      const reorderLevel = Number(item.reorderLevel);

      if (totalStock <= reorderLevel) {
        const totalSold = salesByItemId.get(item.id) || 0;
        const dailySalesRate = totalSold / 30;
        const daysUntilStockout =
          dailySalesRate > 0 ? Math.floor(totalStock / dailySalesRate) : null;

        // Suggested qty: enough for 30 days of sales, minimum the reorderQty
        const suggestedQty = item.reorderQty
          ? Math.max(Number(item.reorderQty), Math.ceil(dailySalesRate * 30))
          : Math.max(Math.ceil(dailySalesRate * 30), 1);

        // Determine severity
        let severity = 'warning';
        if (totalStock <= 0) {
          severity = 'critical';
        } else if (daysUntilStockout !== null && daysUntilStockout <= 3) {
          severity = 'critical';
        } else if (daysUntilStockout !== null && daysUntilStockout <= 7) {
          severity = 'warning';
        } else {
          severity = 'info';
        }

        alerts.push({
          itemId: item.id,
          itemName: item.name,
          currentStock: totalStock,
          reorderLevel,
          suggestedQty,
          daysUntilStockout,
          dailySalesRate: dailySalesRate > 0 ? Number(dailySalesRate.toFixed(4)) : null,
          severity,
        });
      }
    }

    // Upsert alerts (create new or update existing active ones)
    let created = 0;
    let updated = 0;

    for (const alert of alerts) {
      const existing = await this.prisma.reorderAlert.findFirst({
        where: {
          tenantId,
          itemId: alert.itemId,
          status: { in: ['active', 'acknowledged'] },
        },
      });

      if (existing) {
        await this.prisma.reorderAlert.update({
          where: { id: existing.id },
          data: {
            currentStock: alert.currentStock,
            reorderLevel: alert.reorderLevel,
            suggestedQty: alert.suggestedQty,
            daysUntilStockout: alert.daysUntilStockout,
            dailySalesRate: alert.dailySalesRate,
            severity: alert.severity,
          },
        });
        updated++;
      } else {
        await this.prisma.reorderAlert.create({
          data: {
            tenantId,
            itemId: alert.itemId,
            itemName: alert.itemName,
            currentStock: alert.currentStock,
            reorderLevel: alert.reorderLevel,
            suggestedQty: alert.suggestedQty,
            daysUntilStockout: alert.daysUntilStockout,
            dailySalesRate: alert.dailySalesRate,
            severity: alert.severity,
            status: 'active',
          },
        });
        created++;
      }
    }

    return { totalAlerts: alerts.length, created, updated };
  }

  async listAlerts(
    tenantId: string,
    query: { page?: number; limit?: number; status?: string; severity?: string },
  ) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId };
    if (query.status) {
      where.status = query.status;
    }
    if (query.severity) {
      where.severity = query.severity;
    }

    const [alerts, total] = await Promise.all([
      this.prisma.reorderAlert.findMany({
        where,
        orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.reorderAlert.count({ where }),
    ]);

    return {
      data: alerts.map((a) => ({
        ...a,
        currentStock: Number(a.currentStock),
        reorderLevel: Number(a.reorderLevel),
        suggestedQty: Number(a.suggestedQty),
        dailySalesRate: a.dailySalesRate ? Number(a.dailySalesRate) : null,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async acknowledgeAlert(tenantId: string, id: string, userId: string) {
    const alert = await this.prisma.reorderAlert.findFirst({
      where: { id, tenantId },
    });

    if (!alert) {
      throw new NotFoundException('Alert not found');
    }

    return this.prisma.reorderAlert.update({
      where: { id },
      data: {
        status: 'acknowledged',
        acknowledgedAt: new Date(),
        acknowledgedBy: userId,
      },
    });
  }

  async dismissAlert(tenantId: string, id: string) {
    const alert = await this.prisma.reorderAlert.findFirst({
      where: { id, tenantId },
    });

    if (!alert) {
      throw new NotFoundException('Alert not found');
    }

    return this.prisma.reorderAlert.update({
      where: { id },
      data: { status: 'dismissed' },
    });
  }

  async createPOFromAlert(tenantId: string, id: string) {
    const alert = await this.prisma.reorderAlert.findFirst({
      where: { id, tenantId },
    });

    if (!alert) {
      throw new NotFoundException('Alert not found');
    }

    // Get item details for the PO line item
    const item = await this.prisma.item.findUnique({
      where: { id: alert.itemId },
      include: { productListing: { select: { costPrice: true } } },
    });

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    // Generate PO number
    const poCount = await this.prisma.purchaseOrder.count({ where: { tenantId } });
    const poNumber = `PO-${String(poCount + 1).padStart(5, '0')}`;

    const unitPrice = item.productListing?.costPrice ? Number(item.productListing.costPrice) : 0;
    const quantity = Number(alert.suggestedQty);
    const totalPrice = Number((unitPrice * quantity).toFixed(2));

    const purchaseOrder = await this.prisma.purchaseOrder.create({
      data: {
        tenantId,
        poNumber,
        status: 'DRAFT',
        supplierName: 'TBD',
        orderDate: new Date(),
        subtotal: totalPrice,
        taxAmount: 0,
        shippingCost: 0,
        grandTotal: totalPrice,
        items: {
          create: {
            tenantId,
            itemId: item.id,
            description: item.name,
            quantity,
            unitPrice,
            taxRate: 0,
            taxAmount: 0,
            totalPrice,
          },
        },
      },
      include: { items: true },
    });

    // Mark alert as ordered
    await this.prisma.reorderAlert.update({
      where: { id },
      data: {
        status: 'ordered',
        purchaseOrderId: purchaseOrder.id,
      },
    });

    return purchaseOrder;
  }

  async getAlertStats(tenantId: string) {
    const [total, critical, warning, itemsNeedingReorder] = await Promise.all([
      this.prisma.reorderAlert.count({
        where: { tenantId, status: 'active' },
      }),
      this.prisma.reorderAlert.count({
        where: { tenantId, status: 'active', severity: 'critical' },
      }),
      this.prisma.reorderAlert.count({
        where: { tenantId, status: 'active', severity: 'warning' },
      }),
      this.prisma.reorderAlert.findMany({
        where: { tenantId, status: 'active' },
        select: { itemId: true },
        distinct: ['itemId'],
      }),
    ]);

    return {
      totalActive: total,
      criticalCount: critical,
      warningCount: warning,
      itemsNeedingReorder: itemsNeedingReorder.length,
    };
  }
}
