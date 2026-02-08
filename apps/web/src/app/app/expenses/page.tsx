'use client';

import { useState, useEffect } from 'react';
import api from '../../../lib/api';

interface Expense {
  id: string;
  expenseNumber: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  paymentMethod: string;
  supplierName?: string;
  notes?: string;
  receiptUrl?: string;
  approved: boolean;
}

interface ExpenseCategory {
  id: string;
  name: string;
}

interface ExpenseStats {
  totalThisMonth: number;
  totalLastMonth: number;
  growthPercent: number;
  topCategory: string;
}

const emptyForm = {
  description: '',
  amount: 0,
  date: new Date().toISOString().split('T')[0],
  category: '',
  newCategory: '',
  paymentMethod: 'card',
  supplierName: '',
  notes: '',
  receiptUrl: '',
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [stats, setStats] = useState<ExpenseStats>({ totalThisMonth: 0, totalLastMonth: 0, growthPercent: 0, topCategory: '-' });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [newCategoryName, setNewCategoryName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [useNewCategory, setUseNewCategory] = useState(false);

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-';

  const loadStats = async () => {
    try {
      const res = await api.get('/v1/store/admin/expenses/stats');
      setStats(res.data.data || res.data);
    } catch { /* ignore */ }
  };

  const loadCategories = async () => {
    try {
      const res = await api.get('/v1/store/admin/expenses/categories');
      setCategories(res.data.data || res.data || []);
    } catch { /* ignore */ }
  };

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (categoryFilter) params.category = categoryFilter;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const res = await api.get('/v1/store/admin/expenses', { params });
      setExpenses(res.data.data || res.data || []);
    } catch (err: any) {
      console.error('Failed to load expenses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    loadCategories();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => loadExpenses(), 300);
    return () => clearTimeout(t);
  }, [search, categoryFilter, dateFrom, dateTo]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setUseNewCategory(false);
    setError('');
    setShowModal(true);
  };

  const openEdit = (exp: Expense) => {
    setEditingId(exp.id);
    setForm({
      description: exp.description,
      amount: exp.amount,
      date: exp.date?.split('T')[0] || '',
      category: exp.category,
      newCategory: '',
      paymentMethod: exp.paymentMethod || 'card',
      supplierName: exp.supplierName || '',
      notes: exp.notes || '',
      receiptUrl: exp.receiptUrl || '',
    });
    setUseNewCategory(false);
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const category = useNewCategory ? form.newCategory : form.category;
      const body = {
        description: form.description,
        amount: form.amount,
        date: form.date,
        category,
        paymentMethod: form.paymentMethod,
        supplierName: form.supplierName || undefined,
        notes: form.notes || undefined,
        receiptUrl: form.receiptUrl || undefined,
      };
      if (editingId) {
        await api.put(`/v1/store/admin/expenses/${editingId}`, body);
      } else {
        await api.post('/v1/store/admin/expenses', body);
      }
      setShowModal(false);
      loadExpenses();
      loadStats();
      loadCategories();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save expense');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense?')) return;
    try {
      await api.delete(`/v1/store/admin/expenses/${id}`);
      loadExpenses();
      loadStats();
    } catch (err: any) {
      console.error('Failed to delete expense:', err);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    setSaving(true);
    try {
      await api.post('/v1/store/admin/expenses/categories', { name: newCategoryName.trim() });
      setNewCategoryName('');
      loadCategories();
    } catch (err: any) {
      console.error('Failed to create category:', err);
    } finally {
      setSaving(false);
    }
  };

  const growthColor = stats.growthPercent > 0 ? 'text-red-600' : stats.growthPercent < 0 ? 'text-green-600' : 'text-slate-600';

  const statCards = [
    { label: 'This Month', value: fmt(stats.totalThisMonth) },
    { label: 'Last Month', value: fmt(stats.totalLastMonth) },
    { label: 'Growth', value: `${stats.growthPercent >= 0 ? '+' : ''}${stats.growthPercent.toFixed(1)}%`, className: growthColor },
    { label: 'Top Category', value: stats.topCategory || '-' },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Expenses</h1>
          <p className="text-sm text-slate-500 mt-1">Track and manage business expenses</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCategoryModal(true)} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-slate-50">Categories</button>
          <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">New Expense</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map(s => (
          <div key={s.label} className="bg-white border rounded-lg p-4">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={`text-lg font-bold mt-1 ${s.className || ''}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search expenses..." className="flex-1 border rounded-lg px-3 py-2 text-sm" />
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm sm:w-44">
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" placeholder="From" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" placeholder="To" />
      </div>

      {/* Table */}
      <div className="bg-white border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left p-3 font-medium">Expense #</th>
              <th className="text-left p-3 font-medium">Date</th>
              <th className="text-left p-3 font-medium">Description</th>
              <th className="text-left p-3 font-medium">Category</th>
              <th className="text-right p-3 font-medium">Amount</th>
              <th className="text-left p-3 font-medium">Payment</th>
              <th className="text-center p-3 font-medium">Approved</th>
              <th className="text-right p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="p-8 text-center text-slate-400">Loading...</td></tr>
            ) : expenses.length === 0 ? (
              <tr><td colSpan={8} className="p-8 text-center text-slate-400">No expenses found</td></tr>
            ) : expenses.map(exp => (
              <tr key={exp.id} className="border-t hover:bg-slate-50">
                <td className="p-3 font-medium">{exp.expenseNumber}</td>
                <td className="p-3">{fmtDate(exp.date)}</td>
                <td className="p-3 max-w-xs truncate">{exp.description}</td>
                <td className="p-3"><span className="px-2 py-1 bg-slate-100 rounded text-xs">{exp.category}</span></td>
                <td className="p-3 text-right font-medium">{fmt(exp.amount)}</td>
                <td className="p-3 text-xs capitalize">{exp.paymentMethod?.replace('_', ' ')}</td>
                <td className="p-3 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${exp.approved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {exp.approved ? 'Yes' : 'No'}
                  </span>
                </td>
                <td className="p-3 text-right space-x-2">
                  <button onClick={() => openEdit(exp)} className="text-blue-600 hover:underline text-xs">Edit</button>
                  <button onClick={() => handleDelete(exp.id)} className="text-red-600 hover:underline text-xs">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">{editingId ? 'Edit Expense' : 'New Expense'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description *</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Amount *</label>
                  <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))} className="w-full border rounded-lg px-3 py-2 text-sm" min="0" step="0.01" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-xs text-slate-500 flex items-center gap-1">
                    <input type="checkbox" checked={useNewCategory} onChange={e => setUseNewCategory(e.target.checked)} className="rounded" />
                    New Category
                  </label>
                </div>
                {useNewCategory ? (
                  <input value={form.newCategory} onChange={e => setForm(f => ({ ...f, newCategory: e.target.value }))} placeholder="Enter new category name" className="w-full border rounded-lg px-3 py-2 text-sm" />
                ) : (
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="">Select category</option>
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
                <select value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Supplier Name</label>
                <input value={form.supplierName} onChange={e => setForm(f => ({ ...f, supplierName: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Receipt URL</label>
                <input value={form.receiptUrl} onChange={e => setForm(f => ({ ...f, receiptUrl: e.target.value }))} placeholder="https://..." className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving...' : editingId ? 'Update Expense' : 'Create Expense'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Management Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">Expense Categories</h2>
              <button onClick={() => setShowCategoryModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex gap-2">
                <input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="New category name" className="flex-1 border rounded-lg px-3 py-2 text-sm" onKeyDown={e => e.key === 'Enter' && handleCreateCategory()} />
                <button onClick={handleCreateCategory} disabled={saving || !newCategoryName.trim()} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">Add</button>
              </div>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {categories.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">No categories yet</p>
                ) : categories.map(c => (
                  <div key={c.id} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg">
                    <span className="text-sm">{c.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end p-6 border-t">
              <button onClick={() => setShowCategoryModal(false)} className="px-4 py-2 border rounded-lg text-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
