'use client';

import { useState } from 'react';
import { Button, Input, Badge } from '@noslag/ui';
import api from '../../../lib/api';
import { ReportAlert, ReportCard, ReportEmpty, ReportFilters, ReportPage, ReportTable } from '../_components/report-shell';

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

export default function BalanceSheetPage() {
  const [asOfDate, setAsOfDate] = useState('');
  const [data, setData] = useState<BalanceSheet | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
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
  };

  const renderSection = (label: string, section: BalanceSection) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="font-medium">{label}</div>
        <Badge variant="secondary">Total: {section.total}</Badge>
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
            {section.accounts.length === 0 && <ReportEmpty colSpan={2} />}
            {section.accounts.map((row, idx) => (
              <tr key={`${row.account}-${idx}`} className="border-b last:border-0">
                <td className="p-3">{row.account}</td>
                <td className="p-3 text-right">{Math.abs(row.balance)}</td>
              </tr>
            ))}
          </tbody>
        </ReportTable>
      </ReportCard>
    </div>
  );

  return (
    <ReportPage title="Balance Sheet" description="Assets, liabilities, and equity.">
      <ReportFilters className="md:grid-cols-3">
        <Input
          type="date"
          value={asOfDate}
          onChange={(e) => setAsOfDate(e.target.value)}
        />
        <Button onClick={load} disabled={loading}>
          {loading ? 'Loading...' : 'Load'}
        </Button>
      </ReportFilters>

      {error && <ReportAlert>{error}</ReportAlert>}

      {data && (
        <div className="space-y-4">
          {renderSection('Assets', data.assets)}
          {renderSection('Liabilities', data.liabilities)}
          {renderSection('Equity', data.equity)}
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span>Total Liabilities + Equity: {data.total_liabilities_and_equity}</span>
            <Badge variant={data.balanced ? 'success' : 'warning'}>
              {data.balanced ? 'Balanced' : 'Unbalanced'}
            </Badge>
          </div>
        </div>
      )}
    </ReportPage>
  );
}
