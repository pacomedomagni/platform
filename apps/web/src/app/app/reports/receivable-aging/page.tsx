'use client';

import { useState } from 'react';
import { Button, Input, Badge } from '@platform/ui';
import api from '../../../../lib/api';
import { ReportAlert, ReportCard, ReportEmpty, ReportFilters, ReportPage, ReportTable } from '../_components/report-shell';

type AgingBucket = {
  name: string;
  customer: string;
  posting_date: string;
  due_date: string;
  grand_total: number;
  outstanding_amount: number;
  days_overdue: number;
};

type AgingResponse = {
  as_of_date: string;
  aged: Record<string, AgingBucket[]>;
  totals: Record<string, number>;
};

export default function ReceivableAgingPage() {
  const [asOfDate, setAsOfDate] = useState('');
  const [data, setData] = useState<AgingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/v1/reports/receivable-aging', {
        params: { asOfDate: asOfDate || undefined },
      });
      setData(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load receivable aging');
    } finally {
      setLoading(false);
    }
  };

  const buckets = data ? Object.keys(data.aged) : [];

  return (
    <ReportPage title="Receivable Aging" description="Open customer invoices by age.">
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
          {buckets.map((bucket) => (
            <div key={bucket} className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="font-medium">{bucket}</div>
                <Badge variant="secondary">Total: {data.totals[bucket] ?? 0}</Badge>
              </div>
              <ReportCard>
                <ReportTable>
                  <thead className="bg-muted/60 text-muted-foreground">
                    <tr>
                      <th className="text-left p-3">Invoice</th>
                      <th className="text-left p-3">Customer</th>
                      <th className="text-left p-3">Posting</th>
                      <th className="text-left p-3">Due</th>
                      <th className="text-right p-3">Outstanding</th>
                      <th className="text-right p-3">Days Overdue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.aged[bucket].length === 0 && <ReportEmpty colSpan={6} />}
                    {data.aged[bucket].map((row, idx) => (
                      <tr key={`${row.name}-${idx}`} className="border-b last:border-0">
                        <td className="p-3">{row.name}</td>
                        <td className="p-3">{row.customer}</td>
                        <td className="p-3">{row.posting_date}</td>
                        <td className="p-3">{row.due_date}</td>
                        <td className="p-3 text-right">{row.outstanding_amount}</td>
                        <td className="p-3 text-right">{row.days_overdue}</td>
                      </tr>
                    ))}
                  </tbody>
                </ReportTable>
              </ReportCard>
            </div>
          ))}
        </div>
      )}
    </ReportPage>
  );
}
