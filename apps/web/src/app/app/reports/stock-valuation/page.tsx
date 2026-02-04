'use client';

import { useState } from 'react';
import { Button, Input } from '@noslag/ui';
import api from '../../../lib/api';
import { ReportAlert, ReportCard, ReportEmpty, ReportFilters, ReportPage, ReportTable } from '../_components/report-shell';

type ValuationRow = {
  itemCode: string;
  warehouseCode: string;
  locationCode?: string | null;
  batchNo?: string | null;
  qty: string;
  stockValue: string;
  avgRate: string;
};

export default function StockValuationPage() {
  const [warehouseCode, setWarehouseCode] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [locationCode, setLocationCode] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [rows, setRows] = useState<ValuationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/v1/inventory/stock-valuation', {
        params: {
          warehouseCode: warehouseCode || undefined,
          itemCode: itemCode || undefined,
          locationCode: locationCode || undefined,
          batchNo: batchNo || undefined,
        },
      });
      setRows(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load stock valuation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ReportPage title="Stock Valuation" description="FIFO layer valuation by location.">
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
          placeholder="Location Code"
          value={locationCode}
          onChange={(e) => setLocationCode(e.target.value)}
        />
        <Input
          placeholder="Batch No"
          value={batchNo}
          onChange={(e) => setBatchNo(e.target.value)}
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
              <th className="text-left p-3">Location</th>
              <th className="text-left p-3">Batch</th>
              <th className="text-right p-3">Qty</th>
              <th className="text-right p-3">Avg Rate</th>
              <th className="text-right p-3">Stock Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <ReportEmpty colSpan={7} />}
            {rows.map((row, idx) => (
              <tr key={`${row.itemCode}-${row.warehouseCode}-${row.locationCode}-${row.batchNo}-${idx}`} className="border-b last:border-0">
                <td className="p-3">{row.itemCode}</td>
                <td className="p-3">{row.warehouseCode}</td>
                <td className="p-3">{row.locationCode ?? '-'}</td>
                <td className="p-3">{row.batchNo ?? '-'}</td>
                <td className="p-3 text-right">{row.qty}</td>
                <td className="p-3 text-right">{row.avgRate}</td>
                <td className="p-3 text-right">{row.stockValue}</td>
              </tr>
            ))}
          </tbody>
        </ReportTable>
      </ReportCard>
    </ReportPage>
  );
}
