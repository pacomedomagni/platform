import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { InvoiceStatus } from '@prisma/client';

interface JournalEntryLine {
  accountCode: string;
  debit?: number;
  credit?: number;
  remarks?: string;
}

interface PostInvoiceResult {
  success: boolean;
  invoiceId: string;
  invoiceNumber: string;
  entriesCreated: number;
  totalDebit: number;
  totalCredit: number;
}

@Injectable()
export class GlPostingService {
  private readonly logger = new Logger(GlPostingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Post invoice to general ledger
   * Creates GL entries for revenue and receivable
   */
  async postInvoice(tenantId: string, invoiceId: string): Promise<PostInvoiceResult> {
    return this.prisma.$transaction(async (tx) => {
      // Get invoice
      const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId, tenantId },
        include: { items: true },
      });

      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      if (invoice.glPosted) {
        throw new BadRequestException('Invoice already posted to GL');
      }

      if (invoice.status !== InvoiceStatus.PAID) {
        throw new BadRequestException('Only PAID invoices can be posted to GL');
      }

      // Get default accounts
      const revenueAccount = await this.getOrCreateAccount(
        tx,
        tenantId,
        'REVENUE',
        'Sales Revenue',
        'Revenue',
      );
      // LOGIC-2: For PAID invoices, debit Cash (money received), not Receivable
      const cashAccount = await this.getOrCreateAccount(
        tx,
        tenantId,
        'CASH',
        'Cash',
        'Asset',
      );

      const totalAmount = Number(invoice.grandTotal);
      const postingDate = invoice.paidDate || new Date();

      // SCHEMA-2: Use invoice currency and compute exchange rate against tenant base currency
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { baseCurrency: true },
      });
      const invoiceCurrency = invoice.currency || tenant?.baseCurrency || 'USD';
      const exchangeRate = invoiceCurrency === (tenant?.baseCurrency || 'USD')
        ? 1.0
        : Number((invoice as any).exchangeRate || 1.0);
      const amountBc = totalAmount * exchangeRate;

      // Create GL entries (double entry bookkeeping)
      // Debit: Cash (money received for PAID invoice)
      // Credit: Revenue (Revenue increases)
      const entries = await Promise.all([
        // Debit Cash
        tx.glEntry.create({
          data: {
            tenantId,
            postingDate,
            postingTs: new Date(),
            accountId: cashAccount.id,
            currency: invoiceCurrency,
            exchangeRate,
            debitBc: amountBc,
            creditBc: 0,
            debitFc: totalAmount,
            creditFc: 0,
            voucherType: 'INVOICE',
            voucherNo: invoice.invoiceNumber,
            remarks: `Invoice ${invoice.invoiceNumber} - ${invoice.partyName}`,
          },
        }),
        // Credit Revenue
        tx.glEntry.create({
          data: {
            tenantId,
            postingDate,
            postingTs: new Date(),
            accountId: revenueAccount.id,
            currency: invoiceCurrency,
            exchangeRate,
            debitBc: 0,
            creditBc: amountBc,
            debitFc: 0,
            creditFc: totalAmount,
            voucherType: 'INVOICE',
            voucherNo: invoice.invoiceNumber,
            remarks: `Invoice ${invoice.invoiceNumber} - ${invoice.partyName}`,
          },
        }),
      ]);

      // Mark invoice as posted
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          glPosted: true,
          glPostedAt: new Date(),
        },
      });

      this.logger.log(
        `Posted invoice ${invoice.invoiceNumber} to GL: ${entries.length} entries created`,
      );

      return {
        success: true,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        entriesCreated: entries.length,
        totalDebit: totalAmount,
        totalCredit: totalAmount,
      };
    });
  }

  /**
   * Post expense to general ledger
   */
  async postExpense(tenantId: string, expenseId: string) {
    return this.prisma.$transaction(async (tx) => {
      const expense = await tx.expense.findFirst({
        where: { id: expenseId, tenantId },
      });

      if (!expense) {
        throw new NotFoundException('Expense not found');
      }

      if (expense.glPosted) {
        throw new BadRequestException('Expense already posted to GL');
      }

      // LOGIC-3: Cannot post unapproved expenses
      if (!expense.isApproved) {
        throw new BadRequestException('Cannot post unapproved expense to GL');
      }

      // Get accounts
      const expenseAccount = await this.getOrCreateAccount(
        tx,
        tenantId,
        'EXPENSE',
        'Operating Expenses',
        'Expense',
      );
      const cashAccount = await this.getOrCreateAccount(
        tx,
        tenantId,
        'CASH',
        'Cash',
        'Asset',
      );

      const totalAmount = Number(expense.amount);
      const postingDate = expense.expenseDate;

      // SCHEMA-2: Use expense currency and compute exchange rate
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { baseCurrency: true },
      });
      const expenseCurrency = expense.currency || tenant?.baseCurrency || 'USD';
      const expExchangeRate = expenseCurrency === (tenant?.baseCurrency || 'USD')
        ? 1.0
        : Number((expense as any).exchangeRate || 1.0);
      const expAmountBc = totalAmount * expExchangeRate;

      // Debit: Expense (Expense increases)
      // Credit: Cash (Asset decreases)
      const entries = await Promise.all([
        // Debit Expense
        tx.glEntry.create({
          data: {
            tenantId,
            postingDate,
            postingTs: new Date(),
            accountId: expenseAccount.id,
            currency: expenseCurrency,
            exchangeRate: expExchangeRate,
            debitBc: expAmountBc,
            creditBc: 0,
            debitFc: totalAmount,
            creditFc: 0,
            voucherType: 'EXPENSE',
            voucherNo: expense.expenseNumber,
            remarks: `Expense ${expense.expenseNumber} - ${expense.description}`,
          },
        }),
        // Credit Cash
        tx.glEntry.create({
          data: {
            tenantId,
            postingDate,
            postingTs: new Date(),
            accountId: cashAccount.id,
            currency: expenseCurrency,
            exchangeRate: expExchangeRate,
            debitBc: 0,
            creditBc: expAmountBc,
            debitFc: 0,
            creditFc: totalAmount,
            voucherType: 'EXPENSE',
            voucherNo: expense.expenseNumber,
            remarks: `Expense ${expense.expenseNumber} - ${expense.description}`,
          },
        }),
      ]);

      // Mark expense as posted
      await tx.expense.update({
        where: { id: expenseId },
        data: {
          glPosted: true,
          glPostedAt: new Date(),
        },
      });

      this.logger.log(`Posted expense ${expense.expenseNumber} to GL: ${entries.length} entries`);

      return {
        success: true,
        expenseId: expense.id,
        expenseNumber: expense.expenseNumber,
        entriesCreated: entries.length,
        totalDebit: totalAmount,
        totalCredit: totalAmount,
      };
    });
  }

  /**
   * Create manual journal entry
   */
  async createJournalEntry(
    tenantId: string,
    data: {
      postingDate: string;
      voucherType: string;
      voucherNo: string;
      lines: JournalEntryLine[];
      remarks?: string;
      currency?: string;
      exchangeRate?: number;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Validate balanced entry
      let totalDebit = 0;
      let totalCredit = 0;

      for (const line of data.lines) {
        totalDebit += line.debit || 0;
        totalCredit += line.credit || 0;
      }

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new BadRequestException(
          `Journal entry is not balanced. Debit: ${totalDebit}, Credit: ${totalCredit}`,
        );
      }

      // Create GL entries
      const entries = [];
      for (const line of data.lines) {
        const account = await tx.account.findFirst({
          where: { tenantId, code: line.accountCode },
        });

        if (!account) {
          throw new NotFoundException(`Account not found: ${line.accountCode}`);
        }

        // SCHEMA-2: Use provided currency/exchangeRate or fall back to tenant base currency
        const jeCurrency = data.currency || 'USD';
        const jeExchangeRate = data.exchangeRate || 1.0;
        const debitFc = line.debit || 0;
        const creditFc = line.credit || 0;

        const entry = await tx.glEntry.create({
          data: {
            tenantId,
            postingDate: new Date(data.postingDate),
            postingTs: new Date(),
            accountId: account.id,
            currency: jeCurrency,
            exchangeRate: jeExchangeRate,
            debitBc: debitFc * jeExchangeRate,
            creditBc: creditFc * jeExchangeRate,
            debitFc,
            creditFc,
            voucherType: data.voucherType,
            voucherNo: data.voucherNo,
            remarks: line.remarks || data.remarks,
          },
        });

        entries.push(entry);
      }

      this.logger.log(`Created manual journal entry: ${data.voucherNo}, ${entries.length} lines`);

      return {
        success: true,
        voucherNo: data.voucherNo,
        entriesCreated: entries.length,
        totalDebit,
        totalCredit,
      };
    });
  }

  /**
   * Get GL entries for a voucher
   */
  async getVoucherEntries(tenantId: string, voucherType: string, voucherNo: string) {
    const entries = await this.prisma.glEntry.findMany({
      where: { tenantId, voucherType, voucherNo },
      include: {
        account: {
          select: {
            code: true,
            name: true,
            accountType: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return entries.map((e) => ({
      id: e.id,
      postingDate: e.postingDate,
      account: {
        code: e.account.code,
        name: e.account.name,
        type: e.account.accountType,
      },
      debit: Number(e.debitBc),
      credit: Number(e.creditBc),
      remarks: e.remarks,
    }));
  }

  /**
   * Get trial balance
   */
  async getTrialBalance(tenantId: string, asOfDate?: string) {
    const where: any = { tenantId };
    if (asOfDate) {
      where.postingDate = { lte: new Date(asOfDate) };
    }

    // PERF-1: Use groupBy aggregation instead of loading all entries into memory
    const aggregated = await this.prisma.glEntry.groupBy({
      by: ['accountId'],
      where,
      _sum: {
        debitBc: true,
        creditBc: true,
      },
    });

    // Fetch account details for the accounts that have entries
    const accountIds = aggregated.map((a) => a.accountId);
    const accounts = await this.prisma.account.findMany({
      where: { id: { in: accountIds } },
      select: { id: true, code: true, name: true, accountType: true },
    });
    const accountMap = new Map(accounts.map((a) => [a.id, a]));

    const balances = aggregated.map((agg) => {
      const account = accountMap.get(agg.accountId);
      const totalDebit = Number(agg._sum.debitBc || 0);
      const totalCredit = Number(agg._sum.creditBc || 0);
      return {
        accountCode: account?.code || '',
        accountName: account?.name || '',
        accountType: account?.accountType || '',
        totalDebit,
        totalCredit,
        balance: totalDebit - totalCredit,
      };
    });

    return balances.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
  }

  /**
   * Get or create default account
   */
  private async getOrCreateAccount(
    tx: any,
    tenantId: string,
    code: string,
    name: string,
    accountType: string,
  ) {
    let account = await tx.account.findFirst({
      where: { tenantId, code },
    });

    if (!account) {
      account = await tx.account.create({
        data: {
          tenantId,
          code,
          name,
          accountType,
          isGroup: false,
        },
      });
      this.logger.log(`Created default account: ${code} - ${name}`);
    }

    return account;
  }

  /**
   * Auto-post all unposted paid invoices
   */
  async autoPostInvoices(tenantId: string) {
    const unpostedInvoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        status: InvoiceStatus.PAID,
        glPosted: false,
      },
      select: { id: true, invoiceNumber: true },
    });

    const results = [];
    for (const invoice of unpostedInvoices) {
      try {
        const result = await this.postInvoice(tenantId, invoice.id);
        results.push(result);
      } catch (err) {
        this.logger.error(`Failed to post invoice ${invoice.invoiceNumber}: ${err.message}`);
        results.push({
          success: false,
          invoiceNumber: invoice.invoiceNumber,
          error: err.message,
        });
      }
    }

    return {
      totalProcessed: results.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }
}
