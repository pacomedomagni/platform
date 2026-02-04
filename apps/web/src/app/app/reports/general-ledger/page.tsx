'use client';

import { useState } from 'react';
import { Button, Input } from '@noslag/ui';
import api from '../../../lib/api';
import { ReportAlert, ReportCard, ReportEmpty, ReportFilters, ReportPage, ReportTable } from '../_components/report-shell';

type LedgerEntry = {
  posting_date: string;
  voucher_type: string;
  voucher_no: string;
  party_type?: string;
  party?: string;
  against?: string;
  debit: number;
  credit: number;
  remarks?: string;
  balance: number;
};

type LedgerData = {
  account: string;
  from_date: string;
  to_date: string;
  entries: LedgerEntry[];
  total_debit: number;
  total_credit: number;
  closing_balance: number;
};

export default function GeneralLedgerPage() {
  const [account, setAccount] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [data, setData] = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/v1/reports/general-ledger', {
        params: {
          account: account || undefined,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
        },
      });
      setData(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load general ledger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ReportPage title="General Ledger" description="Account transactions with running balance.">
      <ReportFilters className="md:grid-cols-5">
        <Input
          placeholder="Account"
          value={account}
          onChange={(e) => setAccount(e.target.value)}
        />
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
            Total Debit: {data.total_debit} | Total Credit: {data.total_credit} | Closing: {data.closing_balance}
          </div>
          <ReportCard>
            <ReportTable>
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Posting Date</th>
                  <th className="text-left p-3">Voucher</th>
                  <th className="text-left p-3">Party</th>
                  <th className="text-left p-3">Against</th>
                  <th className="text-right p-3">Debit</th>
                  <th className="text-right p-3">Credit</th>
                  <th className="text-left p-3">Remarks</th>
                  <th className="text-right p-3">Balance</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.length === 0 && <ReportEmpty colSpan={8} />}
                {data.entries.map((row, idx) => (
                  <tr key={`${row.voucher_type}-${row.voucher_no}-${idx}`} className="border-b last:border-0">
                    <td className="p-3">{row.posting_date}</td>
                    <td className="p-3">{row.voucher_type} {row.voucher_no}</td>
                    <td className="p-3">{row.party ?? '-'}</td>
                    <td className="p-3">{row.against ?? '-'}</td>
                    <td className="p-3 text-right">{row.debit}</td>
                    <td className="p-3 text-right">{row.credit}</td>
                    <td className="p-3">{row.remarks ?? '-'}</td>
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
