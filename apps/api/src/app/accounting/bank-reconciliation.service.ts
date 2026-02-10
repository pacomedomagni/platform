import { Injectable, Logger, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
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
          try {
            // PERF-3: Batch approach — 2 queries instead of 2N
            // 1. Fetch all existing transactions in one query for dedup
            const existing = await this.prisma.bankTransaction.findMany({
              where: {
                tenantId,
                bankAccount,
              },
              select: {
                transactionDate: true,
                amount: true,
                referenceNumber: true,
              },
            });

            // 2. Build a Set of composite keys for O(1) lookup
            const existingKeys = new Set(
              existing.map(
                (e) =>
                  `${e.transactionDate.toISOString()}|${e.amount}|${e.referenceNumber || ''}`,
              ),
            );

            // 3. Filter out duplicates in-memory
            const newTransactions = transactions.filter((txn) => {
              const key = `${new Date(txn.date).toISOString()}|${txn.amount}|${txn.referenceNumber || ''}`;
              return !existingKeys.has(key);
            });

            const skipped = transactions.length - newTransactions.length;

            // 4. Single createMany for all new transactions
            const now = Date.now();
            if (newTransactions.length > 0) {
              await this.prisma.bankTransaction.createMany({
                data: newTransactions.map((txn, i) => ({
                  tenantId,
                  name: `BT-${now}-${i}`,
                  bankAccount,
                  transactionDate: new Date(txn.date),
                  amount: txn.amount,
                  transactionType: txn.transactionType,
                  description: txn.description,
                  referenceNumber: txn.referenceNumber,
                  status: 'Unreconciled',
                })),
              });
            }

            const imported = newTransactions.length;
            this.logger.log(`Imported ${imported} bank transactions, skipped ${skipped}`);
            resolve({ imported, skipped, errors });
          } catch (err) {
            errors.push(`Import error: ${err.message}`);
            resolve({ imported: 0, skipped: 0, errors });
          }
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

    if (unreconciledTransactions.length === 0) {
      return { matched: 0, totalUnreconciled: 0, matches: [] };
    }

    // PERF-4: Pre-fetch all candidate invoices in one query instead of N queries
    const dates = unreconciledTransactions.map((t) => t.transactionDate.getTime());
    const minDate = new Date(Math.min(...dates) - 7 * 24 * 60 * 60 * 1000);
    const maxDate = new Date(Math.max(...dates) + 7 * 24 * 60 * 60 * 1000);

    const candidateInvoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        paidDate: { gte: minDate, lte: maxDate },
      },
    });

    // Build Map<amount_string, Invoice[]> for O(1) lookup by amount
    const invoicesByAmount = new Map<string, typeof candidateInvoices>();
    for (const inv of candidateInvoices) {
      const key = String(inv.grandTotal);
      if (!invoicesByAmount.has(key)) {
        invoicesByAmount.set(key, []);
      }
      invoicesByAmount.get(key)!.push(inv);
    }

    let matched = 0;
    const matches = [];
    // RACE-5: Track matched invoice IDs to prevent double-matching
    const matchedInvoiceIds = new Set<string>();
    const txnUpdates: Array<{ id: string; invoice: string }> = [];

    for (const txn of unreconciledTransactions) {
      const amountKey = String(txn.amount);
      const candidates = invoicesByAmount.get(amountKey) || [];
      const txnDate = txn.transactionDate.getTime();
      const windowMs = 7 * 24 * 60 * 60 * 1000;

      // Find matching invoice within date window, not already matched
      const availableInvoice = candidates.find(
        (inv) =>
          !matchedInvoiceIds.has(inv.id) &&
          inv.paidDate &&
          Math.abs(inv.paidDate.getTime() - txnDate) <= windowMs,
      );

      if (availableInvoice) {
        matchedInvoiceIds.add(availableInvoice.id);
        txnUpdates.push({ id: txn.id, invoice: availableInvoice.invoiceNumber });

        matched++;
        matches.push({
          transactionId: txn.id,
          invoiceId: availableInvoice.id,
          invoiceNumber: availableInvoice.invoiceNumber,
          amount: Number(txn.amount),
          matchType: 'auto',
        });
      }
    }

    // Batch update matched transactions
    if (txnUpdates.length > 0) {
      await this.prisma.$transaction(
        txnUpdates.map((u) =>
          this.prisma.bankTransaction.update({
            where: { id: u.id },
            data: { status: 'Reconciled', invoice: u.invoice },
          }),
        ),
      );
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

    // VAL-2: Check if transaction is already reconciled
    if (transaction.status === 'Reconciled') {
      throw new ConflictException('Transaction is already reconciled');
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

    // FLOW-4: Pre-fetch GL entries for matched invoices to link reconciliation details
    const matchedInvoiceNumbers = transactions
      .filter((t) => t.invoice)
      .map((t) => t.invoice as string);

    const glEntries =
      matchedInvoiceNumbers.length > 0
        ? await this.prisma.glEntry.findMany({
            where: {
              tenantId,
              voucherType: 'INVOICE',
              voucherNo: { in: matchedInvoiceNumbers },
            },
            select: { id: true, voucherNo: true },
          })
        : [];

    // Map invoice number → first GL entry ID
    const glEntryMap = new Map<string, string>();
    for (const entry of glEntries) {
      if (!glEntryMap.has(entry.voucherNo)) {
        glEntryMap.set(entry.voucherNo, entry.id);
      }
    }

    for (const txn of transactions) {
      const amount = Number(txn.amount);
      closingBalance += txn.transactionType === 'Credit' ? amount : -amount;

      const invoiceNo = txn.invoice || null;
      const glEntryId = invoiceNo ? glEntryMap.get(invoiceNo) || null : null;

      details.push({
        tenantId,
        bankTransaction: txn.name || txn.id,
        postingDate: txn.transactionDate,
        amount: txn.amount,
        voucherType: invoiceNo ? 'INVOICE' : txn.transactionType,
        voucherNo: txn.referenceNumber || invoiceNo || null,
        isMatched: !!invoiceNo,
        glEntryId,
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
        // SCHEMA-3: Use consistent status values aligned with docstatus convention
        docstatus: Math.abs(difference) < 0.01 ? 1 : 0,
        status: Math.abs(difference) < 0.01 ? 'Reconciled' : 'Draft',
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
