'use client';

import { useState } from 'react';
import { Button, Input } from '@noslag/ui';
import api from '../../../lib/api';
import { ReportAlert, ReportCard, ReportEmpty, ReportFilters, ReportPage, ReportTable } from '../_components/report-shell';

type SerialRow = {
  serialNo: string;
  itemCode: string;
  warehouseCode?: string | null;
  locationCode?: string | null;
  batchNo?: string | null;
  status: string;
};

export default function SerialsReportPage() {
  const [itemCode, setItemCode] = useState('');
  const [warehouseCode, setWarehouseCode] = useState('');
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState<SerialRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/v1/inventory/serials', {
        params: {
          itemCode: itemCode || undefined,
          warehouseCode: warehouseCode || undefined,
          status: status || undefined,
        },
      });
      setRows(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load serials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ReportPage title="Serials" description="Serial number status by item and location.">
      <ReportFilters className="md:grid-cols-4">
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
          placeholder="Status (AVAILABLE/ISSUED)"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
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
              <th className="text-left p-3">Serial No</th>
              <th className="text-left p-3">Item</th>
              <th className="text-left p-3">Warehouse</th>
              <th className="text-left p-3">Location</th>
              <th className="text-left p-3">Batch</th>
              <th className="text-left p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <ReportEmpty colSpan={6} />}
            {rows.map((row, idx) => (
              <tr key={`${row.serialNo}-${idx}`} className="border-b last:border-0">
                <td className="p-3">{row.serialNo}</td>
                <td className="p-3">{row.itemCode}</td>
                <td className="p-3">{row.warehouseCode ?? '-'}</td>
                <td className="p-3">{row.locationCode ?? '-'}</td>
                <td className="p-3">{row.batchNo ?? '-'}</td>
                <td className="p-3">{row.status}</td>
              </tr>
            ))}
          </tbody>
        </ReportTable>
      </ReportCard>
    </ReportPage>
  );
}
