'use client';

import { useState } from 'react';
import { Button, Input, Badge } from '@platform/ui';
import api from '../../../../lib/api';
import { ReportAlert, ReportCard, ReportEmpty, ReportFilters, ReportPage, ReportTable } from '../_components/report-shell';

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

  return (
    <ReportPage title="Locations" description="Warehouse location tree.">
      <ReportFilters className="md:grid-cols-3">
        <Input
          placeholder="Warehouse Code"
          value={warehouseCode}
          onChange={(e) => setWarehouseCode(e.target.value)}
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
            {rows.length === 0 && <ReportEmpty colSpan={7} />}
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
