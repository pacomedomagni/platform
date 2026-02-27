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
} from 'lucide-react';

// Matches backend queryMovements response shape
type MovementRecord = {
  id: string;
  postingDate: string;
  postingTs: string;
  voucherType: string;
  voucherNo: string;
  itemCode: string;
  itemName: string;
  warehouseCode: string;
  fromLocation?: string;
  toLocation?: string;
  batchNo?: string;
  qty: number;
  rate: number;
  value: number;
};

// Matches backend getMovementSummary response shape
type MovementSummary = Record<string, {
  count: number;
  totalQty: number;
  totalValue: number;
}>;

const voucherTypeConfig: Record<string, { icon: typeof ArrowDownCircle; color: string; label: string }> = {
  'Stock Receipt': { icon: ArrowDownCircle, color: 'text-green-600 bg-green-50', label: 'Receipt' },
  'Stock Issue': { icon: ArrowUpCircle, color: 'text-red-600 bg-red-50', label: 'Issue' },
  'Stock Transfer': { icon: ArrowLeftRight, color: 'text-blue-600 bg-blue-50', label: 'Transfer' },
  'Stock Adjustment': { icon: RefreshCw, color: 'text-amber-600 bg-amber-50', label: 'Adjustment' },
};

const defaultConfig = { icon: RefreshCw, color: 'text-slate-600 bg-slate-50', label: 'Unknown' };

export default function StockMovementsPage() {
  const [movements, setMovements] = useState<MovementRecord[]>([]);
  const [summary, setSummary] = useState<MovementSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [pagination, setPagination] = useState<{ total: number; limit: number; offset: number } | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  // Filters
  const [warehouseCode, setWarehouseCode] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [movementType, setMovementType] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Form state for creating movement
  // Backend DTO uses `items[]` array with `reference` and `remarks` fields
  const [formData, setFormData] = useState({
    movementType: 'receipt' as 'receipt' | 'issue' | 'transfer' | 'adjustment',
    itemCode: '',
    warehouseCode: '',
    toWarehouseCode: '',
    fromLocationCode: '',
    toLocationCode: '',
    quantity: 1,
    reference: '',
    remarks: '',
  });

  const loadMovements = async () => {
    setLoading(true);
    setError(null);
    try {
      const [movementsRes, summaryRes] = await Promise.all([
        api.get('/v1/inventory-management/movements', {
          params: {
            warehouseCode: warehouseCode || undefined,
            itemCode: itemCode || undefined,
            movementType: movementType || undefined,
            fromDate: fromDate || undefined,
            toDate: toDate || undefined,
            limit: PAGE_SIZE,
            offset: page * PAGE_SIZE,
          },
        }),
        api.get('/v1/inventory-management/movements/summary', {
          params: {
            startDate: fromDate || undefined,
            endDate: toDate || undefined,
          },
        }),
      ]);
      // Backend returns { data: [...], total, limit, offset }
      setMovements(movementsRes.data.data || []);
      setSummary(summaryRes.data || null);
      if (movementsRes.data.total !== undefined) {
        setPagination({
          total: movementsRes.data.total,
          limit: movementsRes.data.limit || PAGE_SIZE,
          offset: movementsRes.data.offset || 0,
        });
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message || 'Failed to load stock movements');
    } finally {
      setLoading(false);
    }
  };

  const createMovement = async () => {
    setError(null);
    try {
      // Map frontend form to backend CreateStockMovementDto shape
      const payload = {
        movementType: formData.movementType,
        warehouseCode: formData.warehouseCode,
        toWarehouseCode: formData.movementType === 'transfer' ? formData.toWarehouseCode : undefined,
        reference: formData.reference || undefined,
        remarks: formData.remarks || undefined,
        items: [
          {
            itemCode: formData.itemCode,
            quantity: formData.quantity,
            locationCode: formData.fromLocationCode || formData.toLocationCode || undefined,
            toLocationCode: formData.movementType === 'transfer' ? formData.toLocationCode || undefined : undefined,
          },
        ],
      };
      await api.post('/v1/inventory-management/movements', payload);
      setShowCreateModal(false);
      setFormData({
        movementType: 'receipt',
        itemCode: '',
        warehouseCode: '',
        toWarehouseCode: '',
        fromLocationCode: '',
        toLocationCode: '',
        quantity: 1,
        reference: '',
        remarks: '',
      });
      loadMovements();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message || 'Failed to create movement');
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps -- loadMovements depends on filter state; we only want initial load
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
      {summary && Object.keys(summary).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 bg-green-50/50 border-green-200">
            <div className="text-sm text-green-600 font-medium">Receipts</div>
            <div className="text-2xl font-bold text-green-700">{summary['Stock Receipt']?.count || 0}</div>
            <div className="text-xs text-green-600">Qty: {summary['Stock Receipt']?.totalQty || 0}</div>
          </Card>
          <Card className="p-4 bg-red-50/50 border-red-200">
            <div className="text-sm text-red-600 font-medium">Issues</div>
            <div className="text-2xl font-bold text-red-700">{summary['Stock Issue']?.count || 0}</div>
            <div className="text-xs text-red-600">Qty: {summary['Stock Issue']?.totalQty || 0}</div>
          </Card>
          <Card className="p-4 bg-blue-50/50 border-blue-200">
            <div className="text-sm text-blue-600 font-medium">Transfers</div>
            <div className="text-2xl font-bold text-blue-700">{summary['Stock Transfer']?.count || 0}</div>
            <div className="text-xs text-blue-600">Qty: {summary['Stock Transfer']?.totalQty || 0}</div>
          </Card>
          <Card className="p-4 bg-amber-50/50 border-amber-200">
            <div className="text-sm text-amber-600 font-medium">Adjustments</div>
            <div className="text-2xl font-bold text-amber-700">{summary['Stock Adjustment']?.count || 0}</div>
            <div className="text-xs text-amber-600">Qty: {summary['Stock Adjustment']?.totalQty || 0}</div>
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
              <th className="text-left p-3">Voucher</th>
              <th className="text-left p-3">Item</th>
              <th className="text-left p-3">Warehouse</th>
              <th className="text-left p-3">Location</th>
              <th className="text-right p-3">Quantity</th>
              <th className="text-right p-3">Rate</th>
              <th className="text-left p-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {movements.length === 0 && <ReportEmpty colSpan={8} />}
            {movements.map((movement) => {
              const config = voucherTypeConfig[movement.voucherType] || defaultConfig;
              const Icon = config.icon;
              return (
                <tr key={movement.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
                      <Icon className="h-3.5 w-3.5" />
                      {config.label}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-xs">{movement.voucherNo}</td>
                  <td className="p-3 font-mono text-sm">{movement.itemCode}</td>
                  <td className="p-3">{movement.warehouseCode}</td>
                  <td className="p-3 text-sm text-muted-foreground">
                    {movement.voucherType === 'Stock Transfer'
                      ? `${movement.fromLocation || '-'} -> ${movement.toLocation || '-'}`
                      : movement.fromLocation || movement.toLocation || '-'}
                  </td>
                  <td className="p-3 text-right font-mono">
                    <span className={movement.qty < 0 ? 'text-red-600' : ''}>
                      {movement.qty > 0 ? '+' : ''}{movement.qty}
                    </span>
                  </td>
                  <td className="p-3 text-right font-mono text-sm">{movement.rate.toFixed(2)}</td>
                  <td className="p-3 text-sm text-muted-foreground">
                    {movement.postingDate}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </ReportTable>
        {/* Pagination Controls */}
        {pagination && pagination.total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t p-3">
            <span className="text-sm text-muted-foreground">
              Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, pagination.total)} of {pagination.total}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setPage((p) => Math.max(0, p - 1)); loadMovements(); }}
                disabled={page === 0}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setPage((p) => p + 1); loadMovements(); }}
                disabled={(page + 1) * PAGE_SIZE >= pagination.total}
              >
                Next
              </Button>
            </div>
          </div>
        )}
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
                  onChange={(e) => setFormData({ ...formData, movementType: e.target.value as 'receipt' | 'issue' | 'transfer' | 'adjustment' })}
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
                <label className="text-sm font-medium text-muted-foreground">
                  {formData.movementType === 'transfer' ? 'Source Warehouse Code' : 'Warehouse Code'}
                </label>
                <Input
                  className="mt-1"
                  value={formData.warehouseCode}
                  onChange={(e) => setFormData({ ...formData, warehouseCode: e.target.value })}
                />
              </div>
            </div>

            {formData.movementType === 'transfer' && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Destination Warehouse Code</label>
                <Input
                  className="mt-1"
                  value={formData.toWarehouseCode}
                  onChange={(e) => setFormData({ ...formData, toWarehouseCode: e.target.value })}
                  placeholder="Must be different from source warehouse"
                />
              </div>
            )}

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
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                placeholder="PO-001, SO-001, etc."
              />
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Reason / Notes</label>
              <Input
                className="mt-1"
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
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
