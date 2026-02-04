'use client';

import { useState } from 'react';
import { Button, Input, Badge } from '@noslag/ui';
import api from '../../../lib/api';
import { ReportAlert, ReportCard, ReportEmpty, ReportFilters, ReportPage, ReportTable } from '../_components/report-shell';

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

  return (
    <ReportPage title="Reorder Suggestions" description="Items at or below reorder level.">
      <ReportFilters className="md:grid-cols-3">
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
            {rows.length === 0 && <ReportEmpty colSpan={9} />}
            {rows.map((row, idx) => (
              <tr key={`${row.itemCode}-${row.warehouseCode}-${idx}`} className="border-b last:border-0">
                <td className="p-3">{row.itemCode}</td>
                <td className="p-3">{row.warehouseCode}</td>
                <td className="p-3 text-right">{row.actualQty}</td>
                <td className="p-3 text-right">{row.reservedQty}</td>
                <td className="p-3 text-right">{row.availableQty}</td>
                <td className="p-3 text-right">{row.reorderLevel ?? '-'}</td>
                <td className="p-3 text-right">{row.reorderQty ?? '-'}</td>
                <td className="p-3 text-right">{row.suggestedQty}</td>
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
