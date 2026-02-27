'use client';

import { useState, useEffect } from 'react';
import { Button, Input, Card } from '@platform/ui';
import api from '../../../../lib/api';
import { ReportAlert, ReportCard, ReportEmpty, ReportFilters, ReportPage, ReportTable } from '../../reports/_components/report-shell';
import {
  Plus,
  Calendar,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Edit2,
} from 'lucide-react';

// Matches backend queryBatches response shape
type BatchRecord = {
  id: string;
  itemCode: string;
  itemName: string;
  batchNo: string;
  mfgDate?: string;
  expDate?: string;
  isActive: boolean;
  isExpired: boolean;
  daysToExpiry: number | null;
  totalQty?: number;
  reservedQty?: number;
  availableQty?: number;
};

// Matches backend getExpiringBatches response shape
type ExpiringBatchRecord = {
  id: string;
  itemCode: string;
  itemName: string;
  batchNo: string;
  expDate?: string;
  daysToExpiry: number | null;
  stockQty: number;
};

// Derive status from backend boolean flags
function getBatchStatus(batch: BatchRecord): { icon: typeof CheckCircle; color: string; label: string } {
  if (batch.isExpired) return { icon: XCircle, color: 'bg-red-50 text-red-700 border-red-200', label: 'Expired' };
  if (!batch.isActive) return { icon: AlertTriangle, color: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Inactive' };
  return { icon: CheckCircle, color: 'bg-green-50 text-green-700 border-green-200', label: 'Active' };
}

export default function BatchTrackingPage() {
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [expiringBatches, setExpiringBatches] = useState<ExpiringBatchRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingBatch, setEditingBatch] = useState<BatchRecord | null>(null);

  // Filters
  const [itemCode, setItemCode] = useState('');
  const [includeExpired, setIncludeExpired] = useState(false);
  const [daysToExpiry, setDaysToExpiry] = useState('30');

  // Form state - backend CreateBatchDto uses itemCode, batchNo, mfgDate, expDate
  // UpdateBatchDto uses mfgDate, expDate, isActive
  const [formData, setFormData] = useState({
    batchNo: '',
    itemCode: '',
    mfgDate: '',
    expDate: '',
    isActive: true,
  });

  const loadBatches = async () => {
    setLoading(true);
    setError(null);
    try {
      const [batchesRes, expiringRes] = await Promise.all([
        api.get('/v1/inventory-management/batches', {
          params: {
            itemCode: itemCode || undefined,
            includeExpired: includeExpired || undefined,
            withStock: true,
          },
        }),
        api.get('/v1/inventory-management/batches/expiring', {
          params: { daysAhead: parseInt(daysToExpiry) || 30 },
        }),
      ]);
      setBatches(batchesRes.data.data || []);
      setExpiringBatches(expiringRes.data || []);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message || 'Failed to load batches');
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
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message || 'Failed to create batch');
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
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message || 'Failed to update batch');
    }
  };

  const resetForm = () => {
    setFormData({
      batchNo: '',
      itemCode: '',
      mfgDate: '',
      expDate: '',
      isActive: true,
    });
  };

  const openEditModal = (batch: BatchRecord) => {
    setEditingBatch(batch);
    setFormData({
      batchNo: batch.batchNo,
      itemCode: batch.itemCode,
      mfgDate: batch.mfgDate || '',
      expDate: batch.expDate || '',
      isActive: batch.isActive,
    });
  };

  useEffect(() => {
    loadBatches();
  }, []);

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
                {expiringBatches.slice(0, 3).map(b => b.batchNo).join(', ')}
                {expiringBatches.length > 3 && ` and ${expiringBatches.length - 3} more`}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Filters */}
      <ReportFilters className="md:grid-cols-4">
        <Input
          placeholder="Item Code"
          value={itemCode}
          onChange={(e) => setItemCode(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeExpired}
            onChange={(e) => setIncludeExpired(e.target.checked)}
          />
          Include Expired
        </label>
        <Input
          type="number"
          placeholder="Expiry Alert (days)"
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
              <th className="text-right p-3">Stock Qty</th>
              <th className="text-left p-3">Expiry Date</th>
              <th className="text-left p-3">Status</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {batches.length === 0 && <ReportEmpty colSpan={6} />}
            {batches.map((batch) => {
              const config = getBatchStatus(batch);
              const Icon = config.icon;
              const isExpiringSoon = batch.daysToExpiry !== null && batch.daysToExpiry <= 30 && batch.daysToExpiry > 0;

              return (
                <tr key={batch.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 font-mono text-sm font-medium">{batch.batchNo}</td>
                  <td className="p-3">
                    <div className="font-mono text-sm">{batch.itemCode}</div>
                    <div className="text-xs text-muted-foreground">{batch.itemName}</div>
                  </td>
                  <td className="p-3 text-right font-mono">{batch.totalQty ?? '-'}</td>
                  <td className="p-3">
                    {batch.expDate ? (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className={batch.isExpired ? 'text-red-600' : isExpiringSoon ? 'text-amber-600' : ''}>
                          {batch.expDate}
                        </span>
                        {isExpiringSoon && (
                          <span className="text-xs text-amber-600">({batch.daysToExpiry}d)</span>
                        )}
                        {batch.isExpired && (
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
                  value={formData.batchNo}
                  onChange={(e) => setFormData({ ...formData, batchNo: e.target.value })}
                  disabled={!!editingBatch}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Item Code</label>
                <Input
                  className="mt-1"
                  value={formData.itemCode}
                  onChange={(e) => setFormData({ ...formData, itemCode: e.target.value })}
                  disabled={!!editingBatch}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Manufacturing Date</label>
                <Input
                  type="date"
                  className="mt-1"
                  value={formData.mfgDate}
                  onChange={(e) => setFormData({ ...formData, mfgDate: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Expiry Date</label>
                <Input
                  type="date"
                  className="mt-1"
                  value={formData.expDate}
                  onChange={(e) => setFormData({ ...formData, expDate: e.target.value })}
                />
              </div>
            </div>

            {editingBatch && (
              <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                />
                Active
              </label>
            )}

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
