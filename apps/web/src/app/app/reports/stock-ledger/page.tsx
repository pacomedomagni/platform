'use client';

import { useState } from 'react';
import { Button, Input } from '@noslag/ui';
import api from '../../../lib/api';
import { ReportAlert, ReportCard, ReportEmpty, ReportFilters, ReportPage, ReportTable } from '../_components/report-shell';

type LedgerRow = {
  postingTs: string;
  itemCode: string;
  warehouseCode: string;
  fromLocation?: string | null;
  toLocation?: string | null;
  batchNo?: string | null;
  qty: string;
  valuationRate: string;
  stockValueDifference: string;
  voucherType: string;
  voucherNo: string;
};

export default function StockLedgerPage() {
  const [itemCode, setItemCode] = useState('');
  const [warehouseCode, setWarehouseCode] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/v1/inventory/stock-ledger', {
        params: {
          itemCode: itemCode || undefined,
          warehouseCode: warehouseCode || undefined,
          batchNo: batchNo || undefined,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
        },
      });
      setRows(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load stock ledger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ReportPage title="Stock Ledger" description="All stock movements.">
      <ReportFilters className="md:grid-cols-6">
        <Input
          placeholder="Item Code"
          value={itemCode}
          onChange={(e) => setItemCode(e.target.value)}
        />
        <Input
          placeholder="Warehouse Code"
          value={warehouseCode}
          onChange={(e) => setWarehouseCode(e.target.value)}
        />
        <Input
          placeholder="Batch No"
          value={batchNo}
          onChange={(e) => setBatchNo(e.target.value)}
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

      <ReportCard>
        <ReportTable>
          <thead className="bg-muted/60 text-muted-foreground">
            <tr>
              <th className="text-left p-3">Posting</th>
              <th className="text-left p-3">Item</th>
              <th className="text-left p-3">Warehouse</th>
              <th className="text-left p-3">From</th>
              <th className="text-left p-3">To</th>
              <th className="text-left p-3">Batch</th>
              <th className="text-right p-3">Qty</th>
              <th className="text-right p-3">Rate</th>
              <th className="text-right p-3">Value</th>
              <th className="text-left p-3">Voucher</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <ReportEmpty colSpan={10} />}
            {rows.map((row, idx) => (
              <tr key={`${row.voucherType}-${row.voucherNo}-${idx}`} className="border-b last:border-0">
                <td className="p-3">{new Date(row.postingTs).toLocaleString()}</td>
                <td className="p-3">{row.itemCode}</td>
                <td className="p-3">{row.warehouseCode}</td>
                <td className="p-3">{row.fromLocation ?? '-'}</td>
                <td className="p-3">{row.toLocation ?? '-'}</td>
                <td className="p-3">{row.batchNo ?? '-'}</td>
                <td className="p-3 text-right">{row.qty}</td>
                <td className="p-3 text-right">{row.valuationRate}</td>
                <td className="p-3 text-right">{row.stockValueDifference}</td>
                <td className="p-3">{row.voucherType} {row.voucherNo}</td>
              </tr>
            ))}
          </tbody>
        </ReportTable>
      </ReportCard>
    </ReportPage>
  );
}
