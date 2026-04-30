'use client';

import { useState } from 'react';
import { Button, Input, Badge } from '@platform/ui';
import { Download } from 'lucide-react';
import api from '../../../../lib/api';
import { ReportAlert, ReportCard, ReportEmpty, ReportFilters, ReportLoading, ReportPage, ReportTable } from '../_components/report-shell';
import { downloadCsv } from '../_components/report-format';
import { useUrlFilters } from '@/lib/hooks/use-url-filters';
import { CodeTypeahead } from '../_components/code-typeahead';

type LocationRow = {
  code: string;
  name?: string | null;
  path: string;
  warehouseId: string;
  isPickable: boolean;
  isPutaway: boolean;
  isStaging: boolean;
  isActive: boolean;
};

export default function LocationsReportPage() {
  const [warehouseCode, setWarehouseCode] = useState('');
  const [rows, setRows] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useUrlFilters({ warehouseCode }, { warehouseCode: setWarehouseCode });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/v1/inventory/locations', {
        params: { warehouseCode: warehouseCode || undefined },
      });
      setRows(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load locations');
    } finally {
      setLoading(false);
    }
  };

  const indentForPath = (path: string) => {
    const depth = path.split('/').length - 1;
    return { paddingLeft: `${depth * 16}px` };
  };

  const handleExport = () => {
    downloadCsv(
      'locations',
      ['Location', 'Code', 'Path', 'Pickable', 'Putaway', 'Staging', 'Active'],
      rows.map((r) => [
        r.name ?? r.code,
        r.code,
        r.path,
        r.isPickable ? 'Yes' : 'No',
        r.isPutaway ? 'Yes' : 'No',
        r.isStaging ? 'Yes' : 'No',
        r.isActive ? 'Active' : 'Inactive',
      ]),
    );
  };

  return (
    <ReportPage
      title="Locations"
      description="Warehouse location tree."
      actions={
        <Button variant="outline" size="sm" onClick={handleExport} disabled={rows.length === 0}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      }
    >
      <ReportFilters className="md:grid-cols-3">
        <CodeTypeahead docType="Warehouse" value={warehouseCode} onChange={setWarehouseCode} placeholder="Warehouse Code" />
        <Button onClick={load} disabled={loading}>
          {loading ? 'Loading...' : 'Load'}
        </Button>
      </ReportFilters>

      {error && <ReportAlert>{error}</ReportAlert>}

      <ReportCard>
        <ReportTable>
          <thead className="bg-muted/60 text-muted-foreground">
            <tr>
              <th className="text-left p-3">Location</th>
              <th className="text-left p-3">Code</th>
              <th className="text-left p-3">Path</th>
              <th className="text-center p-3">Pickable</th>
              <th className="text-center p-3">Putaway</th>
              <th className="text-center p-3">Staging</th>
              <th className="text-center p-3">Active</th>
            </tr>
          </thead>
          <tbody>
            {loading && <ReportLoading colSpan={7} />}
            {!loading && rows.length === 0 && <ReportEmpty colSpan={7} />}
            {rows.map((row, idx) => (
              <tr key={`${row.code}-${idx}`} className="border-b last:border-0">
                <td className="p-3" style={indentForPath(row.path)}>{row.name ?? row.code}</td>
                <td className="p-3">{row.code}</td>
                <td className="p-3">{row.path}</td>
                <td className="p-3 text-center">{row.isPickable ? <Badge variant="success">Yes</Badge> : <Badge variant="outline">No</Badge>}</td>
                <td className="p-3 text-center">{row.isPutaway ? <Badge variant="success">Yes</Badge> : <Badge variant="outline">No</Badge>}</td>
                <td className="p-3 text-center">{row.isStaging ? <Badge variant="warning">Yes</Badge> : <Badge variant="outline">No</Badge>}</td>
                <td className="p-3 text-center">{row.isActive ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">Inactive</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </ReportTable>
      </ReportCard>
    </ReportPage>
  );
}
