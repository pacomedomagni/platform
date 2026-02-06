'use client';

import { useState } from 'react';
import { Button, Input, Badge } from '@platform/ui';
import api from '../../../../lib/api';
import { ReportAlert, ReportCard, ReportEmpty, ReportFilters, ReportPage, ReportTable } from '../_components/report-shell';

type ProfitLoss = {
  from_date: string;
  to_date: string;
  income: { accounts: any[]; total: number };
  expenses: { accounts: any[]; total: number };
  net_profit: number;
  net_profit_margin: number;
};

export default function ProfitLossPage() {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [data, setData] = useState<ProfitLoss | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
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
            <td className="p-3 text-right">{Math.abs(row.balance)}</td>
          </tr>
        ))}
      </tbody>
    </ReportTable>
  );

  return (
    <ReportPage title="Profit & Loss" description="Income and expenses.">
      <ReportFilters className="md:grid-cols-3">
        <Input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
        />
        <Input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
        />
        <Button onClick={load} disabled={loading}>
          {loading ? 'Loading...' : 'Load'}
        </Button>
      </ReportFilters>

      {error && <ReportAlert>{error}</ReportAlert>}

      {data && (
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="font-medium">Income</div>
              <Badge variant="secondary">Total: {data.income.total}</Badge>
            </div>
            <ReportCard>{renderRows(data.income.accounts)}</ReportCard>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="font-medium">Expenses</div>
              <Badge variant="secondary">Total: {data.expenses.total}</Badge>
            </div>
            <ReportCard>{renderRows(data.expenses.accounts)}</ReportCard>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span>Net Profit: {data.net_profit}</span>
            <span className="text-muted-foreground">|</span>
            <span>Margin: {data.net_profit_margin.toFixed(2)}%</span>
          </div>
        </div>
      )}
    </ReportPage>
  );
}
