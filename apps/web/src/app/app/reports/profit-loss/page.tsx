'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@platform/ui';
import api from '../../../../lib/api';
import { ReportAlert, ReportCard, ReportEmpty, ReportPage, ReportTable } from '../_components/report-shell';
import { ReportToolbar, downloadCSV, toCSV } from '../_components/report-toolbar';

type ProfitLoss = {
  from_date: string;
  to_date: string;
  income: { accounts: any[]; total: number };
  expenses: { accounts: any[]; total: number };
  net_profit: number;
  net_profit_margin: number;
};

const formatCurrency = (amount: number) => {
  const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
  const cur = (typeof window !== 'undefined' && localStorage.getItem('tenantCurrency')) || 'USD';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: cur,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(amount);
  }
};

export default function ProfitLossPage() {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [data, setData] = useState<ProfitLoss | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/v1/reports/profit-loss', {
        params: { fromDate: fromDate || undefined, toDate: toDate || undefined },
      });
      setData(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load profit & loss');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    load();
  }, [load]);

  const handleExport = (format: 'csv' | 'pdf') => {
    if (format === 'pdf') {
      window.print();
      return;
    }
    if (!data) return;
    const rows: Array<Record<string, unknown>> = [];
    for (const r of data.income.accounts) rows.push({ section: 'Income', account: r.account, balance: r.balance });
    rows.push({ section: 'Income', account: 'TOTAL', balance: data.income.total });
    for (const r of data.expenses.accounts) rows.push({ section: 'Expenses', account: r.account, balance: r.balance });
    rows.push({ section: 'Expenses', account: 'TOTAL', balance: data.expenses.total });
    rows.push({ section: 'Summary', account: 'Net Profit', balance: data.net_profit });
    rows.push({ section: 'Summary', account: 'Net Profit Margin %', balance: data.net_profit_margin });
    downloadCSV(`profit-loss-${fromDate || 'all'}-${toDate || 'today'}.csv`, toCSV(rows, ['section', 'account', 'balance']));
  };

  const renderRows = (rows: any[]) => (
    <ReportTable>
      <thead className="bg-muted/60 text-muted-foreground">
        <tr>
          <th className="text-left p-3">Account</th>
          <th className="text-right p-3">Balance</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && <ReportEmpty colSpan={2} />}
        {rows.map((row, idx) => (
          <tr key={`${row.account}-${idx}`} className="border-b last:border-0">
            <td className="p-3">{row.account}</td>
            <td className="p-3 text-right">{formatCurrency(Math.abs(row.balance))}</td>
          </tr>
        ))}
      </tbody>
    </ReportTable>
  );

  return (
    <ReportPage title="Profit & Loss" description="Income and expenses.">
      <ReportToolbar
        from={fromDate}
        to={toDate}
        onChange={(f, t) => { setFromDate(f); setToDate(t); }}
        onRefresh={load}
        loading={loading}
        onExport={handleExport}
      />

      {error && <ReportAlert>{error}</ReportAlert>}

      {data && (
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="font-medium">Income</div>
              <Badge variant="secondary">Total: {formatCurrency(data.income.total)}</Badge>
            </div>
            <ReportCard>{renderRows(data.income.accounts)}</ReportCard>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="font-medium">Expenses</div>
              <Badge variant="secondary">Total: {formatCurrency(data.expenses.total)}</Badge>
            </div>
            <ReportCard>{renderRows(data.expenses.accounts)}</ReportCard>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span>Net Profit: {formatCurrency(data.net_profit)}</span>
            <span className="text-muted-foreground">|</span>
            <span>Margin: {data.net_profit_margin.toFixed(2)}%</span>
          </div>
        </div>
      )}
    </ReportPage>
  );
}
