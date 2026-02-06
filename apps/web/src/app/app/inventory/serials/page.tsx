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
  Clock,
  Package,
  Edit2,
  History,
} from 'lucide-react';

type SerialRecord = {
  id: string;
  serialNumber: string;
  itemCode: string;
  warehouseCode: string;
  batchNumber?: string;
  status: 'available' | 'sold' | 'reserved' | 'damaged' | 'returned';
  purchaseDate?: string;
  saleDate?: string;
  warrantyExpiry?: string;
  notes?: string;
  createdAt: string;
};

type SerialHistory = {
  id: string;
  serialId: string;
  action: string;
  fromStatus?: string;
  toStatus?: string;
  referenceNumber?: string;
  notes?: string;
  performedBy?: string;
  performedAt: string;
};

const statusConfig = {
  available: { icon: CheckCircle, color: 'bg-green-50 text-green-700 border-green-200', label: 'Available' },
  sold: { icon: Package, color: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Sold' },
  reserved: { icon: Clock, color: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Reserved' },
  damaged: { icon: XCircle, color: 'bg-red-50 text-red-700 border-red-200', label: 'Damaged' },
  returned: { icon: History, color: 'bg-purple-50 text-purple-700 border-purple-200', label: 'Returned' },
};

export default function SerialTrackingPage() {
  const [serials, setSerials] = useState<SerialRecord[]>([]);
  const [serialHistory, setSerialHistory] = useState<SerialHistory[]>([]);
  const [selectedSerial, setSelectedSerial] = useState<SerialRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [editingSerial, setEditingSerial] = useState<SerialRecord | null>(null);

  // Filters
  const [itemCode, setItemCode] = useState('');
  const [warehouseCode, setWarehouseCode] = useState('');
  const [status, setStatus] = useState('');
  const [searchSerial, setSearchSerial] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    serialNumber: '',
    itemCode: '',
    warehouseCode: '',
    batchNumber: '',
    status: 'available' as 'available' | 'sold' | 'reserved' | 'damaged' | 'returned',
    purchaseDate: '',
    warrantyExpiry: '',
    notes: '',
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
          serialNumber: searchSerial || undefined,
        },
      });
      setSerials(res.data || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load serials');
    } finally {
      setLoading(false);
    }
  };

  const loadSerialHistory = async (serialId: string) => {
    try {
      const res = await api.get(`/v1/inventory-management/serials/${serialId}/history`);
      setSerialHistory(res.data || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load serial history');
    }
  };

  const createSerial = async () => {
    setError(null);
    try {
      await api.post('/v1/inventory-management/serials', formData);
      setShowCreateModal(false);
      resetForm();
      loadSerials();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to create serial');
    }
  };

  const bulkCreateSerials = async () => {
    setError(null);
    try {
      await api.post('/v1/inventory-management/serials/bulk', bulkData);
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
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to create serials');
    }
  };

  const updateSerial = async () => {
    if (!editingSerial) return;
    setError(null);
    try {
      await api.put(`/v1/inventory-management/serials/${editingSerial.id}`, formData);
      setEditingSerial(null);
      resetForm();
      loadSerials();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to update serial');
    }
  };

  const resetForm = () => {
    setFormData({
      serialNumber: '',
      itemCode: '',
      warehouseCode: '',
      batchNumber: '',
      status: 'available',
      purchaseDate: '',
      warrantyExpiry: '',
      notes: '',
    });
  };

  const openEditModal = (serial: SerialRecord) => {
    setEditingSerial(serial);
    setFormData({
      serialNumber: serial.serialNumber,
      itemCode: serial.itemCode,
      warehouseCode: serial.warehouseCode,
      batchNumber: serial.batchNumber || '',
      status: serial.status,
      purchaseDate: serial.purchaseDate?.split('T')[0] || '',
      warrantyExpiry: serial.warrantyExpiry?.split('T')[0] || '',
      notes: serial.notes || '',
    });
  };

  const openHistoryModal = async (serial: SerialRecord) => {
    setSelectedSerial(serial);
    await loadSerialHistory(serial.id);
    setShowHistoryModal(true);
  };

  useEffect(() => {
    loadSerials();
  }, []);

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
          <option value="available">Available</option>
          <option value="sold">Sold</option>
          <option value="reserved">Reserved</option>
          <option value="damaged">Damaged</option>
          <option value="returned">Returned</option>
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
              <th className="text-left p-3">Warranty Expiry</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {serials.length === 0 && <ReportEmpty colSpan={7} />}
            {serials.map((serial) => {
              const config = statusConfig[serial.status];
              const Icon = config.icon;
              const warrantyExpired = serial.warrantyExpiry && new Date(serial.warrantyExpiry) < new Date();

              return (
                <tr key={serial.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-mono text-sm font-medium">{serial.serialNumber}</span>
                    </div>
                  </td>
                  <td className="p-3 font-mono text-sm">{serial.itemCode}</td>
                  <td className="p-3">{serial.warehouseCode}</td>
                  <td className="p-3 text-sm text-muted-foreground">{serial.batchNumber || '-'}</td>
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${config.color}`}>
                      <Icon className="h-3 w-3" />
                      {config.label}
                    </span>
                  </td>
                  <td className="p-3 text-sm">
                    {serial.warrantyExpiry ? (
                      <span className={warrantyExpired ? 'text-red-600' : ''}>
                        {new Date(serial.warrantyExpiry).toLocaleDateString()}
                        {warrantyExpired && ' (Expired)'}
                      </span>
                    ) : '-'}
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
                  value={formData.serialNumber}
                  onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                  disabled={!!editingSerial}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Status</label>
                <select
                  className="flex h-9 w-full mt-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                >
                  <option value="available">Available</option>
                  <option value="sold">Sold</option>
                  <option value="reserved">Reserved</option>
                  <option value="damaged">Damaged</option>
                  <option value="returned">Returned</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Item Code</label>
                <Input
                  className="mt-1"
                  value={formData.itemCode}
                  onChange={(e) => setFormData({ ...formData, itemCode: e.target.value })}
                  disabled={!!editingSerial}
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
                <label className="text-sm font-medium text-muted-foreground">Batch Number</label>
                <Input
                  className="mt-1"
                  value={formData.batchNumber}
                  onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Purchase Date</label>
                <Input
                  type="date"
                  className="mt-1"
                  value={formData.purchaseDate}
                  onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Warranty Expiry</label>
              <Input
                type="date"
                className="mt-1"
                value={formData.warrantyExpiry}
                onChange={(e) => setFormData({ ...formData, warrantyExpiry: e.target.value })}
              />
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
                <p className="text-sm text-muted-foreground font-mono">{selectedSerial.serialNumber}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowHistoryModal(false)}>
                ✕
              </Button>
            </div>

            <div className="space-y-3">
              {serialHistory.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No history available</p>
              ) : (
                serialHistory.map((history) => (
                  <div key={history.id} className="flex gap-3 p-3 bg-muted/30 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{history.action}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(history.performedAt).toLocaleString()}
                        </span>
                      </div>
                      {(history.fromStatus || history.toStatus) && (
                        <p className="text-sm text-muted-foreground">
                          {history.fromStatus && `From: ${history.fromStatus}`}
                          {history.fromStatus && history.toStatus && ' → '}
                          {history.toStatus && `To: ${history.toStatus}`}
                        </p>
                      )}
                      {history.referenceNumber && (
                        <p className="text-sm text-muted-foreground">Ref: {history.referenceNumber}</p>
                      )}
                      {history.notes && (
                        <p className="text-sm mt-1">{history.notes}</p>
                      )}
                      {history.performedBy && (
                        <p className="text-xs text-muted-foreground mt-1">By: {history.performedBy}</p>
                      )}
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
