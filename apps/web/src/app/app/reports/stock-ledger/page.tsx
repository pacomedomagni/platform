'use client';

import { useState } from 'react';
import { Button, Input } from '@platform/ui';
import { Download } from 'lucide-react';
import api from '../../../../lib/api';
import { ReportAlert, ReportCard, ReportEmpty, ReportFilters, ReportLoading, ReportPage, ReportTable } from '../_components/report-shell';
import { downloadCsv, formatMoney, formatQty } from '../_components/report-format';
import { useUrlFilters } from '@/lib/hooks/use-url-filters';
import { CodeTypeahead } from '../_components/code-typeahead';

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

  useUrlFilters(
    { itemCode, warehouseCode, batchNo, fromDate, toDate },
    {
      itemCode: setItemCode,
      warehouseCode: setWarehouseCode,
      batchNo: setBatchNo,
      fromDate: setFromDate,
      toDate: setToDate,
    },
  );

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

  const handleExport = () => {
    downloadCsv(
      'stock-ledger',
      ['Posting', 'Item', 'Warehouse', 'From', 'To', 'Batch', 'Qty', 'Rate', 'Value', 'Voucher'],
      rows.map((r) => [
        new Date(r.postingTs).toISOString(),
        r.itemCode,
        r.warehouseCode,
        r.fromLocation ?? '',
        r.toLocation ?? '',
        r.batchNo ?? '',
        formatQty(r.qty, 4),
        formatMoney(r.valuationRate),
        formatMoney(r.stockValueDifference),
        `${r.voucherType} ${r.voucherNo}`,
      ]),
    );
  };

  return (
    <ReportPage
      title="Stock Ledger"
      description="All stock movements."
      actions={
        <Button variant="outline" size="sm" onClick={handleExport} disabled={rows.length === 0}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      }
    >
      <ReportFilters className="md:grid-cols-6">
        <CodeTypeahead docType="Item" value={itemCode} onChange={setItemCode} placeholder="Item Code" />
        <CodeTypeahead docType="Warehouse" value={warehouseCode} onChange={setWarehouseCode} placeholder="Warehouse Code" />
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
            {loading && <ReportLoading colSpan={10} />}
            {!loading && rows.length === 0 && <ReportEmpty colSpan={10} />}
            {rows.map((row, idx) => (
              <tr key={`${row.voucherType}-${row.voucherNo}-${idx}`} className="border-b last:border-0">
                <td className="p-3">{new Date(row.postingTs).toLocaleString()}</td>
                <td className="p-3">{row.itemCode}</td>
                <td className="p-3">{row.warehouseCode}</td>
                <td className="p-3">{row.fromLocation ?? '-'}</td>
                <td className="p-3">{row.toLocation ?? '-'}</td>
                <td className="p-3">{row.batchNo ?? '-'}</td>
                <td className="p-3 text-right tabular-nums">{formatQty(row.qty, 4)}</td>
                <td className="p-3 text-right tabular-nums">{formatMoney(row.valuationRate)}</td>
                <td className="p-3 text-right tabular-nums">{formatMoney(row.stockValueDifference)}</td>
                <td className="p-3">{row.voucherType} {row.voucherNo}</td>
              </tr>
            ))}
          </tbody>
        </ReportTable>
      </ReportCard>
    </ReportPage>
  );
}
