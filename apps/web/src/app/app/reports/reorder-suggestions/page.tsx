'use client';

import { useState } from 'react';
import { Button, Input, Badge } from '@platform/ui';
import { Download } from 'lucide-react';
import api from '../../../../lib/api';
import { ReportAlert, ReportCard, ReportEmpty, ReportFilters, ReportLoading, ReportPage, ReportTable } from '../_components/report-shell';
import { downloadCsv, formatQty } from '../_components/report-format';
import { useUrlFilters } from '@/lib/hooks/use-url-filters';
import { CodeTypeahead } from '../_components/code-typeahead';

type ReorderRow = {
  itemCode: string;
  warehouseCode: string;
  actualQty: string;
  reservedQty: string;
  availableQty: string;
  reorderLevel: string | null;
  reorderQty: string | null;
  suggestedQty: string;
  shouldReorder: boolean;
};

export default function ReorderSuggestionsPage() {
  const [warehouseCode, setWarehouseCode] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [rows, setRows] = useState<ReorderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useUrlFilters(
    { warehouseCode, itemCode },
    { warehouseCode: setWarehouseCode, itemCode: setItemCode },
  );

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/v1/inventory/reorder-suggestions', {
        params: {
          warehouseCode: warehouseCode || undefined,
          itemCode: itemCode || undefined,
        },
      });
      setRows(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load reorder suggestions');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    downloadCsv(
      'reorder-suggestions',
      ['Item', 'Warehouse', 'Actual', 'Reserved', 'Available', 'Reorder Level', 'Reorder Qty', 'Suggested Qty', 'Action'],
      rows.map((r) => [
        r.itemCode,
        r.warehouseCode,
        formatQty(r.actualQty, 4),
        formatQty(r.reservedQty, 4),
        formatQty(r.availableQty, 4),
        r.reorderLevel != null ? formatQty(r.reorderLevel, 4) : '',
        r.reorderQty != null ? formatQty(r.reorderQty, 4) : '',
        formatQty(r.suggestedQty, 4),
        r.shouldReorder ? 'Reorder' : 'OK',
      ]),
    );
  };

  return (
    <ReportPage
      title="Reorder Suggestions"
      description="Items at or below reorder level."
      actions={
        <Button variant="outline" size="sm" onClick={handleExport} disabled={rows.length === 0}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      }
    >
      <ReportFilters className="md:grid-cols-3">
        <CodeTypeahead docType="Warehouse" value={warehouseCode} onChange={setWarehouseCode} placeholder="Warehouse Code" />
        <CodeTypeahead docType="Item" value={itemCode} onChange={setItemCode} placeholder="Item Code" />
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
              <th className="text-right p-3">Actual</th>
              <th className="text-right p-3">Reserved</th>
              <th className="text-right p-3">Available</th>
              <th className="text-right p-3">Reorder Level</th>
              <th className="text-right p-3">Reorder Qty</th>
              <th className="text-right p-3">Suggested Qty</th>
              <th className="text-left p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && <ReportLoading colSpan={9} />}
            {!loading && rows.length === 0 && <ReportEmpty colSpan={9} />}
            {rows.map((row, idx) => (
              <tr key={`${row.itemCode}-${row.warehouseCode}-${idx}`} className="border-b last:border-0">
                <td className="p-3">{row.itemCode}</td>
                <td className="p-3">{row.warehouseCode}</td>
                <td className="p-3 text-right tabular-nums">{formatQty(row.actualQty, 4)}</td>
                <td className="p-3 text-right tabular-nums">{formatQty(row.reservedQty, 4)}</td>
                <td className="p-3 text-right tabular-nums">{formatQty(row.availableQty, 4)}</td>
                <td className="p-3 text-right tabular-nums">{row.reorderLevel != null ? formatQty(row.reorderLevel, 4) : '-'}</td>
                <td className="p-3 text-right tabular-nums">{row.reorderQty != null ? formatQty(row.reorderQty, 4) : '-'}</td>
                <td className="p-3 text-right tabular-nums">{formatQty(row.suggestedQty, 4)}</td>
                <td className="p-3">
                  {row.shouldReorder ? <Badge variant="warning">Reorder</Badge> : <Badge variant="secondary">OK</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </ReportTable>
      </ReportCard>
    </ReportPage>
  );
}
