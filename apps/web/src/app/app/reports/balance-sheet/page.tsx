'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@platform/ui';
import api from '../../../../lib/api';
import { ReportAlert, ReportCard, ReportEmpty, ReportLoading, ReportPage, ReportTable } from '../_components/report-shell';
import { ReportToolbar, downloadCSV, toCSV } from '../_components/report-toolbar';
import { useUrlFilters } from '@/lib/hooks/use-url-filters';

type BalanceAccount = {
  account: string;
  root_type: string;
  account_type: string;
  total_debit: number;
  total_credit: number;
  balance: number;
};

type BalanceSection = {
  accounts: BalanceAccount[];
  total: number;
};

type BalanceSheet = {
  as_of_date: string;
  assets: BalanceSection;
  liabilities: BalanceSection;
  equity: BalanceSection;
  total_liabilities_and_equity: number;
  balanced: boolean;
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

export default function BalanceSheetPage() {
  const [asOfDate, setAsOfDate] = useState('');
  const [data, setData] = useState<BalanceSheet | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useUrlFilters({ asOfDate }, { asOfDate: setAsOfDate });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/v1/reports/balance-sheet', {
        params: { asOfDate: asOfDate || undefined },
      });
      setData(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load balance sheet');
    } finally {
      setLoading(false);
    }
  }, [asOfDate]);

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
    const push = (section: string, src: BalanceSection) => {
      for (const r of src.accounts) rows.push({ section, account: r.account, balance: r.balance });
      rows.push({ section, account: 'TOTAL', balance: src.total });
    };
    push('Assets', data.assets);
    push('Liabilities', data.liabilities);
    push('Equity', data.equity);
    rows.push({ section: 'Summary', account: 'Liabilities + Equity', balance: data.total_liabilities_and_equity });
    downloadCSV(`balance-sheet-${asOfDate || 'latest'}.csv`, toCSV(rows, ['section', 'account', 'balance']));
  };

  const renderSection = (label: string, section: BalanceSection) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="font-medium">{label}</div>
        <Badge variant="secondary">Total: {formatCurrency(section.total)}</Badge>
      </div>
      <ReportCard>
        <ReportTable>
          <thead className="bg-muted/60 text-muted-foreground">
            <tr>
              <th className="text-left p-3">Account</th>
              <th className="text-right p-3">Balance</th>
            </tr>
          </thead>
          <tbody>
            {loading && <ReportLoading colSpan={2} />}
            {!loading && section.accounts.length === 0 && <ReportEmpty colSpan={2} />}
            {section.accounts.map((row, idx) => (
              <tr key={`${row.account}-${idx}`} className="border-b last:border-0">
                <td className="p-3">{row.account}</td>
                <td className="p-3 text-right">{formatCurrency(Math.abs(row.balance))}</td>
              </tr>
            ))}
          </tbody>
        </ReportTable>
      </ReportCard>
    </div>
  );

  return (
    <ReportPage title="Balance Sheet" description="Assets, liabilities, and equity.">
      <ReportToolbar
        from={asOfDate}
        to={asOfDate}
        singleDate
        singleDateLabel="As of"
        onChange={(f) => setAsOfDate(f)}
        onRefresh={load}
        loading={loading}
        onExport={handleExport}
      />

      {error && <ReportAlert>{error}</ReportAlert>}

      {data && (
        <div className="space-y-4">
          {renderSection('Assets', data.assets)}
          {renderSection('Liabilities', data.liabilities)}
          {renderSection('Equity', data.equity)}
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span>Total Liabilities + Equity: {formatCurrency(data.total_liabilities_and_equity)}</span>
            <Badge variant={data.balanced ? 'success' : 'warning'}>
              {data.balanced ? 'Balanced' : 'Unbalanced'}
            </Badge>
          </div>
        </div>
      )}
    </ReportPage>
  );
}
