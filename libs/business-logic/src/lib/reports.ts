import { Injectable } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { toSafeTableName } from '@platform/meta';

@Injectable()
export class ReportsService {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Generate Balance Sheet
     * Assets = Liabilities + Equity
     */
    async getBalanceSheet(tenantId: string, asOfDate: string) {
        const accounts = await this.getAccountBalances(tenantId, asOfDate);

        const assets = accounts.filter(a => a.root_type === 'Asset');
        const liabilities = accounts.filter(a => a.root_type === 'Liability');
        const equity = accounts.filter(a => a.root_type === 'Equity');

        const totalAssets = this.sumBalances(assets);
        const totalLiabilities = this.sumBalances(liabilities);
        const totalEquity = this.sumBalances(equity);

        return {
            as_of_date: asOfDate,
            assets: {
                accounts: assets,
                total: totalAssets
            },
            liabilities: {
                accounts: liabilities,
                total: totalLiabilities
            },
            equity: {
                accounts: equity,
                total: totalEquity
            },
            total_liabilities_and_equity: totalLiabilities + totalEquity,
            balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01
        };
    }

    /**
     * Generate Profit & Loss Statement
     * Net Profit = Income - Expenses
     */
    async getProfitAndLoss(tenantId: string, fromDate: string, toDate: string) {
        const accounts = await this.getAccountBalances(tenantId, toDate, fromDate);

        const income = accounts.filter(a => a.root_type === 'Income');
        const expenses = accounts.filter(a => a.root_type === 'Expense');

        const totalIncome = this.sumBalances(income);
        const totalExpenses = this.sumBalances(expenses);
        const netProfit = totalIncome - totalExpenses;

        return {
            from_date: fromDate,
            to_date: toDate,
            income: {
                accounts: income,
                total: totalIncome
            },
            expenses: {
                accounts: expenses,
                total: totalExpenses
            },
            net_profit: netProfit,
            net_profit_margin: totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0
        };
    }

    /**
     * Generate Cash Flow Statement
     */
    async getCashFlow(tenantId: string, fromDate: string, toDate: string) {
        const movements = await this.prisma.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT set_config('app.tenant', ${tenantId}, true)`;

            const cashAccounts = await tx.account.findMany({
                where: {
                    tenantId,
                    accountType: { in: ['Bank', 'Cash'] },
                    isActive: true,
                },
                select: { id: true, code: true },
            });

            const accountIds = cashAccounts.map(a => a.id);
            if (!accountIds.length) return [];

            return tx.$queryRawUnsafe<any[]>(`
                SELECT 
                    gl."postingDate" as posting_date,
                    gl."voucherType" as voucher_type,
                    gl."voucherNo" as voucher_no,
                    a."code" as account,
                    gl."debitBc" as debit,
                    gl."creditBc" as credit,
                    (gl."debitBc" - gl."creditBc") as net_change
                FROM "gl_entries" gl
                JOIN "accounts" a ON a."id" = gl."accountId"
                WHERE gl."tenantId" = $1
                  AND gl."accountId" = ANY($2::uuid[])
                  AND gl."postingDate" BETWEEN $3 AND $4
                ORDER BY gl."postingDate", gl."postingTs"
            `, tenantId, accountIds, new Date(`${fromDate}T00:00:00.000Z`), new Date(`${toDate}T00:00:00.000Z`));
        });

        const totalInflow = movements.reduce((sum, m) => sum + (m.debit || 0), 0);
        const totalOutflow = movements.reduce((sum, m) => sum + (m.credit || 0), 0);
        const netChange = totalInflow - totalOutflow;

        return {
            from_date: fromDate,
            to_date: toDate,
            cash_inflow: totalInflow,
            cash_outflow: totalOutflow,
            net_cash_change: netChange,
            movements
        };
    }

    /**
     * Generate General Ledger Report for an account
     */
    async getGeneralLedger(tenantId: string, account: string, fromDate: string, toDate: string) {
        const entries = await this.prisma.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT set_config('app.tenant', ${tenantId}, true)`;
            const accountRow = await tx.account.findUnique({
                where: { tenantId_code: { tenantId, code: account } },
                select: { id: true },
            });
            if (!accountRow) return [];

            return tx.$queryRawUnsafe<any[]>(`
                SELECT 
                    gl."postingDate" as posting_date,
                    gl."voucherType" as voucher_type,
                    gl."voucherNo" as voucher_no,
                    gl."debitBc" as debit,
                    gl."creditBc" as credit,
                    gl."remarks" as remarks
                FROM "gl_entries" gl
                WHERE gl."tenantId" = $1
                  AND gl."accountId" = $2
                  AND gl."postingDate" BETWEEN $3 AND $4
                ORDER BY gl."postingDate", gl."postingTs"
            `, tenantId, accountRow.id, new Date(`${fromDate}T00:00:00.000Z`), new Date(`${toDate}T00:00:00.000Z`));
        });

        let runningBalance = 0;
        const entriesWithBalance = entries.map(entry => {
            runningBalance += (entry.debit || 0) - (entry.credit || 0);
            return {
                ...entry,
                balance: runningBalance
            };
        });

        const totalDebit = entries.reduce((sum, e) => sum + (e.debit || 0), 0);
        const totalCredit = entries.reduce((sum, e) => sum + (e.credit || 0), 0);

        return {
            account,
            from_date: fromDate,
            to_date: toDate,
            entries: entriesWithBalance,
            total_debit: totalDebit,
            total_credit: totalCredit,
            closing_balance: runningBalance
        };
    }

    /**
     * Get account balances as of a date
     */
    private async getAccountBalances(tenantId: string, asOfDate: string, fromDate?: string) {
        const params: any[] = [tenantId];
        let dateFilter = '';
        if (fromDate) {
            dateFilter = 'AND gl."postingDate" BETWEEN $2 AND $3';
            params.push(new Date(`${fromDate}T00:00:00.000Z`));
            params.push(new Date(`${asOfDate}T00:00:00.000Z`));
        } else {
            dateFilter = 'AND gl."postingDate" <= $2';
            params.push(new Date(`${asOfDate}T00:00:00.000Z`));
        }

        return this.prisma.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT set_config('app.tenant', ${tenantId}, true)`;
            return tx.$queryRawUnsafe<any[]>(`
                SELECT 
                    a."code" as account,
                    a."rootType" as root_type,
                    a."accountType" as account_type,
                    COALESCE(SUM(gl."debitBc"), 0) as total_debit,
                    COALESCE(SUM(gl."creditBc"), 0) as total_credit,
                    COALESCE(SUM(gl."debitBc" - gl."creditBc"), 0) as balance
                FROM "accounts" a
                LEFT JOIN "gl_entries" gl ON gl."accountId" = a."id"
                    AND gl."tenantId" = a."tenantId"
                    ${dateFilter}
                WHERE a."tenantId" = $1
                  AND a."isGroup" = false
                GROUP BY a."code", a."rootType", a."accountType"
                HAVING COALESCE(SUM(gl."debitBc" - gl."creditBc"), 0) != 0
                ORDER BY a."rootType", a."code"
            `, ...params);
        });
    }

    private sumBalances(accounts: any[]): number {
        return accounts.reduce((sum, acc) => {
            const balance = acc.balance || 0;
            // Use signed balance values as the accounting equation requires.
            // Debit-normal accounts (Assets, Expenses) naturally have positive balances,
            // while credit-normal accounts (Liabilities, Equity, Income) have negative balances.
            // Using Math.abs here would break the accounting equation (A = L + E).
            return sum + balance;
        }, 0);
    }

    /**
     * Get Trial Balance - All accounts with debit/credit totals
     */
    async getTrialBalance(tenantId: string, asOfDate: string) {
        const accounts = await this.getAccountBalances(tenantId, asOfDate);

        const totalDebit = accounts.reduce((sum, a) => sum + (a.total_debit || 0), 0);
        const totalCredit = accounts.reduce((sum, a) => sum + (a.total_credit || 0), 0);

        return {
            as_of_date: asOfDate,
            accounts,
            total_debit: totalDebit,
            total_credit: totalCredit,
            difference: totalDebit - totalCredit,
            balanced: Math.abs(totalDebit - totalCredit) < 0.01
        };
    }

    /**
     * Get Accounts Receivable Aging Report
     */
    async getReceivableAging(tenantId: string, asOfDate: string) {
        const invoices = await this.prisma.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT set_config('app.tenant', ${tenantId}, true)`;
            const invoiceTable = toSafeTableName('Invoice');
            return tx.$queryRawUnsafe<any[]>(`
                SELECT 
                    name,
                    customer,
                    posting_date,
                    due_date,
                    grand_total,
                    outstanding_amount,
                    EXTRACT(DAY FROM ($1::date - due_date)) as days_overdue
                FROM "${invoiceTable}"
                WHERE "tenantId" = $2
                  AND docstatus = 1
                  AND outstanding_amount > 0
                  AND posting_date <= $1
                ORDER BY due_date
            `, asOfDate, tenantId);
        });

        const aged = {
            current: [] as any[],
            '1-30': [] as any[],
            '31-60': [] as any[],
            '61-90': [] as any[],
            '90+': [] as any[]
        };

        invoices.forEach(inv => {
            const days = inv.days_overdue;
            if (days <= 0) aged.current.push(inv);
            else if (days <= 30) aged['1-30'].push(inv);
            else if (days <= 60) aged['31-60'].push(inv);
            else if (days <= 90) aged['61-90'].push(inv);
            else aged['90+'].push(inv);
        });

        return {
            as_of_date: asOfDate,
            aged,
            totals: {
                current: this.sumOutstanding(aged.current),
                '1-30': this.sumOutstanding(aged['1-30']),
                '31-60': this.sumOutstanding(aged['31-60']),
                '61-90': this.sumOutstanding(aged['61-90']),
                '90+': this.sumOutstanding(aged['90+']),
                total: this.sumOutstanding(invoices)
            }
        };
    }

    /**
     * Get Accounts Payable Aging Report
     */
    async getPayableAging(tenantId: string, asOfDate: string) {
        const invoices = await this.prisma.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT set_config('app.tenant', ${tenantId}, true)`;
            const invoiceTable = toSafeTableName('Purchase Invoice');
            return tx.$queryRawUnsafe<any[]>(`
                SELECT 
                    name,
                    supplier,
                    posting_date,
                    due_date,
                    grand_total,
                    outstanding_amount,
                    EXTRACT(DAY FROM ($1::date - due_date)) as days_overdue
                FROM "${invoiceTable}"
                WHERE "tenantId" = $2
                  AND docstatus = 1
                  AND outstanding_amount > 0
                  AND posting_date <= $1
                ORDER BY due_date
            `, asOfDate, tenantId);
        });

        const aged = {
            current: [] as any[],
            '1-30': [] as any[],
            '31-60': [] as any[],
            '61-90': [] as any[],
            '90+': [] as any[]
        };

        invoices.forEach(inv => {
            const days = inv.days_overdue;
            if (days <= 0) aged.current.push(inv);
            else if (days <= 30) aged['1-30'].push(inv);
            else if (days <= 60) aged['31-60'].push(inv);
            else if (days <= 90) aged['61-90'].push(inv);
            else aged['90+'].push(inv);
        });

        return {
            as_of_date: asOfDate,
            aged,
            totals: {
                current: this.sumOutstanding(aged.current),
                '1-30': this.sumOutstanding(aged['1-30']),
                '31-60': this.sumOutstanding(aged['31-60']),
                '61-90': this.sumOutstanding(aged['61-90']),
                '90+': this.sumOutstanding(aged['90+']),
                total: this.sumOutstanding(invoices)
            }
        };
    }

    private sumOutstanding(invoices: any[]): number {
        return invoices.reduce((sum, inv) => sum + (inv.outstanding_amount || 0), 0);
    }
}
