'use client';

import { useState, useEffect } from 'react';
import { Button, Input, Card } from '@platform/ui';
import api from '../../../../lib/api';
import { ReportAlert, ReportCard, ReportEmpty, ReportFilters, ReportPage, ReportTable } from '../../reports/_components/report-shell';
import {
  ArrowUpCircle,
  ArrowDownCircle,
  ArrowLeftRight,
  RefreshCw,
  Plus,
  Filter,
  Download,
} from 'lucide-react';

type MovementRecord = {
  id: string;
  movementType: 'receipt' | 'issue' | 'transfer' | 'adjustment';
  itemCode: string;
  warehouseCode: string;
  fromLocationCode?: string;
  toLocationCode?: string;
  quantity: number;
  referenceNumber?: string;
  reason?: string;
  createdAt: string;
  createdBy?: string;
};

type MovementSummary = {
  totalReceipts: number;
  totalIssues: number;
  totalTransfers: number;
  totalAdjustments: number;
  netMovement: number;
};

const movementTypeConfig = {
  receipt: { icon: ArrowDownCircle, color: 'text-green-600 bg-green-50', label: 'Receipt' },
  issue: { icon: ArrowUpCircle, color: 'text-red-600 bg-red-50', label: 'Issue' },
  transfer: { icon: ArrowLeftRight, color: 'text-blue-600 bg-blue-50', label: 'Transfer' },
  adjustment: { icon: RefreshCw, color: 'text-amber-600 bg-amber-50', label: 'Adjustment' },
};

export default function StockMovementsPage() {
  const [movements, setMovements] = useState<MovementRecord[]>([]);
  const [summary, setSummary] = useState<MovementSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Filters
  const [warehouseCode, setWarehouseCode] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [movementType, setMovementType] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Form state for creating movement
  const [formData, setFormData] = useState({
    movementType: 'receipt' as 'receipt' | 'issue' | 'transfer' | 'adjustment',
    itemCode: '',
    warehouseCode: '',
    fromLocationCode: '',
    toLocationCode: '',
    quantity: 1,
    referenceNumber: '',
    reason: '',
  });

  const loadMovements = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/v1/inventory-management/movements', {
        params: {
          warehouseCode: warehouseCode || undefined,
          itemCode: itemCode || undefined,
          movementType: movementType || undefined,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
        },
      });
      setMovements(res.data.movements || []);
      setSummary(res.data.summary || null);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load stock movements');
    } finally {
      setLoading(false);
    }
  };

  const createMovement = async () => {
    setError(null);
    try {
      await api.post('/v1/inventory-management/movements', formData);
      setShowCreateModal(false);
      setFormData({
        movementType: 'receipt',
        itemCode: '',
        warehouseCode: '',
        fromLocationCode: '',
        toLocationCode: '',
        quantity: 1,
        referenceNumber: '',
        reason: '',
      });
      loadMovements();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to create movement');
    }
  };

  useEffect(() => {
    loadMovements();
  }, []);

  return (
    <ReportPage
      title="Stock Movements"
      description="Track inventory receipts, issues, transfers, and adjustments"
      actions={
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Movement
        </Button>
      }
    >
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="p-4 bg-green-50/50 border-green-200">
            <div className="text-sm text-green-600 font-medium">Receipts</div>
            <div className="text-2xl font-bold text-green-700">{summary.totalReceipts}</div>
          </Card>
          <Card className="p-4 bg-red-50/50 border-red-200">
            <div className="text-sm text-red-600 font-medium">Issues</div>
            <div className="text-2xl font-bold text-red-700">{summary.totalIssues}</div>
          </Card>
          <Card className="p-4 bg-blue-50/50 border-blue-200">
            <div className="text-sm text-blue-600 font-medium">Transfers</div>
            <div className="text-2xl font-bold text-blue-700">{summary.totalTransfers}</div>
          </Card>
          <Card className="p-4 bg-amber-50/50 border-amber-200">
            <div className="text-sm text-amber-600 font-medium">Adjustments</div>
            <div className="text-2xl font-bold text-amber-700">{summary.totalAdjustments}</div>
          </Card>
          <Card className="p-4 bg-slate-50/50 border-slate-200">
            <div className="text-sm text-slate-600 font-medium">Net Movement</div>
            <div className={`text-2xl font-bold ${summary.netMovement >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {summary.netMovement >= 0 ? '+' : ''}{summary.netMovement}
            </div>
          </Card>
        </div>
      )}

      {/* Filters */}
      <ReportFilters className="md:grid-cols-6">
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
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          value={movementType}
          onChange={(e) => setMovementType(e.target.value)}
        >
          <option value="">All Types</option>
          <option value="receipt">Receipt</option>
          <option value="issue">Issue</option>
          <option value="transfer">Transfer</option>
          <option value="adjustment">Adjustment</option>
        </select>
        <Input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          placeholder="From Date"
        />
        <Input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          placeholder="To Date"
        />
        <Button onClick={loadMovements} disabled={loading}>
          {loading ? 'Loading...' : 'Apply Filters'}
        </Button>
      </ReportFilters>

      {error && <ReportAlert>{error}</ReportAlert>}

      {/* Movements Table */}
      <ReportCard>
        <ReportTable>
          <thead className="bg-muted/60 text-muted-foreground">
            <tr>
              <th className="text-left p-3">Type</th>
              <th className="text-left p-3">Item</th>
              <th className="text-left p-3">Warehouse</th>
              <th className="text-left p-3">Location</th>
              <th className="text-right p-3">Quantity</th>
              <th className="text-left p-3">Reference</th>
              <th className="text-left p-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {movements.length === 0 && <ReportEmpty colSpan={7} />}
            {movements.map((movement) => {
              const config = movementTypeConfig[movement.movementType];
              const Icon = config.icon;
              return (
                <tr key={movement.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
                      <Icon className="h-3.5 w-3.5" />
                      {config.label}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-sm">{movement.itemCode}</td>
                  <td className="p-3">{movement.warehouseCode}</td>
                  <td className="p-3 text-sm text-muted-foreground">
                    {movement.movementType === 'transfer'
                      ? `${movement.fromLocationCode || '-'} → ${movement.toLocationCode || '-'}`
                      : movement.toLocationCode || '-'}
                  </td>
                  <td className="p-3 text-right font-mono">
                    <span className={movement.movementType === 'issue' ? 'text-red-600' : ''}>
                      {movement.movementType === 'issue' ? '-' : '+'}{movement.quantity}
                    </span>
                  </td>
                  <td className="p-3 text-sm">{movement.referenceNumber || '-'}</td>
                  <td className="p-3 text-sm text-muted-foreground">
                    {new Date(movement.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </ReportTable>
      </ReportCard>

      {/* Create Movement Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold">Create Stock Movement</h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Movement Type</label>
                <select
                  className="flex h-9 w-full mt-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={formData.movementType}
                  onChange={(e) => setFormData({ ...formData, movementType: e.target.value as any })}
                >
                  <option value="receipt">Receipt</option>
                  <option value="issue">Issue</option>
                  <option value="transfer">Transfer</option>
                  <option value="adjustment">Adjustment</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Quantity</label>
                <Input
                  type="number"
                  min={1}
                  className="mt-1"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Item Code</label>
                <Input
                  className="mt-1"
                  value={formData.itemCode}
                  onChange={(e) => setFormData({ ...formData, itemCode: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Warehouse Code</label>
                <Input
                  className="mt-1"
                  value={formData.warehouseCode}
                  onChange={(e) => setFormData({ ...formData, warehouseCode: e.target.value })}
                />
              </div>
            </div>

            {formData.movementType === 'transfer' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">From Location</label>
                  <Input
                    className="mt-1"
                    value={formData.fromLocationCode}
                    onChange={(e) => setFormData({ ...formData, fromLocationCode: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">To Location</label>
                  <Input
                    className="mt-1"
                    value={formData.toLocationCode}
                    onChange={(e) => setFormData({ ...formData, toLocationCode: e.target.value })}
                  />
                </div>
              </div>
            )}

            {formData.movementType !== 'transfer' && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Location Code</label>
                <Input
                  className="mt-1"
                  value={formData.toLocationCode}
                  onChange={(e) => setFormData({ ...formData, toLocationCode: e.target.value })}
                />
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-muted-foreground">Reference Number</label>
              <Input
                className="mt-1"
                value={formData.referenceNumber}
                onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
                placeholder="PO-001, SO-001, etc."
              />
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Reason / Notes</label>
              <Input
                className="mt-1"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button onClick={createMovement}>
                Create Movement
              </Button>
            </div>
          </Card>
        </div>
      )}
    </ReportPage>
  );
}
