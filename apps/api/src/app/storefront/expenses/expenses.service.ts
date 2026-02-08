import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { Prisma } from '@prisma/client';

@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listExpenses(tenantId: string, query: { categoryId?: string; isApproved?: string; search?: string; startDate?: string; endDate?: string; limit?: number; offset?: number }) {
    const { categoryId, isApproved, search, startDate, endDate, limit = 20, offset = 0 } = query;
    const where: Prisma.ExpenseWhereInput = { tenantId };
    if (categoryId) where.categoryId = categoryId;
    if (isApproved !== undefined) where.isApproved = isApproved === 'true';
    if (search) {
      where.OR = [
        { expenseNumber: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { supplierName: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (startDate || endDate) {
      where.expenseDate = {};
      if (startDate) where.expenseDate.gte = new Date(startDate);
      if (endDate) where.expenseDate.lte = new Date(endDate);
    }

    const [expenses, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: { category: true },
      }),
      this.prisma.expense.count({ where }),
    ]);

    return {
      data: expenses.map((exp) => ({
        ...exp,
        amount: Number(exp.amount),
        exchangeRate: Number(exp.exchangeRate),
      })),
      pagination: { total, limit, offset, hasMore: offset + expenses.length < total },
    };
  }

  async getExpense(tenantId: string, id: string) {
    const expense = await this.prisma.expense.findFirst({
      where: { id, tenantId },
      include: { category: true },
    });
    if (!expense) throw new NotFoundException('Expense not found');
    return {
      ...expense,
      amount: Number(expense.amount),
      exchangeRate: Number(expense.exchangeRate),
    };
  }

  async createExpense(tenantId: string, data: any) {
    const expense = await this.prisma.$transaction(async (tx) => {
      const lastExpense = await tx.expense.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        select: { expenseNumber: true },
      });
      let nextNum = 1;
      if (lastExpense?.expenseNumber) {
        const match = lastExpense.expenseNumber.match(/EXP-(\d+)/);
        if (match) nextNum = parseInt(match[1], 10) + 1;
      }
      const expenseNumber = `EXP-${String(nextNum).padStart(5, '0')}`;

      return tx.expense.create({
        data: {
          tenantId,
          expenseNumber,
          categoryId: data.categoryId,
          description: data.description,
          amount: Number(data.amount),
          currency: data.currency || 'USD',
          exchangeRate: Number(data.exchangeRate || 1),
          expenseDate: new Date(data.expenseDate || Date.now()),
          paymentMethod: data.paymentMethod || 'cash',
          supplierId: data.supplierId,
          supplierName: data.supplierName,
          receiptUrl: data.receiptUrl,
          notes: data.notes,
          isRecurring: data.isRecurring || false,
          recurringSchedule: data.recurringSchedule,
        },
        include: { category: true },
      });
    });

    this.logger.log(`Expense ${expense.expenseNumber} created for tenant ${tenantId}`);
    return expense;
  }

  async updateExpense(tenantId: string, id: string, data: any) {
    const existing = await this.prisma.expense.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Expense not found');
    if (existing.isApproved) throw new BadRequestException('Approved expenses cannot be edited');

    const expense = await this.prisma.expense.update({
      where: { id },
      data: {
        categoryId: data.categoryId ?? existing.categoryId,
        description: data.description ?? existing.description,
        amount: data.amount !== undefined ? Number(data.amount) : existing.amount,
        currency: data.currency ?? existing.currency,
        exchangeRate: data.exchangeRate !== undefined ? Number(data.exchangeRate) : existing.exchangeRate,
        expenseDate: data.expenseDate ? new Date(data.expenseDate) : existing.expenseDate,
        paymentMethod: data.paymentMethod ?? existing.paymentMethod,
        supplierId: data.supplierId ?? existing.supplierId,
        supplierName: data.supplierName ?? existing.supplierName,
        receiptUrl: data.receiptUrl ?? existing.receiptUrl,
        notes: data.notes ?? existing.notes,
        isRecurring: data.isRecurring ?? existing.isRecurring,
        recurringSchedule: data.recurringSchedule ?? existing.recurringSchedule,
      },
      include: { category: true },
    });

    return expense;
  }

  async approveExpense(tenantId: string, id: string, approvedBy: string) {
    const expense = await this.prisma.expense.findFirst({ where: { id, tenantId } });
    if (!expense) throw new NotFoundException('Expense not found');
    if (expense.isApproved) throw new BadRequestException('Expense is already approved');

    return this.prisma.expense.update({
      where: { id },
      data: {
        isApproved: true,
        approvedBy,
        approvedAt: new Date(),
      },
      include: { category: true },
    });
  }

  async deleteExpense(tenantId: string, id: string) {
    const expense = await this.prisma.expense.findFirst({ where: { id, tenantId } });
    if (!expense) throw new NotFoundException('Expense not found');
    if (expense.isApproved) throw new BadRequestException('Approved expenses cannot be deleted');
    await this.prisma.expense.delete({ where: { id } });
    return { success: true };
  }

  async listCategories(tenantId: string) {
    const categories = await this.prisma.expenseCategory.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { expenses: true } } },
    });

    return {
      data: categories.map((cat) => ({
        ...cat,
        expenseCount: cat._count.expenses,
      })),
    };
  }

  async createCategory(tenantId: string, data: any) {
    const existing = await this.prisma.expenseCategory.findUnique({
      where: { tenantId_name: { tenantId, name: data.name } },
    });
    if (existing) throw new BadRequestException('Category with this name already exists');

    const category = await this.prisma.expenseCategory.create({
      data: {
        tenantId,
        name: data.name,
        glAccount: data.glAccount,
        isActive: data.isActive ?? true,
      },
    });

    this.logger.log(`Expense category "${data.name}" created for tenant ${tenantId}`);
    return category;
  }

  async getExpenseStats(tenantId: string) {
    const [total, approved, unapproved, totalAmount, byCategory, monthlyTrend] = await Promise.all([
      this.prisma.expense.count({ where: { tenantId } }),
      this.prisma.expense.count({ where: { tenantId, isApproved: true } }),
      this.prisma.expense.count({ where: { tenantId, isApproved: false } }),
      this.prisma.expense.aggregate({ where: { tenantId }, _sum: { amount: true } }),
      this.prisma.expense.groupBy({
        by: ['categoryId'],
        where: { tenantId },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.$queryRaw<Array<{ month: string; total: number }>>`
        SELECT
          TO_CHAR(e."expenseDate", 'YYYY-MM') as month,
          COALESCE(SUM(e."amount"), 0)::float as total
        FROM expenses e
        WHERE e."tenantId" = ${tenantId}
          AND e."expenseDate" >= NOW() - INTERVAL '12 months'
        GROUP BY TO_CHAR(e."expenseDate", 'YYYY-MM')
        ORDER BY month DESC
      `,
    ]);

    // Resolve category names for byCategory stats
    const categoryIds = byCategory.map((c) => c.categoryId).filter(Boolean) as string[];
    const categories = categoryIds.length > 0
      ? await this.prisma.expenseCategory.findMany({ where: { id: { in: categoryIds } } })
      : [];
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    return {
      total,
      approved,
      unapproved,
      totalAmount: Number(totalAmount._sum.amount || 0),
      byCategory: byCategory.map((c) => ({
        categoryId: c.categoryId,
        categoryName: c.categoryId ? categoryMap.get(c.categoryId) || 'Unknown' : 'Uncategorized',
        total: Number(c._sum.amount || 0),
        count: c._count,
      })),
      monthlyTrend,
    };
  }
}
