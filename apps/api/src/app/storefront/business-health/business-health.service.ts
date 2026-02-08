import { Injectable } from '@nestjs/common';
import { PrismaService } from '@platform/db';

@Injectable()
export class BusinessHealthService {
  constructor(private readonly prisma: PrismaService) {}

  async getBusinessHealth(tenantId: string) {
    const [revenue, orders, cashFlow, inventory, expenses, customers, topProducts, recentOrders] =
      await Promise.all([
        this.getRevenue(tenantId),
        this.getOrders(tenantId),
        this.getCashFlow(tenantId),
        this.getInventory(tenantId),
        this.getExpenses(tenantId),
        this.getCustomers(tenantId),
        this.getTopProducts(tenantId),
        this.getRecentOrders(tenantId),
      ]);

    return {
      revenue,
      orders,
      cashFlow,
      inventory,
      expenses,
      customers,
      topProducts,
      recentOrders,
    };
  }

  async getRevenue(tenantId: string) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const paidStatuses = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] as const;

    const [todayAgg, weekAgg, monthAgg, lastMonthAgg] = await Promise.all([
      this.prisma.order.aggregate({
        where: {
          tenantId,
          createdAt: { gte: startOfToday },
          status: { in: [...paidStatuses] },
        },
        _sum: { grandTotal: true },
      }),
      this.prisma.order.aggregate({
        where: {
          tenantId,
          createdAt: { gte: startOfWeek },
          status: { in: [...paidStatuses] },
        },
        _sum: { grandTotal: true },
      }),
      this.prisma.order.aggregate({
        where: {
          tenantId,
          createdAt: { gte: startOfMonth },
          status: { in: [...paidStatuses] },
        },
        _sum: { grandTotal: true },
      }),
      this.prisma.order.aggregate({
        where: {
          tenantId,
          createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
          status: { in: [...paidStatuses] },
        },
        _sum: { grandTotal: true },
      }),
    ]);

    const today = Number(todayAgg._sum.grandTotal ?? 0);
    const thisWeek = Number(weekAgg._sum.grandTotal ?? 0);
    const thisMonth = Number(monthAgg._sum.grandTotal ?? 0);
    const lastMonth = Number(lastMonthAgg._sum.grandTotal ?? 0);
    const growthPercent = lastMonth > 0 ? Number((((thisMonth - lastMonth) / lastMonth) * 100).toFixed(2)) : 0;

    return { today, thisWeek, thisMonth, lastMonth, growthPercent };
  }

  async getOrders(tenantId: string) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);

    const [pendingCount, toShipCount, todayCount, thisWeekCount] = await Promise.all([
      this.prisma.order.count({
        where: { tenantId, status: 'PENDING' },
      }),
      this.prisma.order.count({
        where: { tenantId, status: { in: ['CONFIRMED', 'PROCESSING'] } },
      }),
      this.prisma.order.count({
        where: { tenantId, createdAt: { gte: startOfToday } },
      }),
      this.prisma.order.count({
        where: { tenantId, createdAt: { gte: startOfWeek } },
      }),
    ]);

    return { pendingCount, toShipCount, todayCount, thisWeekCount };
  }

  async getCashFlow(tenantId: string) {
    const [totalInvoicedAgg, totalPaidAgg, totalOutstandingAgg, totalOverdueAgg] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { tenantId, status: { not: 'CANCELLED' } },
        _sum: { grandTotal: true },
      }),
      this.prisma.invoice.aggregate({
        where: { tenantId, status: 'PAID' },
        _sum: { grandTotal: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          tenantId,
          status: { in: ['SENT', 'VIEWED', 'PARTIALLY_PAID', 'OVERDUE'] },
        },
        _sum: { amountDue: true },
      }),
      this.prisma.invoice.aggregate({
        where: { tenantId, status: 'OVERDUE' },
        _sum: { amountDue: true },
      }),
    ]);

    return {
      totalInvoiced: Number(totalInvoicedAgg._sum.grandTotal ?? 0),
      totalPaid: Number(totalPaidAgg._sum.grandTotal ?? 0),
      totalOutstanding: Number(totalOutstandingAgg._sum.amountDue ?? 0),
      totalOverdue: Number(totalOverdueAgg._sum.amountDue ?? 0),
    };
  }

  async getInventory(tenantId: string) {
    const [balances, items] = await Promise.all([
      this.prisma.warehouseItemBalance.findMany({
        where: { tenantId },
        include: { item: { include: { productListing: { select: { costPrice: true } } } } },
      }),
      this.prisma.item.findMany({
        where: { tenantId, isStockItem: true, isActive: true },
        include: {
          warehouseItemBalances: { select: { actualQty: true } },
        },
      }),
    ]);

    // Calculate total inventory value from balance * costPrice
    let totalValue = 0;
    for (const balance of balances) {
      const costPrice = balance.item.productListing?.costPrice
        ? Number(balance.item.productListing.costPrice)
        : 0;
      totalValue += Number(balance.actualQty) * costPrice;
    }

    let lowStockCount = 0;
    let outOfStockCount = 0;
    let reorderAlertCount = 0;

    for (const item of items) {
      const totalQty = item.warehouseItemBalances.reduce(
        (sum, b) => sum + Number(b.actualQty),
        0,
      );

      if (totalQty <= 0) {
        outOfStockCount++;
      } else if (item.reorderLevel && totalQty <= Number(item.reorderLevel)) {
        lowStockCount++;
      }

      if (item.reorderLevel && totalQty <= Number(item.reorderLevel)) {
        reorderAlertCount++;
      }
    }

    return {
      totalValue: Number(totalValue.toFixed(2)),
      lowStockCount,
      outOfStockCount,
      reorderAlertCount,
    };
  }

  async getExpenses(tenantId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const [thisMonthAgg, lastMonthAgg, categoryExpenses] = await Promise.all([
      this.prisma.expense.aggregate({
        where: { tenantId, expenseDate: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
      this.prisma.expense.aggregate({
        where: {
          tenantId,
          expenseDate: { gte: startOfLastMonth, lte: endOfLastMonth },
        },
        _sum: { amount: true },
      }),
      this.prisma.expense.groupBy({
        by: ['categoryId'],
        where: { tenantId, expenseDate: { gte: startOfMonth } },
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'desc' } },
        take: 5,
      }),
    ]);

    // Resolve category names for top categories
    const categoryIds = categoryExpenses
      .map((c) => c.categoryId)
      .filter((id): id is string => id !== null);

    const categories =
      categoryIds.length > 0
        ? await this.prisma.expenseCategory.findMany({
            where: { id: { in: categoryIds } },
            select: { id: true, name: true },
          })
        : [];

    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    const topCategories = categoryExpenses.map((c) => ({
      name: c.categoryId ? categoryMap.get(c.categoryId) || 'Uncategorized' : 'Uncategorized',
      amount: Number(c._sum.amount ?? 0),
    }));

    return {
      thisMonth: Number(thisMonthAgg._sum.amount ?? 0),
      lastMonth: Number(lastMonthAgg._sum.amount ?? 0),
      topCategories,
    };
  }

  async getCustomers(tenantId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [total, newThisMonth, repeatCustomers] = await Promise.all([
      this.prisma.storeCustomer.count({
        where: { tenantId, isActive: true },
      }),
      this.prisma.storeCustomer.count({
        where: { tenantId, createdAt: { gte: startOfMonth } },
      }),
      // Customers with more than 1 order
      this.prisma.order.groupBy({
        by: ['customerId'],
        where: { tenantId, customerId: { not: null } },
        having: {
          customerId: { _count: { gt: 1 } },
        },
      }),
    ]);

    const repeatRate = total > 0 ? Number(((repeatCustomers.length / total) * 100).toFixed(2)) : 0;

    return { total, newThisMonth, repeatRate };
  }

  async getTopProducts(tenantId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const topItems = await this.prisma.orderItem.groupBy({
      by: ['name'],
      where: {
        tenantId,
        order: {
          createdAt: { gte: startOfMonth },
          status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] },
        },
      },
      _sum: { quantity: true, totalPrice: true },
      orderBy: { _sum: { totalPrice: 'desc' } },
      take: 10,
    });

    return topItems.map((item) => ({
      name: item.name,
      quantity: item._sum.quantity ?? 0,
      revenue: Number(item._sum.totalPrice ?? 0),
    }));
  }

  async getRecentOrders(tenantId: string) {
    const orders = await this.prisma.order.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        orderNumber: true,
        email: true,
        customer: { select: { firstName: true, lastName: true } },
        grandTotal: true,
        status: true,
        createdAt: true,
      },
    });

    return orders.map((o) => ({
      orderNumber: o.orderNumber,
      customer:
        o.customer?.firstName || o.customer?.lastName
          ? `${o.customer.firstName ?? ''} ${o.customer.lastName ?? ''}`.trim()
          : o.email,
      total: Number(o.grandTotal),
      status: o.status,
      createdAt: o.createdAt,
    }));
  }
}
