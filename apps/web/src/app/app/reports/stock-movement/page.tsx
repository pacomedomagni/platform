'use client';

import { useState } from 'react';
import { Button, Input } from '@platform/ui';
import { Download } from 'lucide-react';
import api from '../../../../lib/api';
import { ReportAlert, ReportCard, ReportEmpty, ReportFilters, ReportLoading, ReportPage, ReportTable } from '../_components/report-shell';
import { downloadCsv, formatMoney, formatQty } from '../_components/report-format';
import { useUrlFilters } from '@/lib/hooks/use-url-filters';
import { CodeTypeahead } from '../_components/code-typeahead';

type MovementRow = {
  itemCode: string;
  warehouseCode: string;
  inQty: string;
  outQty: string;
  netQty: string;
  stockValue: string;
};

export default function StockMovementPage() {
  const [warehouseCode, setWarehouseCode] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [rows, setRows] = useState<MovementRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useUrlFilters(
    { warehouseCode, itemCode, fromDate, toDate },
    {
      warehouseCode: setWarehouseCode,
      itemCode: setItemCode,
      fromDate: setFromDate,
      toDate: setToDate,
    },
  );

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/v1/inventory/stock-movement', {
        params: {
          warehouseCode: warehouseCode || undefined,
          itemCode: itemCode || undefined,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
        },
      });
      setRows(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load stock movement');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    downloadCsv(
      'stock-movement',
      ['Item', 'Warehouse', 'In Qty', 'Out Qty', 'Net Qty', 'Stock Value'],
      rows.map((r) => [
        r.itemCode,
        r.warehouseCode,
        formatQty(r.inQty, 4),
        formatQty(r.outQty, 4),
        formatQty(r.netQty, 4),
        formatMoney(r.stockValue),
      ]),
    );
  };

  return (
    <ReportPage
      title="Stock Movement"
      description="Summary of in/out movements."
      actions={
        <Button variant="outline" size="sm" onClick={handleExport} disabled={rows.length === 0}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      }
    >
      <ReportFilters className="md:grid-cols-5">
        <CodeTypeahead docType="Warehouse" value={warehouseCode} onChange={setWarehouseCode} placeholder="Warehouse Code" />
        <CodeTypeahead docType="Item" value={itemCode} onChange={setItemCode} placeholder="Item Code" />
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
              <th className="text-left p-3">Item</th>
              <th className="text-left p-3">Warehouse</th>
              <th className="text-right p-3">In Qty</th>
              <th className="text-right p-3">Out Qty</th>
              <th className="text-right p-3">Net Qty</th>
              <th className="text-right p-3">Stock Value</th>
            </tr>
          </thead>
          <tbody>
            {loading && <ReportLoading colSpan={6} />}
            {!loading && rows.length === 0 && <ReportEmpty colSpan={6} />}
            {rows.map((row, idx) => (
              <tr key={`${row.itemCode}-${row.warehouseCode}-${idx}`} className="border-b last:border-0">
                <td className="p-3">{row.itemCode}</td>
                <td className="p-3">{row.warehouseCode}</td>
                <td className="p-3 text-right tabular-nums">{formatQty(row.inQty, 4)}</td>
                <td className="p-3 text-right tabular-nums">{formatQty(row.outQty, 4)}</td>
                <td className="p-3 text-right tabular-nums">{formatQty(row.netQty, 4)}</td>
                <td className="p-3 text-right tabular-nums">{formatMoney(row.stockValue)}</td>
              </tr>
            ))}
          </tbody>
        </ReportTable>
      </ReportCard>
    </ReportPage>
  );
}
