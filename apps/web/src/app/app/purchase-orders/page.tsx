'use client';

import { useState, useEffect } from 'react';
import api from '../../../lib/api';

interface POLineItem {
  description: string;
  itemId?: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

interface ReceiptLineItem {
  lineItemId?: string;
  description: string;
  orderedQty: number;
  receivedQty: number;
  quantityToReceive: number;
  batchNo: string;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierName: string;
  supplierEmail: string;
  orderDate: string;
  expectedDeliveryDate: string;
  status: string;
  total: number;
  shippingCost: number;
  receiptsCount: number;
  lineItems: POLineItem[];
  deliveryWarehouse?: string;
  notes?: string;
}

interface POStats {
  total: number;
  draft: number;
  approved: number;
  partiallyReceived: number;
  received: number;
  totalValue: number;
}

const emptyForm = {
  supplierName: '',
  supplierEmail: '',
  orderDate: new Date().toISOString().split('T')[0],
  expectedDeliveryDate: '',
  deliveryWarehouse: '',
  shippingCost: 0,
  notes: '',
  lineItems: [{ description: '', itemId: '', quantity: 1, unitPrice: 0, taxRate: 0 }] as POLineItem[],
};

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  APPROVED: 'bg-green-100 text-green-700',
  PARTIALLY_RECEIVED: 'bg-yellow-100 text-yellow-700',
  RECEIVED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [stats, setStats] = useState<POStats>({ total: 0, draft: 0, approved: 0, partiallyReceived: 0, received: 0, totalValue: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [receivePO, setReceivePO] = useState<PurchaseOrder | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [receiveItems, setReceiveItems] = useState<ReceiptLineItem[]>([]);
  const [receiveWarehouse, setReceiveWarehouse] = useState('');
  const [receiveDate, setReceiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [receiveNotes, setReceiveNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-';

  const loadStats = async () => {
    try {
      const res = await api.get('/v1/store/admin/purchase-orders/stats');
      setStats(res.data.data || res.data);
    } catch { /* ignore */ }
  };

  const loadOrders = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/v1/store/admin/purchase-orders', { params });
      setOrders(res.data.data || res.data || []);
    } catch (err: any) {
      console.error('Failed to load purchase orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStats(); }, []);
  useEffect(() => {
    const t = setTimeout(() => loadOrders(), 300);
    return () => clearTimeout(t);
  }, [search, statusFilter]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, lineItems: [{ description: '', itemId: '', quantity: 1, unitPrice: 0, taxRate: 0 }] });
    setError('');
    setShowModal(true);
  };

  const openEdit = (po: PurchaseOrder) => {
    setEditingId(po.id);
    setForm({
      supplierName: po.supplierName,
      supplierEmail: po.supplierEmail,
      orderDate: po.orderDate?.split('T')[0] || '',
      expectedDeliveryDate: po.expectedDeliveryDate?.split('T')[0] || '',
      deliveryWarehouse: po.deliveryWarehouse || '',
      shippingCost: po.shippingCost || 0,
      notes: po.notes || '',
      lineItems: po.lineItems?.length ? po.lineItems : [{ description: '', itemId: '', quantity: 1, unitPrice: 0, taxRate: 0 }],
    });
    setError('');
    setShowModal(true);
  };

  const addLineItem = () => setForm(f => ({ ...f, lineItems: [...f.lineItems, { description: '', itemId: '', quantity: 1, unitPrice: 0, taxRate: 0 }] }));
  const removeLineItem = (i: number) => setForm(f => ({ ...f, lineItems: f.lineItems.filter((_, idx) => idx !== i) }));
  const updateLineItem = (i: number, field: keyof POLineItem, value: string | number) => {
    setForm(f => {
      const items = [...f.lineItems];
      items[i] = { ...items[i], [field]: value };
      return { ...f, lineItems: items };
    });
  };

  const lineTotal = (li: POLineItem) => {
    const sub = li.quantity * li.unitPrice;
    return sub + sub * (li.taxRate / 100);
  };
  const formTotal = () => form.lineItems.reduce((s, li) => s + lineTotal(li), 0) + (form.shippingCost || 0);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const body = {
        supplierName: form.supplierName,
        supplierEmail: form.supplierEmail,
        orderDate: form.orderDate,
        expectedDeliveryDate: form.expectedDeliveryDate,
        deliveryWarehouse: form.deliveryWarehouse,
        shippingCost: form.shippingCost,
        notes: form.notes,
        lineItems: form.lineItems,
      };
      if (editingId) {
        await api.put(`/v1/store/admin/purchase-orders/${editingId}`, body);
      } else {
        await api.post('/v1/store/admin/purchase-orders', body);
      }
      setShowModal(false);
      loadOrders();
      loadStats();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save purchase order');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this purchase order?')) return;
    try {
      await api.delete(`/v1/store/admin/purchase-orders/${id}`);
      loadOrders();
      loadStats();
    } catch (err: any) {
      console.error('Failed to delete PO:', err);
    }
  };

  const openReceive = (po: PurchaseOrder) => {
    setReceivePO(po);
    setReceiveItems(
      (po.lineItems || []).map((li, idx) => ({
        lineItemId: (li as any).id || String(idx),
        description: li.description,
        orderedQty: li.quantity,
        receivedQty: (li as any).receivedQty || 0,
        quantityToReceive: 0,
        batchNo: '',
      }))
    );
    setReceiveWarehouse(po.deliveryWarehouse || '');
    setReceiveDate(new Date().toISOString().split('T')[0]);
    setReceiveNotes('');
    setError('');
    setShowReceiveModal(true);
  };

  const updateReceiveItem = (i: number, field: keyof ReceiptLineItem, value: string | number) => {
    setReceiveItems(items => {
      const updated = [...items];
      updated[i] = { ...updated[i], [field]: value };
      return updated;
    });
  };

  const handleReceiveGoods = async () => {
    if (!receivePO) return;
    setSaving(true);
    setError('');
    try {
      await api.post(`/v1/store/admin/purchase-orders/${receivePO.id}/receive`, {
        items: receiveItems.filter(ri => ri.quantityToReceive > 0).map(ri => ({
          lineItemId: ri.lineItemId,
          quantity: ri.quantityToReceive,
          batchNo: ri.batchNo || undefined,
        })),
        warehouse: receiveWarehouse,
        receivedDate: receiveDate,
        notes: receiveNotes,
      });
      setShowReceiveModal(false);
      loadOrders();
      loadStats();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to receive goods');
    } finally {
      setSaving(false);
    }
  };

  const statCards = [
    { label: 'Total POs', value: stats.total },
    { label: 'Draft', value: stats.draft },
    { label: 'Approved', value: stats.approved },
    { label: 'Partially Received', value: stats.partiallyReceived },
    { label: 'Received', value: stats.received },
    { label: 'Total Value', value: fmt(stats.totalValue) },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Purchase Orders</h1>
          <p className="text-sm text-slate-500 mt-1">Manage supplier purchase orders and goods receipt</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">New Purchase Order</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map(s => (
          <div key={s.label} className="bg-white border rounded-lg p-4">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className="text-lg font-bold mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search purchase orders..." className="flex-1 border rounded-lg px-3 py-2 text-sm" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm sm:w-52">
          <option value="">All Statuses</option>
          {['DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'].map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left p-3 font-medium">PO #</th>
              <th className="text-left p-3 font-medium">Supplier</th>
              <th className="text-left p-3 font-medium">Date</th>
              <th className="text-left p-3 font-medium">Expected Delivery</th>
              <th className="text-right p-3 font-medium">Total</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-center p-3 font-medium">Receipts</th>
              <th className="text-right p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="p-8 text-center text-slate-400">Loading...</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={8} className="p-8 text-center text-slate-400">No purchase orders found</td></tr>
            ) : orders.map(po => (
              <tr key={po.id} className="border-t hover:bg-slate-50">
                <td className="p-3 font-medium">{po.poNumber}</td>
                <td className="p-3">{po.supplierName}<br /><span className="text-xs text-slate-400">{po.supplierEmail}</span></td>
                <td className="p-3">{fmtDate(po.orderDate)}</td>
                <td className="p-3">{fmtDate(po.expectedDeliveryDate)}</td>
                <td className="p-3 text-right font-medium">{fmt(po.total)}</td>
                <td className="p-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[po.status] || 'bg-gray-100 text-gray-600'}`}>{po.status.replace(/_/g, ' ')}</span></td>
                <td className="p-3 text-center">{po.receiptsCount || 0}</td>
                <td className="p-3 text-right space-x-2">
                  <button onClick={() => openEdit(po)} className="text-blue-600 hover:underline text-xs">View</button>
                  {['APPROVED', 'PARTIALLY_RECEIVED'].includes(po.status) && (
                    <button onClick={() => openReceive(po)} className="text-green-600 hover:underline text-xs">Receive</button>
                  )}
                  {po.status === 'DRAFT' && <button onClick={() => handleDelete(po.id)} className="text-red-600 hover:underline text-xs">Delete</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl my-8">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">{editingId ? 'Edit Purchase Order' : 'New Purchase Order'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Supplier Name *</label>
                  <input value={form.supplierName} onChange={e => setForm(f => ({ ...f, supplierName: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Supplier Email</label>
                  <input type="email" value={form.supplierEmail} onChange={e => setForm(f => ({ ...f, supplierEmail: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Order Date</label>
                  <input type="date" value={form.orderDate} onChange={e => setForm(f => ({ ...f, orderDate: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Expected Delivery Date</label>
                  <input type="date" value={form.expectedDeliveryDate} onChange={e => setForm(f => ({ ...f, expectedDeliveryDate: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Delivery Warehouse</label>
                  <input value={form.deliveryWarehouse} onChange={e => setForm(f => ({ ...f, deliveryWarehouse: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Shipping Cost</label>
                  <input type="number" value={form.shippingCost} onChange={e => setForm(f => ({ ...f, shippingCost: Number(e.target.value) }))} className="w-full border rounded-lg px-3 py-2 text-sm" min="0" step="0.01" />
                </div>
              </div>

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-slate-700">Line Items</h3>
                  <button onClick={addLineItem} className="text-sm text-blue-600 hover:underline">+ Add Item</button>
                </div>
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 text-xs text-slate-500 font-medium px-1">
                    <span className="col-span-3">Description</span>
                    <span className="col-span-2">Item ID</span>
                    <span className="col-span-2">Qty</span>
                    <span className="col-span-2">Unit Price</span>
                    <span className="col-span-1">Tax %</span>
                    <span className="col-span-1 text-right">Total</span>
                    <span className="col-span-1"></span>
                  </div>
                  {form.lineItems.map((li, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <input value={li.description} onChange={e => updateLineItem(i, 'description', e.target.value)} placeholder="Description" className="col-span-3 border rounded px-2 py-1.5 text-sm" />
                      <input value={li.itemId || ''} onChange={e => updateLineItem(i, 'itemId', e.target.value)} placeholder="Optional" className="col-span-2 border rounded px-2 py-1.5 text-sm" />
                      <input type="number" value={li.quantity} onChange={e => updateLineItem(i, 'quantity', Number(e.target.value))} className="col-span-2 border rounded px-2 py-1.5 text-sm" min="1" />
                      <input type="number" value={li.unitPrice} onChange={e => updateLineItem(i, 'unitPrice', Number(e.target.value))} className="col-span-2 border rounded px-2 py-1.5 text-sm" min="0" step="0.01" />
                      <input type="number" value={li.taxRate} onChange={e => updateLineItem(i, 'taxRate', Number(e.target.value))} className="col-span-1 border rounded px-2 py-1.5 text-sm" min="0" />
                      <span className="col-span-1 text-sm text-right font-medium">{fmt(lineTotal(li))}</span>
                      <button onClick={() => removeLineItem(i)} className="col-span-1 text-red-400 hover:text-red-600 text-center">&times;</button>
                    </div>
                  ))}
                </div>
                <div className="text-right mt-3 text-sm font-semibold">Total: {fmt(formTotal())}</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving...' : editingId ? 'Update PO' : 'Create PO'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receive Goods Modal */}
      {showReceiveModal && receivePO && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">Receive Goods - {receivePO.poNumber}</h2>
              <button onClick={() => setShowReceiveModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Warehouse</label>
                  <input value={receiveWarehouse} onChange={e => setReceiveWarehouse(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Received Date</label>
                  <input type="date" value={receiveDate} onChange={e => setReceiveDate(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-slate-700 mb-2">Items to Receive</h3>
                <div className="space-y-3">
                  {receiveItems.map((ri, i) => (
                    <div key={i} className="border rounded-lg p-3">
                      <p className="text-sm font-medium">{ri.description}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Ordered: {ri.orderedQty} | Already Received: {ri.receivedQty}</p>
                      <div className="grid grid-cols-2 gap-3 mt-2">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Qty to Receive</label>
                          <input type="number" value={ri.quantityToReceive} onChange={e => updateReceiveItem(i, 'quantityToReceive', Number(e.target.value))} className="w-full border rounded px-2 py-1.5 text-sm" min="0" max={ri.orderedQty - ri.receivedQty} />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Batch No (optional)</label>
                          <input value={ri.batchNo} onChange={e => updateReceiveItem(i, 'batchNo', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea value={receiveNotes} onChange={e => setReceiveNotes(e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t">
              <button onClick={() => setShowReceiveModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
              <button onClick={handleReceiveGoods} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {saving ? 'Receiving...' : 'Confirm Receipt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
