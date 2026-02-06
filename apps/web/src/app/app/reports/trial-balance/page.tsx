'use client';

import { useState } from 'react';
import { Button, Input, Badge } from '@platform/ui';
import api from '../../../../lib/api';
import { ReportAlert, ReportCard, ReportEmpty, ReportFilters, ReportPage, ReportTable } from '../_components/report-shell';

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

export default function TrialBalancePage() {
  const [asOfDate, setAsOfDate] = useState('');
  const [data, setData] = useState<TrialBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
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
  };

  return (
    <ReportPage title="Trial Balance" description="Account totals as of a date.">
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
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span>Total Debit: {data.total_debit}</span>
            <span className="text-muted-foreground">|</span>
            <span>Total Credit: {data.total_credit}</span>
            <span className="text-muted-foreground">|</span>
            <span>Difference: {data.difference}</span>
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
                {data.accounts.length === 0 && <ReportEmpty colSpan={6} />}
                {data.accounts.map((row, idx) => (
                  <tr key={`${row.account}-${idx}`} className="border-b last:border-0">
                    <td className="p-3">{row.account}</td>
                    <td className="p-3">{row.root_type}</td>
                    <td className="p-3">{row.account_type}</td>
                    <td className="p-3 text-right">{row.total_debit}</td>
                    <td className="p-3 text-right">{row.total_credit}</td>
                    <td className="p-3 text-right">{row.balance}</td>
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
