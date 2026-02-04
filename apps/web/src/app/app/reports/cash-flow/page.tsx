'use client';

import { useState } from 'react';
import { Button, Input } from '@noslag/ui';
import api from '../../../lib/api';
import { ReportAlert, ReportCard, ReportEmpty, ReportFilters, ReportPage, ReportTable } from '../_components/report-shell';

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

export default function CashFlowPage() {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [data, setData] = useState<CashFlow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
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
  };

  return (
    <ReportPage title="Cash Flow" description="Cash account movements.">
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
        <div className="space-y-3">
          <div className="text-sm text-slate-600">
            Inflow: {data.cash_inflow} | Outflow: {data.cash_outflow} | Net: {data.net_cash_change}
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
                    <td className="p-3 text-right">{row.debit}</td>
                    <td className="p-3 text-right">{row.credit}</td>
                    <td className="p-3 text-right">{row.net_change}</td>
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
