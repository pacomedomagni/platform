'use client';

import { useState } from 'react';
import { Button, Input } from '@noslag/ui';
import api from '../../../lib/api';
import { ReportAlert, ReportCard, ReportEmpty, ReportFilters, ReportPage, ReportTable } from '../_components/report-shell';

type AgingBucket = {
  label: string;
  qty: string;
  stockValue: string;
};

type AgingRow = {
  itemCode: string;
  warehouseCode: string;
  locationCode?: string | null;
  batchNo?: string | null;
  buckets: AgingBucket[];
};

export default function StockAgingPage() {
  const [warehouseCode, setWarehouseCode] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [locationCode, setLocationCode] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [asOfDate, setAsOfDate] = useState('');
  const [bucketDays, setBucketDays] = useState('30,60,90');
  const [rows, setRows] = useState<AgingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/v1/inventory/stock-aging', {
        params: {
          warehouseCode: warehouseCode || undefined,
          itemCode: itemCode || undefined,
          locationCode: locationCode || undefined,
          batchNo: batchNo || undefined,
          asOfDate: asOfDate || undefined,
          bucketDays: bucketDays || undefined,
        },
      });
      setRows(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load stock aging');
    } finally {
      setLoading(false);
    }
  };

  const bucketLabels = rows[0]?.buckets?.map((b) => b.label) ?? [];

  return (
    <ReportPage title="Stock Aging" description="Age buckets by FIFO layer posting date.">
      <ReportFilters className="md:grid-cols-7">
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
        <Input
          type="date"
          value={asOfDate}
          onChange={(e) => setAsOfDate(e.target.value)}
        />
        <Input
          placeholder="Bucket days (e.g. 30,60,90)"
          value={bucketDays}
          onChange={(e) => setBucketDays(e.target.value)}
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
              {bucketLabels.map((label) => (
                <th key={`${label}-qty`} className="text-right p-3">{label} Qty</th>
              ))}
              {bucketLabels.map((label) => (
                <th key={`${label}-value`} className="text-right p-3">{label} Value</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <ReportEmpty colSpan={4 + bucketLabels.length * 2} />
            )}
            {rows.map((row, idx) => (
              <tr key={`${row.itemCode}-${row.warehouseCode}-${row.locationCode}-${row.batchNo}-${idx}`} className="border-b last:border-0">
                <td className="p-3">{row.itemCode}</td>
                <td className="p-3">{row.warehouseCode}</td>
                <td className="p-3">{row.locationCode ?? '-'}</td>
                <td className="p-3">{row.batchNo ?? '-'}</td>
                {row.buckets.map((bucket, bIdx) => (
                  <td key={`${idx}-qty-${bIdx}`} className="p-3 text-right">{bucket.qty}</td>
                ))}
                {row.buckets.map((bucket, bIdx) => (
                  <td key={`${idx}-value-${bIdx}`} className="p-3 text-right">{bucket.stockValue}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </ReportTable>
      </ReportCard>
    </ReportPage>
  );
}
