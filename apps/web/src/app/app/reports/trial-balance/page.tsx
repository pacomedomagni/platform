'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@platform/ui';
import api from '../../../../lib/api';
import { ReportAlert, ReportCard, ReportEmpty, ReportLoading, ReportPage, ReportTable } from '../_components/report-shell';
import { ReportToolbar, downloadCSV, toCSV } from '../_components/report-toolbar';
import { useUrlFilters } from '@/lib/hooks/use-url-filters';

type TrialAccount = {
  account: string;
  root_type: string;
  account_type: string;
  total_debit: number;
  total_credit: number;
  balance: number;
};

type TrialBalance = {
  as_of_date: string;
  accounts: TrialAccount[];
  total_debit: number;
  total_credit: number;
  difference: number;
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

export default function TrialBalancePage() {
  // Trial balance is point-in-time; we still use both from/to slots so the toolbar
  // can stay generic but only as_of_date is sent to the API.
  const [asOfDate, setAsOfDate] = useState('');
  const [data, setData] = useState<TrialBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useUrlFilters({ asOfDate }, { asOfDate: setAsOfDate });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/v1/reports/trial-balance', {
        params: { asOfDate: asOfDate || undefined },
      });
      setData(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load trial balance');
    } finally {
      setLoading(false);
    }
  }, [asOfDate]);

  // Auto-fire on date change so presets feel instantaneous; no manual Load click required.
  useEffect(() => {
    load();
  }, [load]);

  const handleExport = (format: 'csv' | 'pdf') => {
    if (format === 'pdf') {
      window.print();
      return;
    }
    if (!data) return;
    const csv = toCSV(
      data.accounts.map((r) => ({
        account: r.account,
        root_type: r.root_type,
        account_type: r.account_type,
        debit: r.total_debit,
        credit: r.total_credit,
        balance: r.balance,
      })),
      ['account', 'root_type', 'account_type', 'debit', 'credit', 'balance'],
    );
    downloadCSV(`trial-balance-${asOfDate || 'latest'}.csv`, csv);
  };

  return (
    <ReportPage title="Trial Balance" description="Account totals as of a date.">
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
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span>Total Debit: {formatCurrency(data.total_debit)}</span>
            <span className="text-muted-foreground">|</span>
            <span>Total Credit: {formatCurrency(data.total_credit)}</span>
            <span className="text-muted-foreground">|</span>
            <span>Difference: {formatCurrency(data.difference)}</span>
            <Badge variant={data.balanced ? 'success' : 'warning'}>
              {data.balanced ? 'Balanced' : 'Unbalanced'}
            </Badge>
          </div>
          <ReportCard>
            <ReportTable>
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Account</th>
                  <th className="text-left p-3">Root Type</th>
                  <th className="text-left p-3">Account Type</th>
                  <th className="text-right p-3">Debit</th>
                  <th className="text-right p-3">Credit</th>
                  <th className="text-right p-3">Balance</th>
                </tr>
              </thead>
              <tbody>
                {loading && <ReportLoading colSpan={6} />}
                {!loading && data.accounts.length === 0 && <ReportEmpty colSpan={6} />}
                {data.accounts.map((row, idx) => (
                  <tr key={`${row.account}-${idx}`} className="border-b last:border-0">
                    <td className="p-3">{row.account}</td>
                    <td className="p-3">{row.root_type}</td>
                    <td className="p-3">{row.account_type}</td>
                    <td className="p-3 text-right">{formatCurrency(row.total_debit)}</td>
                    <td className="p-3 text-right">{formatCurrency(row.total_credit)}</td>
                    <td className="p-3 text-right">{formatCurrency(row.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </ReportTable>
          </ReportCard>
        </div>
      )}
    </ReportPage>
  );
}
