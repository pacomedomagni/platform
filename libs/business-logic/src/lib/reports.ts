import { Injectable } from '@nestjs/common';
import { PrismaService } from '@platform/db';

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
        // Get all bank/cash accounts
        const cashAccounts = await this.prisma.$queryRawUnsafe<any[]>(`
            SELECT DISTINCT account
            FROM "Account"
            WHERE tenant_id = $1
              AND (account_type = 'Bank' OR account_type = 'Cash')
              AND docstatus = 1
        `, tenantId);

        const accountNames = cashAccounts.map(a => a.account);

        // Get cash movements
        const movements = await this.prisma.$queryRawUnsafe<any[]>(`
            SELECT 
                posting_date,
                voucher_type,
                voucher_no,
                account,
                debit,
                credit,
                (debit - credit) as net_change
            FROM "GL Entry"
            WHERE tenant_id = $1
              AND account = ANY($2::text[])
              AND posting_date BETWEEN $3 AND $4
              AND docstatus = 1
            ORDER BY posting_date, creation
        `, tenantId, accountNames, fromDate, toDate);

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
        const entries = await this.prisma.$queryRawUnsafe<any[]>(`
            SELECT 
                posting_date,
                voucher_type,
                voucher_no,
                party_type,
                party,
                against,
                debit,
                credit,
                remarks
            FROM "GL Entry"
            WHERE tenant_id = $1
              AND account = $2
              AND posting_date BETWEEN $3 AND $4
              AND docstatus = 1
            ORDER BY posting_date, creation
        `, tenantId, account, fromDate, toDate);

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
        const dateFilter = fromDate 
            ? `AND posting_date BETWEEN '${fromDate}' AND '${asOfDate}'`
            : `AND posting_date <= '${asOfDate}'`;

        const balances = await this.prisma.$queryRawUnsafe<any[]>(`
            SELECT 
                a.account,
                a.root_type,
                a.account_type,
                COALESCE(SUM(gl.debit), 0) as total_debit,
                COALESCE(SUM(gl.credit), 0) as total_credit,
                COALESCE(SUM(gl.debit - gl.credit), 0) as balance
            FROM "Account" a
            LEFT JOIN "GL Entry" gl ON gl.account = a.account 
                AND gl.tenant_id = a.tenant_id 
                AND gl.docstatus = 1
                ${dateFilter}
            WHERE a.tenant_id = $1
              AND a.docstatus = 1
              AND a.is_group = false
            GROUP BY a.account, a.root_type, a.account_type
            HAVING COALESCE(SUM(gl.debit - gl.credit), 0) != 0
            ORDER BY a.root_type, a.account
        `, tenantId);

        return balances;
    }

    private sumBalances(accounts: any[]): number {
        return accounts.reduce((sum, acc) => {
            const balance = acc.balance || 0;
            // Assets and Expenses are debits (positive), Liabilities/Equity/Income are credits (negative in GL)
            // For balance sheet, we want all positive values
            return sum + Math.abs(balance);
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
        const invoices = await this.prisma.$queryRawUnsafe<any[]>(`
            SELECT 
                name,
                customer,
                posting_date,
                due_date,
                grand_total,
                outstanding_amount,
                EXTRACT(DAY FROM ($1::date - due_date)) as days_overdue
            FROM "Invoice"
            WHERE tenant_id = $2
              AND docstatus = 1
              AND outstanding_amount > 0
              AND posting_date <= $1
            ORDER BY due_date
        `, asOfDate, tenantId);

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
