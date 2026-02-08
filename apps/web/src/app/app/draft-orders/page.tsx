'use client';

import { useState, useEffect } from 'react';
import api from '../../../lib/api';
import { Pagination } from '../_components/pagination';

interface DraftLineItem {
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
}

interface DraftOrder {
  id: string;
  orderNumber: string;
  customerEmail: string;
  customerPhone?: string;
  status: string;
  itemCount: number;
  subtotal: number;
  tax: number;
  shippingCost: number;
  grandTotal: number;
  lineItems?: DraftLineItem[];
  shippingAddress?: { street?: string; city?: string; state?: string; zip?: string; country?: string };
  shippingMethod?: string;
  customerNotes?: string;
  createdAt: string;
}

interface DraftStats {
  count: number;
  totalValue: number;
}

const emptyForm = {
  customerEmail: '',
  customerPhone: '',
  customerNotes: '',
  shippingStreet: '',
  shippingCity: '',
  shippingState: '',
  shippingZip: '',
  shippingCountry: '',
  shippingMethod: 'standard',
  shippingCost: 0,
  taxRate: 0,
  lineItems: [{ productName: '', sku: '', quantity: 1, unitPrice: 0 }] as DraftLineItem[],
};

export default function DraftOrdersPage() {
  const [orders, setOrders] = useState<DraftOrder[]>([]);
  const [stats, setStats] = useState<DraftStats>({ count: 0, totalValue: 0 });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-';

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get('/v1/store/admin/orders/all', { params: { status: 'DRAFT', page, limit: 20 } });
      const data = res.data.data || res.data || [];
      setOrders(data);
      if (res.data.totalPages != null) setTotalPages(res.data.totalPages);
      if (res.data.total != null) setTotalItems(res.data.total);
      setStats({
        count: res.data.total != null ? res.data.total : data.length,
        totalValue: data.reduce((s: number, o: DraftOrder) => s + (o.grandTotal || 0), 0),
      });
    } catch (err: any) {
      console.error('Failed to load draft orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOrders(); }, [page]);

  const subtotal = () => form.lineItems.reduce((s, li) => s + li.quantity * li.unitPrice, 0);
  const taxAmount = () => subtotal() * (form.taxRate / 100);
  const total = () => subtotal() + taxAmount() + (form.shippingCost || 0);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, lineItems: [{ productName: '', sku: '', quantity: 1, unitPrice: 0 }] });
    setError('');
    setShowModal(true);
  };

  const openEdit = (order: DraftOrder) => {
    setEditingId(order.id);
    setForm({
      customerEmail: order.customerEmail || '',
      customerPhone: order.customerPhone || '',
      customerNotes: order.customerNotes || '',
      shippingStreet: order.shippingAddress?.street || '',
      shippingCity: order.shippingAddress?.city || '',
      shippingState: order.shippingAddress?.state || '',
      shippingZip: order.shippingAddress?.zip || '',
      shippingCountry: order.shippingAddress?.country || '',
      shippingMethod: order.shippingMethod || 'standard',
      shippingCost: order.shippingCost || 0,
      taxRate: order.subtotal ? Math.round((order.tax / order.subtotal) * 10000) / 100 : 0,
      lineItems: order.lineItems?.length ? order.lineItems : [{ productName: '', sku: '', quantity: 1, unitPrice: 0 }],
    });
    setError('');
    setShowModal(true);
  };

  const addLineItem = () => setForm(f => ({ ...f, lineItems: [...f.lineItems, { productName: '', sku: '', quantity: 1, unitPrice: 0 }] }));
  const removeLineItem = (i: number) => setForm(f => ({ ...f, lineItems: f.lineItems.filter((_, idx) => idx !== i) }));
  const updateLineItem = (i: number, field: keyof DraftLineItem, value: string | number) => {
    setForm(f => {
      const items = [...f.lineItems];
      items[i] = { ...items[i], [field]: value };
      return { ...f, lineItems: items };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const body = {
        status: 'DRAFT',
        customerEmail: form.customerEmail,
        customerPhone: form.customerPhone || undefined,
        customerNotes: form.customerNotes || undefined,
        shippingAddress: {
          street: form.shippingStreet,
          city: form.shippingCity,
          state: form.shippingState,
          zip: form.shippingZip,
          country: form.shippingCountry,
        },
        shippingMethod: form.shippingMethod,
        shippingCost: form.shippingCost,
        lineItems: form.lineItems,
        taxRate: form.taxRate,
      };
      if (editingId) {
        await api.put(`/v1/store/admin/orders/${editingId}`, body);
      } else {
        await api.post('/v1/store/admin/orders', body);
      }
      setShowModal(false);
      loadOrders();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save draft order');
    } finally {
      setSaving(false);
    }
  };

  const handleConvert = async (id: string) => {
    if (!confirm('Convert this draft to a pending order?')) return;
    try {
      await api.put(`/v1/store/admin/orders/${id}`, { status: 'PENDING' });
      loadOrders();
    } catch (err: any) {
      console.error('Failed to convert order:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this draft order?')) return;
    try {
      await api.delete(`/v1/store/admin/orders/${id}`);
      loadOrders();
    } catch (err: any) {
      console.error('Failed to delete order:', err);
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Draft Orders</h1>
          <p className="text-sm text-slate-500 mt-1">Create manual orders for phone, wholesale, or custom sales</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">New Draft Order</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border rounded-lg p-4">
          <p className="text-xs text-slate-500">Draft Orders</p>
          <p className="text-2xl font-bold mt-1">{stats.count}</p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-xs text-slate-500">Total Value</p>
          <p className="text-2xl font-bold mt-1">{fmt(stats.totalValue)}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left p-3 font-medium">Order #</th>
              <th className="text-left p-3 font-medium">Customer Email</th>
              <th className="text-center p-3 font-medium">Items</th>
              <th className="text-right p-3 font-medium">Total</th>
              <th className="text-left p-3 font-medium">Created</th>
              <th className="text-right p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-400">Loading...</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-400">No draft orders. Create one to get started.</td></tr>
            ) : orders.map(order => (
              <tr key={order.id} className="border-t hover:bg-slate-50">
                <td className="p-3 font-medium">{order.orderNumber}</td>
                <td className="p-3">{order.customerEmail || '-'}</td>
                <td className="p-3 text-center">{order.itemCount || order.lineItems?.length || 0}</td>
                <td className="p-3 text-right font-medium">{fmt(order.grandTotal)}</td>
                <td className="p-3">{fmtDate(order.createdAt)}</td>
                <td className="p-3 text-right space-x-2">
                  <button onClick={() => openEdit(order)} className="text-blue-600 hover:underline text-xs">Edit</button>
                  <button onClick={() => handleConvert(order.id)} className="text-green-600 hover:underline text-xs">Convert</button>
                  <button onClick={() => handleDelete(order.id)} className="text-red-600 hover:underline text-xs">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={page} totalPages={totalPages} totalItems={totalItems} pageSize={20} onPageChange={(p) => setPage(p)} />
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl my-8">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">{editingId ? 'Edit Draft Order' : 'New Draft Order'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
            </div>
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}

              {/* Customer Info */}
              <div>
                <h3 className="text-sm font-medium text-slate-700 mb-2">Customer Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Email *</label>
                    <input type="email" value={form.customerEmail} onChange={e => setForm(f => ({ ...f, customerEmail: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Phone</label>
                    <input value={form.customerPhone} onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-xs text-slate-500 mb-1">Customer Notes</label>
                  <textarea value={form.customerNotes} onChange={e => setForm(f => ({ ...f, customerNotes: e.target.value }))} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
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
                    <span className="col-span-4">Product Name</span>
                    <span className="col-span-2">SKU</span>
                    <span className="col-span-2">Qty</span>
                    <span className="col-span-2">Unit Price</span>
                    <span className="col-span-1 text-right">Total</span>
                    <span className="col-span-1"></span>
                  </div>
                  {form.lineItems.map((li, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <input value={li.productName} onChange={e => updateLineItem(i, 'productName', e.target.value)} placeholder="Product name" className="col-span-4 border rounded px-2 py-1.5 text-sm" />
                      <input value={li.sku} onChange={e => updateLineItem(i, 'sku', e.target.value)} placeholder="SKU" className="col-span-2 border rounded px-2 py-1.5 text-sm" />
                      <input type="number" value={li.quantity} onChange={e => updateLineItem(i, 'quantity', Number(e.target.value))} className="col-span-2 border rounded px-2 py-1.5 text-sm" min="1" />
                      <input type="number" value={li.unitPrice} onChange={e => updateLineItem(i, 'unitPrice', Number(e.target.value))} className="col-span-2 border rounded px-2 py-1.5 text-sm" min="0" step="0.01" />
                      <span className="col-span-1 text-sm text-right font-medium">{fmt(li.quantity * li.unitPrice)}</span>
                      <button onClick={() => removeLineItem(i)} className="col-span-1 text-red-400 hover:text-red-600 text-center">&times;</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Shipping */}
              <div>
                <h3 className="text-sm font-medium text-slate-700 mb-2">Shipping Address</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input placeholder="Street" value={form.shippingStreet} onChange={e => setForm(f => ({ ...f, shippingStreet: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm" />
                  <input placeholder="City" value={form.shippingCity} onChange={e => setForm(f => ({ ...f, shippingCity: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm" />
                  <input placeholder="State" value={form.shippingState} onChange={e => setForm(f => ({ ...f, shippingState: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm" />
                  <input placeholder="ZIP" value={form.shippingZip} onChange={e => setForm(f => ({ ...f, shippingZip: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm" />
                  <input placeholder="Country" value={form.shippingCountry} onChange={e => setForm(f => ({ ...f, shippingCountry: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm sm:col-span-2" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Shipping Method</label>
                    <select value={form.shippingMethod} onChange={e => setForm(f => ({ ...f, shippingMethod: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                      <option value="standard">Standard</option>
                      <option value="express">Express</option>
                      <option value="overnight">Overnight</option>
                      <option value="pickup">Pickup</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Shipping Cost</label>
                    <input type="number" value={form.shippingCost} onChange={e => setForm(f => ({ ...f, shippingCost: Number(e.target.value) }))} className="w-full border rounded-lg px-3 py-2 text-sm" min="0" step="0.01" />
                  </div>
                </div>
              </div>

              {/* Tax */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Tax Rate (%)</label>
                <input type="number" value={form.taxRate} onChange={e => setForm(f => ({ ...f, taxRate: Number(e.target.value) }))} className="w-32 border rounded-lg px-3 py-2 text-sm" min="0" step="0.01" />
              </div>

              {/* Totals */}
              <div className="bg-slate-50 rounded-lg p-4 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="font-medium">{fmt(subtotal())}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Tax ({form.taxRate}%)</span><span className="font-medium">{fmt(taxAmount())}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Shipping</span><span className="font-medium">{fmt(form.shippingCost)}</span></div>
                <div className="flex justify-between border-t pt-2 mt-2"><span className="font-semibold">Total</span><span className="font-bold text-lg">{fmt(total())}</span></div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving...' : editingId ? 'Update Draft' : 'Create Draft Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
