'use client';

import { useState, useEffect } from 'react';
import api from '../../../lib/api';

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  partyName: string;
  partyEmail: string;
  invoiceDate: string;
  dueDate: string;
  status: string;
  total: number;
  paidAmount: number;
  dueAmount: number;
  lineItems: LineItem[];
  billingAddress?: { street?: string; city?: string; state?: string; zip?: string; country?: string };
  notes?: string;
  terms?: string;
}

interface InvoiceStats {
  total: number;
  draft: number;
  sent: number;
  overdue: number;
  paid: number;
  totalRevenue: number;
  outstanding: number;
}

const emptyForm = {
  partyName: '',
  partyEmail: '',
  invoiceDate: new Date().toISOString().split('T')[0],
  dueDate: '',
  billingStreet: '',
  billingCity: '',
  billingState: '',
  billingZip: '',
  billingCountry: '',
  notes: '',
  terms: '',
  lineItems: [{ description: '', quantity: 1, unitPrice: 0, taxRate: 0 }] as LineItem[],
};

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SENT: 'bg-blue-100 text-blue-700',
  OVERDUE: 'bg-red-100 text-red-700',
  PAID: 'bg-green-100 text-green-700',
  PARTIALLY_PAID: 'bg-yellow-100 text-yellow-700',
  CANCELLED: 'bg-gray-200 text-gray-500',
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<InvoiceStats>({ total: 0, draft: 0, sent: 0, overdue: 0, paid: 0, totalRevenue: 0, outstanding: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [paymentInvoiceId, setPaymentInvoiceId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [paymentForm, setPaymentForm] = useState({ amount: 0, date: new Date().toISOString().split('T')[0], method: 'bank_transfer', reference: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-';

  const loadStats = async () => {
    try {
      const res = await api.get('/v1/store/admin/invoices/stats');
      setStats(res.data.data || res.data);
    } catch { /* ignore */ }
  };

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/v1/store/admin/invoices', { params });
      setInvoices(res.data.data || res.data || []);
    } catch (err: any) {
      console.error('Failed to load invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => loadInvoices(), 300);
    return () => clearTimeout(t);
  }, [search, statusFilter]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, lineItems: [{ description: '', quantity: 1, unitPrice: 0, taxRate: 0 }] });
    setError('');
    setShowModal(true);
  };

  const openEdit = (inv: Invoice) => {
    setEditingId(inv.id);
    setForm({
      partyName: inv.partyName,
      partyEmail: inv.partyEmail,
      invoiceDate: inv.invoiceDate?.split('T')[0] || '',
      dueDate: inv.dueDate?.split('T')[0] || '',
      billingStreet: inv.billingAddress?.street || '',
      billingCity: inv.billingAddress?.city || '',
      billingState: inv.billingAddress?.state || '',
      billingZip: inv.billingAddress?.zip || '',
      billingCountry: inv.billingAddress?.country || '',
      notes: inv.notes || '',
      terms: inv.terms || '',
      lineItems: inv.lineItems?.length ? inv.lineItems : [{ description: '', quantity: 1, unitPrice: 0, taxRate: 0 }],
    });
    setError('');
    setShowModal(true);
  };

  const addLineItem = () => setForm(f => ({ ...f, lineItems: [...f.lineItems, { description: '', quantity: 1, unitPrice: 0, taxRate: 0 }] }));
  const removeLineItem = (i: number) => setForm(f => ({ ...f, lineItems: f.lineItems.filter((_, idx) => idx !== i) }));
  const updateLineItem = (i: number, field: keyof LineItem, value: string | number) => {
    setForm(f => {
      const items = [...f.lineItems];
      items[i] = { ...items[i], [field]: value };
      return { ...f, lineItems: items };
    });
  };

  const lineTotal = (li: LineItem) => {
    const sub = li.quantity * li.unitPrice;
    return sub + sub * (li.taxRate / 100);
  };

  const formTotal = () => form.lineItems.reduce((s, li) => s + lineTotal(li), 0);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const body = {
        partyName: form.partyName,
        partyEmail: form.partyEmail,
        invoiceDate: form.invoiceDate,
        dueDate: form.dueDate,
        billingAddress: { street: form.billingStreet, city: form.billingCity, state: form.billingState, zip: form.billingZip, country: form.billingCountry },
        notes: form.notes,
        terms: form.terms,
        lineItems: form.lineItems,
      };
      if (editingId) {
        await api.put(`/v1/store/admin/invoices/${editingId}`, body);
      } else {
        await api.post('/v1/store/admin/invoices', body);
      }
      setShowModal(false);
      loadInvoices();
      loadStats();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save invoice');
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async (id: string) => {
    try {
      await api.post(`/v1/store/admin/invoices/${id}/send`);
      loadInvoices();
      loadStats();
    } catch (err: any) {
      console.error('Failed to send invoice:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this invoice?')) return;
    try {
      await api.delete(`/v1/store/admin/invoices/${id}`);
      loadInvoices();
      loadStats();
    } catch (err: any) {
      console.error('Failed to delete invoice:', err);
    }
  };

  const openPayment = (id: string) => {
    setPaymentInvoiceId(id);
    setPaymentForm({ amount: 0, date: new Date().toISOString().split('T')[0], method: 'bank_transfer', reference: '', notes: '' });
    setShowPaymentModal(true);
  };

  const handleRecordPayment = async () => {
    if (!paymentInvoiceId) return;
    setSaving(true);
    try {
      await api.post(`/v1/store/admin/invoices/${paymentInvoiceId}/payments`, paymentForm);
      setShowPaymentModal(false);
      loadInvoices();
      loadStats();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  const statCards = [
    { label: 'Total Invoices', value: stats.total },
    { label: 'Draft', value: stats.draft },
    { label: 'Sent', value: stats.sent },
    { label: 'Overdue', value: stats.overdue },
    { label: 'Paid', value: stats.paid },
    { label: 'Total Revenue', value: fmt(stats.totalRevenue) },
    { label: 'Outstanding', value: fmt(stats.outstanding) },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Invoices</h1>
          <p className="text-sm text-slate-500 mt-1">Create and manage invoices</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">New Invoice</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {statCards.map(s => (
          <div key={s.label} className="bg-white border rounded-lg p-4">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className="text-lg font-bold mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoices..." className="flex-1 border rounded-lg px-3 py-2 text-sm" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm sm:w-48">
          <option value="">All Statuses</option>
          {['DRAFT', 'SENT', 'OVERDUE', 'PAID', 'PARTIALLY_PAID', 'CANCELLED'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left p-3 font-medium">Invoice #</th>
              <th className="text-left p-3 font-medium">Customer</th>
              <th className="text-left p-3 font-medium">Date</th>
              <th className="text-left p-3 font-medium">Due Date</th>
              <th className="text-right p-3 font-medium">Total</th>
              <th className="text-right p-3 font-medium">Paid</th>
              <th className="text-right p-3 font-medium">Due</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-right p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="p-8 text-center text-slate-400">Loading...</td></tr>
            ) : invoices.length === 0 ? (
              <tr><td colSpan={9} className="p-8 text-center text-slate-400">No invoices found</td></tr>
            ) : invoices.map(inv => (
              <tr key={inv.id} className="border-t hover:bg-slate-50">
                <td className="p-3 font-medium">{inv.invoiceNumber}</td>
                <td className="p-3">{inv.partyName}<br /><span className="text-xs text-slate-400">{inv.partyEmail}</span></td>
                <td className="p-3">{fmtDate(inv.invoiceDate)}</td>
                <td className="p-3">{fmtDate(inv.dueDate)}</td>
                <td className="p-3 text-right font-medium">{fmt(inv.total)}</td>
                <td className="p-3 text-right">{fmt(inv.paidAmount)}</td>
                <td className="p-3 text-right">{fmt(inv.dueAmount)}</td>
                <td className="p-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[inv.status] || 'bg-gray-100 text-gray-600'}`}>{inv.status.replace('_', ' ')}</span></td>
                <td className="p-3 text-right space-x-2">
                  <button onClick={() => openEdit(inv)} className="text-blue-600 hover:underline text-xs">View</button>
                  {inv.status === 'DRAFT' && <button onClick={() => handleSend(inv.id)} className="text-indigo-600 hover:underline text-xs">Send</button>}
                  {['SENT', 'OVERDUE', 'PARTIALLY_PAID'].includes(inv.status) && <button onClick={() => openPayment(inv.id)} className="text-green-600 hover:underline text-xs">Payment</button>}
                  {inv.status === 'DRAFT' && <button onClick={() => handleDelete(inv.id)} className="text-red-600 hover:underline text-xs">Delete</button>}
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
              <h2 className="text-lg font-semibold">{editingId ? 'Edit Invoice' : 'New Invoice'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Party Name *</label>
                  <input value={form.partyName} onChange={e => setForm(f => ({ ...f, partyName: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Party Email</label>
                  <input type="email" value={form.partyEmail} onChange={e => setForm(f => ({ ...f, partyEmail: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Date</label>
                  <input type="date" value={form.invoiceDate} onChange={e => setForm(f => ({ ...f, invoiceDate: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
                  <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-slate-700 mb-2">Billing Address</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input placeholder="Street" value={form.billingStreet} onChange={e => setForm(f => ({ ...f, billingStreet: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm" />
                  <input placeholder="City" value={form.billingCity} onChange={e => setForm(f => ({ ...f, billingCity: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm" />
                  <input placeholder="State" value={form.billingState} onChange={e => setForm(f => ({ ...f, billingState: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm" />
                  <input placeholder="ZIP" value={form.billingZip} onChange={e => setForm(f => ({ ...f, billingZip: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm" />
                  <input placeholder="Country" value={form.billingCountry} onChange={e => setForm(f => ({ ...f, billingCountry: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm sm:col-span-2" />
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
                    <span className="col-span-4">Description</span>
                    <span className="col-span-2">Qty</span>
                    <span className="col-span-2">Unit Price</span>
                    <span className="col-span-2">Tax %</span>
                    <span className="col-span-1 text-right">Total</span>
                    <span className="col-span-1"></span>
                  </div>
                  {form.lineItems.map((li, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <input value={li.description} onChange={e => updateLineItem(i, 'description', e.target.value)} placeholder="Description" className="col-span-4 border rounded px-2 py-1.5 text-sm" />
                      <input type="number" value={li.quantity} onChange={e => updateLineItem(i, 'quantity', Number(e.target.value))} className="col-span-2 border rounded px-2 py-1.5 text-sm" min="1" />
                      <input type="number" value={li.unitPrice} onChange={e => updateLineItem(i, 'unitPrice', Number(e.target.value))} className="col-span-2 border rounded px-2 py-1.5 text-sm" min="0" step="0.01" />
                      <input type="number" value={li.taxRate} onChange={e => updateLineItem(i, 'taxRate', Number(e.target.value))} className="col-span-2 border rounded px-2 py-1.5 text-sm" min="0" step="0.01" />
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
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Terms & Conditions</label>
                <textarea value={form.terms} onChange={e => setForm(f => ({ ...f, terms: e.target.value }))} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving...' : editingId ? 'Update Invoice' : 'Create Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">Record Payment</h2>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount *</label>
                <input type="number" value={paymentForm.amount} onChange={e => setPaymentForm(f => ({ ...f, amount: Number(e.target.value) }))} className="w-full border rounded-lg px-3 py-2 text-sm" min="0" step="0.01" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                <input type="date" value={paymentForm.date} onChange={e => setPaymentForm(f => ({ ...f, date: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Method</label>
                <select value={paymentForm.method} onChange={e => setPaymentForm(f => ({ ...f, method: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reference</label>
                <input value={paymentForm.reference} onChange={e => setPaymentForm(f => ({ ...f, reference: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea value={paymentForm.notes} onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t">
              <button onClick={() => setShowPaymentModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
              <button onClick={handleRecordPayment} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {saving ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
