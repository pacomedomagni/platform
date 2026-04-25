'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '../../../../lib/api';
import { ReportAlert, ReportCard, ReportEmpty, ReportPage, ReportTable } from '../_components/report-shell';
import { ReportToolbar, downloadCSV, toCSV } from '../_components/report-toolbar';

type CashMovement = {
  posting_date: string;
  voucher_type: string;
  voucher_no: string;
  account: string;
  debit: number;
  credit: number;
  net_change: number;
};

type CashFlow = {
  from_date: string;
  to_date: string;
  cash_inflow: number;
  cash_outflow: number;
  net_cash_change: number;
  movements: CashMovement[];
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

export default function CashFlowPage() {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [data, setData] = useState<CashFlow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/v1/reports/cash-flow', {
        params: { fromDate: fromDate || undefined, toDate: toDate || undefined },
      });
      setData(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load cash flow');
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
    downloadCSV(
      `cash-flow-${fromDate || 'all'}-${toDate || 'today'}.csv`,
      toCSV(data.movements, ['posting_date', 'voucher_type', 'voucher_no', 'account', 'debit', 'credit', 'net_change']),
    );
  };

  return (
    <ReportPage title="Cash Flow" description="Cash account movements.">
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
        <div className="space-y-3">
          <div className="text-sm text-slate-600">
            Inflow: {formatCurrency(data.cash_inflow)} | Outflow: {formatCurrency(data.cash_outflow)} | Net: {formatCurrency(data.net_cash_change)}
          </div>
          <ReportCard>
            <ReportTable>
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Posting Date</th>
                  <th className="text-left p-3">Voucher</th>
                  <th className="text-left p-3">Account</th>
                  <th className="text-right p-3">Debit</th>
                  <th className="text-right p-3">Credit</th>
                  <th className="text-right p-3">Net</th>
                </tr>
              </thead>
              <tbody>
                {data.movements.length === 0 && <ReportEmpty colSpan={6} />}
                {data.movements.map((row, idx) => (
                  <tr key={`${row.voucher_type}-${row.voucher_no}-${idx}`} className="border-b last:border-0">
                    <td className="p-3">{row.posting_date}</td>
                    <td className="p-3">{row.voucher_type} {row.voucher_no}</td>
                    <td className="p-3">{row.account}</td>
                    <td className="p-3 text-right">{formatCurrency(row.debit)}</td>
                    <td className="p-3 text-right">{formatCurrency(row.credit)}</td>
                    <td className="p-3 text-right">{formatCurrency(row.net_change)}</td>
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
