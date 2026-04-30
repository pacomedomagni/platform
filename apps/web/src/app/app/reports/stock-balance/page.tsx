'use client';

import { useState } from 'react';
import { Button, Input } from '@platform/ui';
import { Download } from 'lucide-react';
import api from '../../../../lib/api';
import { ReportAlert, ReportCard, ReportEmpty, ReportFilters, ReportLoading, ReportPage, ReportTable } from '../_components/report-shell';
import { downloadCsv, formatQty } from '../_components/report-format';
import { useUrlFilters } from '@/lib/hooks/use-url-filters';
import { CodeTypeahead } from '../_components/code-typeahead';

type BalanceRow = {
  itemCode: string;
  warehouseCode: string;
  locationCode?: string | null;
  batchNo?: string | null;
  actualQty: string;
  reservedQty?: string;
  availableQty?: string;
};

export default function StockBalancePage() {
  const [warehouseCode, setWarehouseCode] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [locationCode, setLocationCode] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [rows, setRows] = useState<BalanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useUrlFilters(
    { warehouseCode, itemCode, locationCode, batchNo },
    {
      warehouseCode: setWarehouseCode,
      itemCode: setItemCode,
      locationCode: setLocationCode,
      batchNo: setBatchNo,
    },
  );

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/v1/inventory/stock-balance', {
        params: {
          warehouseCode: warehouseCode || undefined,
          itemCode: itemCode || undefined,
          locationCode: locationCode || undefined,
          batchNo: batchNo || undefined,
        },
      });
      setRows(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load stock balance');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    downloadCsv(
      'stock-balance',
      ['Item', 'Warehouse', 'Location', 'Batch', 'Actual', 'Reserved', 'Available'],
      rows.map((r) => [
        r.itemCode,
        r.warehouseCode,
        r.locationCode ?? '',
        r.batchNo ?? '',
        formatQty(r.actualQty, 4),
        formatQty(r.reservedQty, 4),
        formatQty(r.availableQty, 4),
      ]),
    );
  };

  return (
    <ReportPage
      title="Stock Balance"
      description="Warehouse or location balances."
      actions={
        <Button variant="outline" size="sm" onClick={handleExport} disabled={rows.length === 0}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      }
    >
      <ReportFilters className="md:grid-cols-5">
        <CodeTypeahead
          docType="Warehouse"
          value={warehouseCode}
          onChange={setWarehouseCode}
          placeholder="Warehouse Code"
        />
        <CodeTypeahead
          docType="Item"
          value={itemCode}
          onChange={setItemCode}
          placeholder="Item Code"
        />
        <CodeTypeahead
          docType="Location"
          value={locationCode}
          onChange={setLocationCode}
          placeholder="Location Code"
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
              <th className="text-right p-3">Actual</th>
              <th className="text-right p-3">Reserved</th>
              <th className="text-right p-3">Available</th>
            </tr>
          </thead>
          <tbody>
            {loading && <ReportLoading colSpan={7} />}
            {!loading && rows.length === 0 && (
              <ReportEmpty colSpan={7} />
            )}
            {rows.map((row, idx) => (
              <tr key={`${row.itemCode}-${row.warehouseCode}-${row.locationCode}-${row.batchNo}-${idx}`} className="border-b last:border-0">
                <td className="p-3">{row.itemCode}</td>
                <td className="p-3">{row.warehouseCode}</td>
                <td className="p-3">{row.locationCode ?? '-'}</td>
                <td className="p-3">{row.batchNo ?? '-'}</td>
                <td className="p-3 text-right tabular-nums">{formatQty(row.actualQty, 4)}</td>
                <td className="p-3 text-right tabular-nums">{row.reservedQty ? formatQty(row.reservedQty, 4) : '-'}</td>
                <td className="p-3 text-right tabular-nums">{row.availableQty ? formatQty(row.availableQty, 4) : '-'}</td>
              </tr>
            ))}
          </tbody>
        </ReportTable>
      </ReportCard>
    </ReportPage>
  );
}
