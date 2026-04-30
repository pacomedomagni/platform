'use client';

import { useState } from 'react';
import { Button, Input, NativeSelect } from '@platform/ui';
import { Download } from 'lucide-react';
import api from '../../../../lib/api';
import { ReportAlert, ReportCard, ReportEmpty, ReportFilters, ReportLoading, ReportPage, ReportTable } from '../_components/report-shell';
import { downloadCsv } from '../_components/report-format';
import { useUrlFilters } from '@/lib/hooks/use-url-filters';
import { CodeTypeahead } from '../_components/code-typeahead';

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

  useUrlFilters(
    { itemCode, warehouseCode, status },
    { itemCode: setItemCode, warehouseCode: setWarehouseCode, status: setStatus },
  );

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

  const handleExport = () => {
    downloadCsv(
      'serials',
      ['Serial No', 'Item', 'Warehouse', 'Location', 'Batch', 'Status'],
      rows.map((r) => [
        r.serialNo,
        r.itemCode,
        r.warehouseCode ?? '',
        r.locationCode ?? '',
        r.batchNo ?? '',
        r.status,
      ]),
    );
  };

  return (
    <ReportPage
      title="Serials"
      description="Serial number status by item and location."
      actions={
        <Button variant="outline" size="sm" onClick={handleExport} disabled={rows.length === 0}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      }
    >
      <ReportFilters className="md:grid-cols-4">
        <CodeTypeahead docType="Item" value={itemCode} onChange={setItemCode} placeholder="Item Code" />
        <CodeTypeahead docType="Warehouse" value={warehouseCode} onChange={setWarehouseCode} placeholder="Warehouse Code" />
        {/* SR1: status was a free-text input that silently accepted typos.
            The server enum is small and known — render as a select. */}
        <NativeSelect
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="AVAILABLE">Available</option>
          <option value="ISSUED">Issued</option>
          <option value="RESERVED">Reserved</option>
          <option value="SCRAPPED">Scrapped</option>
        </NativeSelect>
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
            {loading && <ReportLoading colSpan={6} />}
            {!loading && rows.length === 0 && <ReportEmpty colSpan={6} />}
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
