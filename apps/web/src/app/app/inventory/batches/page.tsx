'use client';

import { useState, useEffect } from 'react';
import { Button, Input, Card, Badge } from '@platform/ui';
import api from '../../../../lib/api';
import { ReportAlert, ReportCard, ReportEmpty, ReportFilters, ReportPage, ReportTable } from '../../reports/_components/report-shell';
import {
  Package,
  Plus,
  Calendar,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Edit2,
} from 'lucide-react';

type BatchRecord = {
  id: string;
  batchNumber: string;
  itemCode: string;
  warehouseCode: string;
  quantity: number;
  manufacturingDate?: string;
  expiryDate?: string;
  status: 'available' | 'reserved' | 'expired' | 'quarantine';
  supplierCode?: string;
  notes?: string;
  createdAt: string;
};

const statusConfig = {
  available: { icon: CheckCircle, color: 'bg-green-50 text-green-700 border-green-200', label: 'Available' },
  reserved: { icon: Package, color: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Reserved' },
  expired: { icon: XCircle, color: 'bg-red-50 text-red-700 border-red-200', label: 'Expired' },
  quarantine: { icon: AlertTriangle, color: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Quarantine' },
};

export default function BatchTrackingPage() {
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [expiringBatches, setExpiringBatches] = useState<BatchRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingBatch, setEditingBatch] = useState<BatchRecord | null>(null);

  // Filters
  const [itemCode, setItemCode] = useState('');
  const [warehouseCode, setWarehouseCode] = useState('');
  const [status, setStatus] = useState('');
  const [daysToExpiry, setDaysToExpiry] = useState('30');

  // Form state
  const [formData, setFormData] = useState({
    batchNumber: '',
    itemCode: '',
    warehouseCode: '',
    quantity: 1,
    manufacturingDate: '',
    expiryDate: '',
    status: 'available' as 'available' | 'reserved' | 'expired' | 'quarantine',
    supplierCode: '',
    notes: '',
  });

  const loadBatches = async () => {
    setLoading(true);
    setError(null);
    try {
      const [batchesRes, expiringRes] = await Promise.all([
        api.get('/v1/inventory-management/batches', {
          params: {
            itemCode: itemCode || undefined,
            warehouseCode: warehouseCode || undefined,
            status: status || undefined,
          },
        }),
        api.get('/v1/inventory-management/batches/expiring', {
          params: { days: parseInt(daysToExpiry) || 30 },
        }),
      ]);
      setBatches(batchesRes.data || []);
      setExpiringBatches(expiringRes.data || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load batches');
    } finally {
      setLoading(false);
    }
  };

  const createBatch = async () => {
    setError(null);
    try {
      await api.post('/v1/inventory-management/batches', formData);
      setShowCreateModal(false);
      resetForm();
      loadBatches();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to create batch');
    }
  };

  const updateBatch = async () => {
    if (!editingBatch) return;
    setError(null);
    try {
      await api.put(`/v1/inventory-management/batches/${editingBatch.id}`, formData);
      setEditingBatch(null);
      resetForm();
      loadBatches();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to update batch');
    }
  };

  const resetForm = () => {
    setFormData({
      batchNumber: '',
      itemCode: '',
      warehouseCode: '',
      quantity: 1,
      manufacturingDate: '',
      expiryDate: '',
      status: 'available',
      supplierCode: '',
      notes: '',
    });
  };

  const openEditModal = (batch: BatchRecord) => {
    setEditingBatch(batch);
    setFormData({
      batchNumber: batch.batchNumber,
      itemCode: batch.itemCode,
      warehouseCode: batch.warehouseCode,
      quantity: batch.quantity,
      manufacturingDate: batch.manufacturingDate?.split('T')[0] || '',
      expiryDate: batch.expiryDate?.split('T')[0] || '',
      status: batch.status,
      supplierCode: batch.supplierCode || '',
      notes: batch.notes || '',
    });
  };

  useEffect(() => {
    loadBatches();
  }, []);

  const getDaysUntilExpiry = (expiryDate?: string) => {
    if (!expiryDate) return null;
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <ReportPage
      title="Batch Tracking"
      description="Manage product batches with expiry dates and traceability"
      actions={
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Batch
        </Button>
      }
    >
      {/* Expiring Soon Alert */}
      {expiringBatches.length > 0 && (
        <Card className="p-4 bg-amber-50/50 border-amber-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-amber-800">
                {expiringBatches.length} batch{expiringBatches.length !== 1 ? 'es' : ''} expiring within {daysToExpiry} days
              </h3>
              <p className="text-sm text-amber-600 mt-1">
                {expiringBatches.slice(0, 3).map(b => b.batchNumber).join(', ')}
                {expiringBatches.length > 3 && ` and ${expiringBatches.length - 3} more`}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Filters */}
      <ReportFilters className="md:grid-cols-5">
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
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All Status</option>
          <option value="available">Available</option>
          <option value="reserved">Reserved</option>
          <option value="expired">Expired</option>
          <option value="quarantine">Quarantine</option>
        </select>
        <Input
          type="number"
          placeholder="Days to Expiry"
          value={daysToExpiry}
          onChange={(e) => setDaysToExpiry(e.target.value)}
        />
        <Button onClick={loadBatches} disabled={loading}>
          {loading ? 'Loading...' : 'Apply Filters'}
        </Button>
      </ReportFilters>

      {error && <ReportAlert>{error}</ReportAlert>}

      {/* Batches Table */}
      <ReportCard>
        <ReportTable>
          <thead className="bg-muted/60 text-muted-foreground">
            <tr>
              <th className="text-left p-3">Batch Number</th>
              <th className="text-left p-3">Item</th>
              <th className="text-left p-3">Warehouse</th>
              <th className="text-right p-3">Quantity</th>
              <th className="text-left p-3">Expiry Date</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Supplier</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {batches.length === 0 && <ReportEmpty colSpan={8} />}
            {batches.map((batch) => {
              const config = statusConfig[batch.status];
              const Icon = config.icon;
              const daysToExpiry = getDaysUntilExpiry(batch.expiryDate);
              const isExpiringSoon = daysToExpiry !== null && daysToExpiry <= 30 && daysToExpiry > 0;
              const isExpired = daysToExpiry !== null && daysToExpiry <= 0;

              return (
                <tr key={batch.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 font-mono text-sm font-medium">{batch.batchNumber}</td>
                  <td className="p-3 font-mono text-sm">{batch.itemCode}</td>
                  <td className="p-3">{batch.warehouseCode}</td>
                  <td className="p-3 text-right font-mono">{batch.quantity}</td>
                  <td className="p-3">
                    {batch.expiryDate ? (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className={isExpired ? 'text-red-600' : isExpiringSoon ? 'text-amber-600' : ''}>
                          {new Date(batch.expiryDate).toLocaleDateString()}
                        </span>
                        {isExpiringSoon && (
                          <span className="text-xs text-amber-600">({daysToExpiry}d)</span>
                        )}
                        {isExpired && (
                          <span className="text-xs text-red-600">(Expired)</span>
                        )}
                      </div>
                    ) : '-'}
                  </td>
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${config.color}`}>
                      <Icon className="h-3 w-3" />
                      {config.label}
                    </span>
                  </td>
                  <td className="p-3 text-sm text-muted-foreground">{batch.supplierCode || '-'}</td>
                  <td className="p-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(batch)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </ReportTable>
      </ReportCard>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingBatch) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold">
              {editingBatch ? 'Edit Batch' : 'Create New Batch'}
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Batch Number</label>
                <Input
                  className="mt-1"
                  value={formData.batchNumber}
                  onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                  disabled={!!editingBatch}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Quantity</label>
                <Input
                  type="number"
                  min={0}
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
                  disabled={!!editingBatch}
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Manufacturing Date</label>
                <Input
                  type="date"
                  className="mt-1"
                  value={formData.manufacturingDate}
                  onChange={(e) => setFormData({ ...formData, manufacturingDate: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Expiry Date</label>
                <Input
                  type="date"
                  className="mt-1"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Status</label>
                <select
                  className="flex h-9 w-full mt-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                >
                  <option value="available">Available</option>
                  <option value="reserved">Reserved</option>
                  <option value="expired">Expired</option>
                  <option value="quarantine">Quarantine</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Supplier Code</label>
                <Input
                  className="mt-1"
                  value={formData.supplierCode}
                  onChange={(e) => setFormData({ ...formData, supplierCode: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Notes</label>
              <Input
                className="mt-1"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingBatch(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button onClick={editingBatch ? updateBatch : createBatch}>
                {editingBatch ? 'Update Batch' : 'Create Batch'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </ReportPage>
  );
}
