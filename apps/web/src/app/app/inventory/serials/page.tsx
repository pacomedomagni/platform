'use client';

import { useState, useEffect } from 'react';
import { Button, Input, Card } from '@platform/ui';
import api from '../../../../lib/api';
import { ReportAlert, ReportCard, ReportEmpty, ReportFilters, ReportPage, ReportTable } from '../../reports/_components/report-shell';
import {
  Hash,
  Plus,
  CheckCircle,
  XCircle,
  Package,
  Edit2,
  History,
} from 'lucide-react';

// Matches backend querySerials response shape
type SerialRecord = {
  id: string;
  serialNo: string;
  itemCode: string;
  itemName: string;
  status: 'AVAILABLE' | 'ISSUED';
  warehouseCode?: string;
  locationCode?: string;
  batchNo?: string;
  createdAt: string;
};

// Matches backend getSerialHistory response shape
type SerialHistoryResponse = {
  id: string;
  itemCode: string;
  itemName: string;
  serialNo: string;
  status: string;
  currentWarehouse?: string;
  currentLocation?: string;
  batchNo?: string;
  history: SerialHistoryEntry[];
};

type SerialHistoryEntry = {
  date: string;
  voucherType: string;
  voucherNo: string;
  warehouse: string;
  qty: number;
};

const statusConfig: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
  AVAILABLE: { icon: CheckCircle, color: 'bg-green-50 text-green-700 border-green-200', label: 'Available' },
  ISSUED: { icon: Package, color: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Issued' },
};

const defaultStatusConfig = { icon: XCircle, color: 'bg-slate-50 text-slate-700 border-slate-200', label: 'Unknown' };

export default function SerialTrackingPage() {
  const [serials, setSerials] = useState<SerialRecord[]>([]);
  const [serialHistory, setSerialHistory] = useState<SerialHistoryEntry[]>([]);
  const [selectedSerial, setSelectedSerial] = useState<SerialRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [editingSerial, setEditingSerial] = useState<SerialRecord | null>(null);
  const [pagination, setPagination] = useState<{ total: number; limit: number; offset: number } | null>(null);
  const [serialPage, setSerialPage] = useState(0);
  const PAGE_SIZE = 50;

  // Filters
  const [itemCode, setItemCode] = useState('');
  const [warehouseCode, setWarehouseCode] = useState('');
  const [status, setStatus] = useState('');
  const [searchSerial, setSearchSerial] = useState('');

  // Form state - backend uses serialNo, batchNo fields
  const [formData, setFormData] = useState({
    serialNo: '',
    itemCode: '',
    warehouseCode: '',
    locationCode: '',
    batchNo: '',
    status: 'AVAILABLE' as 'AVAILABLE' | 'ISSUED',
  });

  // Bulk create state
  const [bulkData, setBulkData] = useState({
    itemCode: '',
    warehouseCode: '',
    prefix: '',
    startNumber: 1,
    count: 10,
    batchNumber: '',
  });

  const loadSerials = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/v1/inventory-management/serials', {
        params: {
          itemCode: itemCode || undefined,
          warehouseCode: warehouseCode || undefined,
          status: status || undefined,
          search: searchSerial || undefined,
          limit: PAGE_SIZE,
          offset: serialPage * PAGE_SIZE,
        },
      });
      setSerials(res.data.data || []);
      if (res.data.total !== undefined) {
        setPagination({
          total: res.data.total,
          limit: res.data.limit || PAGE_SIZE,
          offset: res.data.offset || 0,
        });
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message || 'Failed to load serials');
    } finally {
      setLoading(false);
    }
  };

  const loadSerialHistory = async (serialNo: string): Promise<boolean> => {
    try {
      const res = await api.get(`/v1/inventory-management/serials/history/${encodeURIComponent(serialNo)}`);
      const historyResponse: SerialHistoryResponse = res.data;
      setSerialHistory(historyResponse.history || []);
      return true;
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message || 'Failed to load serial history');
      return false;
    }
  };

  const createSerial = async () => {
    setError(null);
    try {
      await api.post('/v1/inventory-management/serials', formData);
      setShowCreateModal(false);
      resetForm();
      loadSerials();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message || 'Failed to create serial');
    }
  };

  const bulkCreateSerials = async () => {
    setError(null);
    try {
      // Map frontend UI fields to backend CreateSerialBulkDto shape
      const serialNos = Array.from({ length: bulkData.count }, (_, i) =>
        `${bulkData.prefix}${(bulkData.startNumber + i).toString().padStart(4, '0')}`
      );
      const payload = {
        itemCode: bulkData.itemCode,
        serialNos,
        warehouseCode: bulkData.warehouseCode || undefined,
        batchNo: bulkData.batchNumber || undefined,
      };
      await api.post('/v1/inventory-management/serials/bulk', payload);
      setShowBulkModal(false);
      setBulkData({
        itemCode: '',
        warehouseCode: '',
        prefix: '',
        startNumber: 1,
        count: 10,
        batchNumber: '',
      });
      loadSerials();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message || 'Failed to create serials');
    }
  };

  const updateSerial = async () => {
    if (!editingSerial) return;
    setError(null);
    try {
      // Only send fields that match UpdateSerialDto: status, warehouseCode, locationCode, batchNo
      const updatePayload: Record<string, unknown> = {};
      if (formData.status) updatePayload.status = formData.status;
      if (formData.warehouseCode !== undefined) updatePayload.warehouseCode = formData.warehouseCode;
      if (formData.locationCode !== undefined) updatePayload.locationCode = formData.locationCode;
      if (formData.batchNo !== undefined) updatePayload.batchNo = formData.batchNo;
      await api.put(`/v1/inventory-management/serials/${editingSerial.id}`, updatePayload);
      setEditingSerial(null);
      resetForm();
      loadSerials();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message || 'Failed to update serial');
    }
  };

  const resetForm = () => {
    setFormData({
      serialNo: '',
      itemCode: '',
      warehouseCode: '',
      locationCode: '',
      batchNo: '',
      status: 'AVAILABLE',
    });
  };

  const openEditModal = (serial: SerialRecord) => {
    setEditingSerial(serial);
    setFormData({
      serialNo: serial.serialNo,
      itemCode: serial.itemCode,
      warehouseCode: serial.warehouseCode || '',
      locationCode: serial.locationCode || '',
      batchNo: serial.batchNo || '',
      status: serial.status,
    });
  };

  const openHistoryModal = async (serial: SerialRecord) => {
    setSelectedSerial(serial);
    // Don't open the modal until the history actually loads. The previous
    // shape opened the modal regardless of failure and rendered "No
    // history available" instead of surfacing the error. See IS3 in
    // docs/ui-audit.md.
    const ok = await loadSerialHistory(serial.serialNo);
    if (ok) {
      setShowHistoryModal(true);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps -- loadSerials depends on filter state; we only want initial load
  useEffect(() => {
    loadSerials();
  }, []);

  // Re-load on page change (IS1).
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-fire on page changes
  useEffect(() => {
    loadSerials();
  }, [serialPage]);

  return (
    <ReportPage
      title="Serial Number Tracking"
      description="Track individual items with unique serial numbers"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowBulkModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Bulk Create
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Serial
          </Button>
        </div>
      }
    >
      {/* Filters */}
      <ReportFilters className="md:grid-cols-5">
        <Input
          placeholder="Search Serial Number"
          value={searchSerial}
          onChange={(e) => setSearchSerial(e.target.value)}
        />
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
          <option value="AVAILABLE">Available</option>
          <option value="ISSUED">Issued</option>
        </select>
        <Button onClick={loadSerials} disabled={loading}>
          {loading ? 'Loading...' : 'Apply Filters'}
        </Button>
      </ReportFilters>

      {error && <ReportAlert>{error}</ReportAlert>}

      {/* Serials Table */}
      <ReportCard>
        <ReportTable>
          <thead className="bg-muted/60 text-muted-foreground">
            <tr>
              <th className="text-left p-3">Serial Number</th>
              <th className="text-left p-3">Item</th>
              <th className="text-left p-3">Warehouse</th>
              <th className="text-left p-3">Batch</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Location</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {serials.length === 0 && <ReportEmpty colSpan={7} />}
            {serials.map((serial) => {
              const config = statusConfig[serial.status] || defaultStatusConfig;
              const Icon = config.icon;

              return (
                <tr key={serial.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-mono text-sm font-medium">{serial.serialNo}</span>
                    </div>
                  </td>
                  <td className="p-3 font-mono text-sm">{serial.itemCode}</td>
                  <td className="p-3">{serial.warehouseCode || '-'}</td>
                  <td className="p-3 text-sm text-muted-foreground">{serial.batchNo || '-'}</td>
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${config.color}`}>
                      <Icon className="h-3 w-3" />
                      {config.label}
                    </span>
                  </td>
                  <td className="p-3 text-sm text-muted-foreground">
                    {serial.locationCode || '-'}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openHistoryModal(serial)}
                        title="View History"
                      >
                        <History className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditModal(serial)}
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </div>
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
              Showing {serialPage * PAGE_SIZE + 1}-{Math.min((serialPage + 1) * PAGE_SIZE, pagination.total)} of {pagination.total}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSerialPage((p) => Math.max(0, p - 1))}
                disabled={serialPage === 0}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSerialPage((p) => p + 1)}
                disabled={(serialPage + 1) * PAGE_SIZE >= pagination.total}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </ReportCard>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingSerial) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold">
              {editingSerial ? 'Edit Serial' : 'Create New Serial'}
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Serial Number</label>
                <Input
                  className="mt-1"
                  value={formData.serialNo}
                  onChange={(e) => setFormData({ ...formData, serialNo: e.target.value })}
                  disabled={!!editingSerial}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Item Code</label>
                <Input
                  className="mt-1"
                  value={formData.itemCode}
                  onChange={(e) => setFormData({ ...formData, itemCode: e.target.value })}
                  disabled={!!editingSerial}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Warehouse Code</label>
                <Input
                  className="mt-1"
                  value={formData.warehouseCode}
                  onChange={(e) => setFormData({ ...formData, warehouseCode: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Location Code</label>
                <Input
                  className="mt-1"
                  value={formData.locationCode}
                  onChange={(e) => setFormData({ ...formData, locationCode: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Batch Number</label>
                <Input
                  className="mt-1"
                  value={formData.batchNo}
                  onChange={(e) => setFormData({ ...formData, batchNo: e.target.value })}
                />
              </div>
              {editingSerial && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <select
                    className="flex h-9 w-full mt-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'AVAILABLE' | 'ISSUED' })}
                  >
                    <option value="AVAILABLE">Available</option>
                    <option value="ISSUED">Issued</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingSerial(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button onClick={editingSerial ? updateSerial : createSerial}>
                {editingSerial ? 'Update Serial' : 'Create Serial'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Bulk Create Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold">Bulk Create Serials</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Item Code</label>
                <Input
                  className="mt-1"
                  value={bulkData.itemCode}
                  onChange={(e) => setBulkData({ ...bulkData, itemCode: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Warehouse Code</label>
                <Input
                  className="mt-1"
                  value={bulkData.warehouseCode}
                  onChange={(e) => setBulkData({ ...bulkData, warehouseCode: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Prefix</label>
                <Input
                  className="mt-1"
                  placeholder="SN-"
                  value={bulkData.prefix}
                  onChange={(e) => setBulkData({ ...bulkData, prefix: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Start Number</label>
                <Input
                  type="number"
                  min={1}
                  className="mt-1"
                  value={bulkData.startNumber}
                  onChange={(e) => setBulkData({ ...bulkData, startNumber: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Count</label>
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  className="mt-1"
                  value={bulkData.count}
                  onChange={(e) => setBulkData({ ...bulkData, count: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Batch Number (Optional)</label>
              <Input
                className="mt-1"
                value={bulkData.batchNumber}
                onChange={(e) => setBulkData({ ...bulkData, batchNumber: e.target.value })}
              />
            </div>

            <div className="p-3 bg-muted/50 rounded-lg text-sm">
              <p className="text-muted-foreground">
                Preview: {bulkData.prefix}{bulkData.startNumber.toString().padStart(4, '0')} to {bulkData.prefix}{(bulkData.startNumber + bulkData.count - 1).toString().padStart(4, '0')}
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowBulkModal(false)}>
                Cancel
              </Button>
              <Button onClick={bulkCreateSerials}>
                Create {bulkData.count} Serials
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && selectedSerial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Serial History</h2>
                <p className="text-sm text-muted-foreground font-mono">{selectedSerial.serialNo}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowHistoryModal(false)}>
                ✕
              </Button>
            </div>

            <div className="space-y-3">
              {serialHistory.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No history available</p>
              ) : (
                serialHistory.map((entry, idx) => (
                  <div key={idx} className="flex gap-3 p-3 bg-muted/30 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{entry.voucherType}</span>
                        <span className="text-xs text-muted-foreground">
                          {entry.date}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Voucher: {entry.voucherNo}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Warehouse: {entry.warehouse} | Qty: {entry.qty > 0 ? '+' : ''}{entry.qty}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      )}
    </ReportPage>
  );
}
