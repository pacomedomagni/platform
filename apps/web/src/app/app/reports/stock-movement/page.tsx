'use client';

import { useState } from 'react';
import { Button, Input } from '@noslag/ui';
import api from '../../../lib/api';
import { ReportAlert, ReportCard, ReportEmpty, ReportFilters, ReportPage, ReportTable } from '../_components/report-shell';

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

  return (
    <ReportPage title="Stock Movement" description="Summary of in/out movements.">
      <ReportFilters className="md:grid-cols-5">
        <Input
          placeholder="Warehouse Code"
          value={warehouseCode}
          onChange={(e) => setWarehouseCode(e.target.value)}
        />
        <Input
          placeholder="Item Code"
          value={itemCode}
          onChange={(e) => setItemCode(e.target.value)}
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
              <th className="text-left p-3">Item</th>
              <th className="text-left p-3">Warehouse</th>
              <th className="text-right p-3">In Qty</th>
              <th className="text-right p-3">Out Qty</th>
              <th className="text-right p-3">Net Qty</th>
              <th className="text-right p-3">Stock Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <ReportEmpty colSpan={6} />}
            {rows.map((row, idx) => (
              <tr key={`${row.itemCode}-${row.warehouseCode}-${idx}`} className="border-b last:border-0">
                <td className="p-3">{row.itemCode}</td>
                <td className="p-3">{row.warehouseCode}</td>
                <td className="p-3 text-right">{row.inQty}</td>
                <td className="p-3 text-right">{row.outQty}</td>
                <td className="p-3 text-right">{row.netQty}</td>
                <td className="p-3 text-right">{row.stockValue}</td>
              </tr>
            ))}
          </tbody>
        </ReportTable>
      </ReportCard>
    </ReportPage>
  );
}
