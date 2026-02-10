import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import * as csv from 'csv-parser';
import { Readable } from 'stream';

interface BankTransactionImport {
  date: string;
  description: string;
  amount: number;
  transactionType: 'Debit' | 'Credit';
  referenceNumber?: string;
}

interface ReconciliationMatch {
  transactionId: string;
  paymentEntryId?: string;
  invoiceId?: string;
  matchType: 'exact' | 'partial' | 'manual';
}

@Injectable()
export class BankReconciliationService {
  private readonly logger = new Logger(BankReconciliationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Import bank transactions from CSV
   */
  async importBankTransactions(
    tenantId: string,
    bankAccount: string,
    csvContent: string,
  ): Promise<{ imported: number; skipped: number; errors: string[] }> {
    const transactions: BankTransactionImport[] = [];
    const errors: string[] = [];

    return new Promise((resolve, reject) => {
      const stream = Readable.from(csvContent);

      stream
        .pipe(csv())
        .on('data', (row) => {
          try {
            // Parse CSV row (adjust field names based on bank's CSV format)
            const transaction = {
              date: row.date || row.Date || row.DATE,
              description: row.description || row.Description || row.DESCRIPTION,
              amount: parseFloat(row.amount || row.Amount || row.AMOUNT),
              transactionType: row.type || row.Type || row.TYPE || 'Debit',
              referenceNumber: row.reference || row.Reference || row.REF,
            };

            if (!transaction.date || isNaN(transaction.amount)) {
              errors.push(`Invalid transaction: ${JSON.stringify(row)}`);
              return;
            }

            transactions.push(transaction);
          } catch (err) {
            errors.push(`Parse error: ${err.message}`);
          }
        })
        .on('end', async () => {
          let imported = 0;
          let skipped = 0;

          for (const txn of transactions) {
            try {
              // Check if transaction already exists
              const existing = await this.prisma.bankTransaction.findFirst({
                where: {
                  tenantId,
                  bankAccount,
                  transactionDate: new Date(txn.date),
                  amount: txn.amount,
                  referenceNumber: txn.referenceNumber,
                },
              });

              if (existing) {
                skipped++;
                continue;
              }

              // Create transaction
              await this.prisma.bankTransaction.create({
                data: {
                  tenantId,
                  name: `BT-${Date.now()}-${imported}`,
                  bankAccount,
                  transactionDate: new Date(txn.date),
                  amount: txn.amount,
                  transactionType: txn.transactionType,
                  description: txn.description,
                  referenceNumber: txn.referenceNumber,
                  status: 'Unreconciled',
                },
              });

              imported++;
            } catch (err) {
              errors.push(`Import error: ${err.message}`);
            }
          }

          this.logger.log(`Imported ${imported} bank transactions, skipped ${skipped}`);
          resolve({ imported, skipped, errors });
        })
        .on('error', (err) => reject(err));
    });
  }

  /**
   * Auto-match bank transactions with payments/invoices
   */
  async autoMatch(tenantId: string, bankAccount: string) {
    const unreconciledTransactions = await this.prisma.bankTransaction.findMany({
      where: {
        tenantId,
        bankAccount,
        status: 'Unreconciled',
      },
    });

    let matched = 0;
    const matches = [];

    for (const txn of unreconciledTransactions) {
      // Try to match with invoices by amount and date
      const matchingInvoices = await this.prisma.invoice.findMany({
        where: {
          tenantId,
          grandTotal: txn.amount,
          paidDate: {
            gte: new Date(new Date(txn.transactionDate).getTime() - 7 * 24 * 60 * 60 * 1000),
            lte: new Date(new Date(txn.transactionDate).getTime() + 7 * 24 * 60 * 60 * 1000),
          },
        },
        take: 1,
      });

      if (matchingInvoices.length > 0) {
        const invoice = matchingInvoices[0];

        await this.prisma.bankTransaction.update({
          where: { id: txn.id },
          data: {
            status: 'Reconciled',
            invoice: invoice.invoiceNumber,
          },
        });

        matched++;
        matches.push({
          transactionId: txn.id,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          amount: Number(txn.amount),
          matchType: 'auto',
        });
      }
    }

    this.logger.log(`Auto-matched ${matched} transactions`);

    return {
      matched,
      totalUnreconciled: unreconciledTransactions.length,
      matches,
    };
  }

  /**
   * Manual match transaction with payment/invoice
   */
  async manualMatch(
    tenantId: string,
    transactionId: string,
    match: {
      invoiceId?: string;
      paymentEntryId?: string;
    },
  ) {
    const transaction = await this.prisma.bankTransaction.findFirst({
      where: { id: transactionId, tenantId },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    const updateData: any = {
      status: 'Reconciled',
    };

    if (match.invoiceId) {
      const invoice = await this.prisma.invoice.findFirst({
        where: { id: match.invoiceId, tenantId },
      });

      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      updateData.invoice = invoice.invoiceNumber;
    }

    if (match.paymentEntryId) {
      updateData.paymentEntry = match.paymentEntryId;
    }

    await this.prisma.bankTransaction.update({
      where: { id: transactionId },
      data: updateData,
    });

    this.logger.log(`Manually matched transaction ${transactionId}`);

    return { success: true, transactionId };
  }

  /**
   * Create bank reconciliation
   */
  async createReconciliation(
    tenantId: string,
    data: {
      name: string;
      bankAccount: string;
      fromDate: string;
      toDate: string;
      bankStatementBalance: number;
    },
  ) {
    // Get opening balance (closing balance of previous reconciliation)
    const previousRecon = await this.prisma.bankReconciliation.findFirst({
      where: {
        tenantId,
        bankAccount: data.bankAccount,
        toDate: { lt: new Date(data.fromDate) },
      },
      orderBy: { toDate: 'desc' },
    });

    const openingBalance = previousRecon ? Number(previousRecon.closingBalance) : 0;

    // Get reconciled transactions in date range
    const transactions = await this.prisma.bankTransaction.findMany({
      where: {
        tenantId,
        bankAccount: data.bankAccount,
        transactionDate: {
          gte: new Date(data.fromDate),
          lte: new Date(data.toDate),
        },
        status: 'Reconciled',
      },
    });

    // Calculate closing balance
    let closingBalance = openingBalance;
    const details = [];

    for (const txn of transactions) {
      const amount = Number(txn.amount);
      closingBalance += txn.transactionType === 'Credit' ? amount : -amount;

      details.push({
        tenantId,
        transactionId: txn.id,
        transactionDate: txn.transactionDate,
        amount: txn.amount,
        transactionType: txn.transactionType,
        description: txn.description,
      });
    }

    const difference = data.bankStatementBalance - closingBalance;

    // Create reconciliation
    const reconciliation = await this.prisma.bankReconciliation.create({
      data: {
        tenantId,
        name: data.name,
        bankAccount: data.bankAccount,
        fromDate: new Date(data.fromDate),
        toDate: new Date(data.toDate),
        openingBalance,
        closingBalance,
        bankStatementBalance: data.bankStatementBalance,
        difference,
        status: Math.abs(difference) < 0.01 ? 'Reconciled' : 'Unreconciled',
        details: {
          create: details,
        },
      },
      include: {
        details: true,
      },
    });

    this.logger.log(`Created bank reconciliation ${reconciliation.name}`);

    return {
      ...reconciliation,
      openingBalance: Number(reconciliation.openingBalance),
      closingBalance: Number(reconciliation.closingBalance),
      bankStatementBalance: Number(reconciliation.bankStatementBalance),
      difference: Number(reconciliation.difference),
      isReconciled: Math.abs(difference) < 0.01,
    };
  }

  /**
   * Get unreconciled transactions
   */
  async getUnreconciledTransactions(tenantId: string, bankAccount?: string) {
    const where: any = {
      tenantId,
      status: 'Unreconciled',
    };

    if (bankAccount) {
      where.bankAccount = bankAccount;
    }

    const transactions = await this.prisma.bankTransaction.findMany({
      where,
      orderBy: { transactionDate: 'desc' },
    });

    return transactions.map((t) => ({
      ...t,
      amount: Number(t.amount),
    }));
  }

  /**
   * Get reconciliation by ID
   */
  async getReconciliation(tenantId: string, id: string) {
    const reconciliation = await this.prisma.bankReconciliation.findFirst({
      where: { id, tenantId },
      include: {
        details: true,
      },
    });

    if (!reconciliation) {
      throw new NotFoundException('Reconciliation not found');
    }

    return {
      ...reconciliation,
      openingBalance: Number(reconciliation.openingBalance),
      closingBalance: Number(reconciliation.closingBalance),
      bankStatementBalance: Number(reconciliation.bankStatementBalance),
      difference: Number(reconciliation.difference),
      details: reconciliation.details.map((d) => ({
        ...d,
        amount: Number(d.amount),
      })),
    };
  }

  /**
   * List reconciliations
   */
  async listReconciliations(
    tenantId: string,
    query: {
      bankAccount?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const { bankAccount, limit = 50, offset = 0 } = query;

    const where: any = { tenantId };
    if (bankAccount) {
      where.bankAccount = bankAccount;
    }

    const [reconciliations, total] = await Promise.all([
      this.prisma.bankReconciliation.findMany({
        where,
        orderBy: { toDate: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.bankReconciliation.count({ where }),
    ]);

    return {
      data: reconciliations.map((r) => ({
        ...r,
        openingBalance: Number(r.openingBalance),
        closingBalance: Number(r.closingBalance),
        bankStatementBalance: Number(r.bankStatementBalance),
        difference: Number(r.difference),
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + reconciliations.length < total,
      },
    };
  }
}
