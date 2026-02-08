'use client';

import { useState, useEffect } from 'react';
import api from '../../../lib/api';

interface TaxRule {
  id: string;
  name: string;
  rate: number;
  type: string;
  region: string;
  description?: string;
  isInclusive: boolean;
  isDefault: boolean;
  isActive: boolean;
  appliesTo: string;
}

const emptyForm = {
  name: '',
  rate: 0,
  type: 'percentage',
  region: '',
  description: '',
  isInclusive: false,
  isDefault: false,
  appliesTo: 'all',
};

export default function TaxRulesPage() {
  const [rules, setRules] = useState<TaxRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadRules = async () => {
    setLoading(true);
    try {
      const res = await api.get('/v1/store/admin/tax-rules');
      setRules(res.data.data || res.data || []);
    } catch (err: any) {
      console.error('Failed to load tax rules:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRules(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setError('');
    setShowModal(true);
  };

  const openEdit = (rule: TaxRule) => {
    setEditingId(rule.id);
    setForm({
      name: rule.name,
      rate: rule.rate,
      type: rule.type,
      region: rule.region || '',
      description: rule.description || '',
      isInclusive: rule.isInclusive,
      isDefault: rule.isDefault,
      appliesTo: rule.appliesTo || 'all',
    });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        await api.put(`/v1/store/admin/tax-rules/${editingId}`, form);
      } else {
        await api.post('/v1/store/admin/tax-rules', form);
      }
      setShowModal(false);
      loadRules();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save tax rule');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this tax rule?')) return;
    try {
      await api.delete(`/v1/store/admin/tax-rules/${id}`);
      loadRules();
    } catch (err: any) {
      console.error('Failed to delete tax rule:', err);
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Tax Rules</h1>
          <p className="text-sm text-slate-500 mt-1">Configure tax rates and rules for your store</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">New Tax Rule</button>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left p-3 font-medium">Name</th>
              <th className="text-right p-3 font-medium">Rate</th>
              <th className="text-left p-3 font-medium">Type</th>
              <th className="text-left p-3 font-medium">Region</th>
              <th className="text-center p-3 font-medium">Inclusive?</th>
              <th className="text-center p-3 font-medium">Default?</th>
              <th className="text-center p-3 font-medium">Active?</th>
              <th className="text-right p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="p-8 text-center text-slate-400">Loading...</td></tr>
            ) : rules.length === 0 ? (
              <tr><td colSpan={8} className="p-8 text-center text-slate-400">No tax rules found. Create one to get started.</td></tr>
            ) : rules.map(rule => (
              <tr key={rule.id} className="border-t hover:bg-slate-50">
                <td className="p-3 font-medium">{rule.name}</td>
                <td className="p-3 text-right">{rule.type === 'percentage' ? `${rule.rate}%` : `$${rule.rate.toFixed(2)}`}</td>
                <td className="p-3 capitalize">{rule.type}</td>
                <td className="p-3">{rule.region || '-'}</td>
                <td className="p-3 text-center">
                  <span className={`inline-block w-5 h-5 rounded-full text-xs font-bold leading-5 ${rule.isInclusive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                    {rule.isInclusive ? 'Y' : 'N'}
                  </span>
                </td>
                <td className="p-3 text-center">
                  <span className={`inline-block w-5 h-5 rounded-full text-xs font-bold leading-5 ${rule.isDefault ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
                    {rule.isDefault ? 'Y' : 'N'}
                  </span>
                </td>
                <td className="p-3 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${rule.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {rule.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="p-3 text-right space-x-2">
                  <button onClick={() => openEdit(rule)} className="text-blue-600 hover:underline text-xs">Edit</button>
                  <button onClick={() => handleDelete(rule.id)} className="text-red-600 hover:underline text-xs">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">{editingId ? 'Edit Tax Rule' : 'New Tax Rule'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. VAT, Sales Tax" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Rate *</label>
                  <input type="number" value={form.rate} onChange={e => setForm(f => ({ ...f, rate: Number(e.target.value) }))} className="w-full border rounded-lg px-3 py-2 text-sm" min="0" step="0.01" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Region</label>
                <input value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. US, CA, EU" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Applies To</label>
                <select value={form.appliesTo} onChange={e => setForm(f => ({ ...f, appliesTo: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="all">All</option>
                  <option value="products">Products</option>
                  <option value="services">Services</option>
                  <option value="shipping">Shipping</option>
                </select>
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.isInclusive} onChange={e => setForm(f => ({ ...f, isInclusive: e.target.checked }))} className="rounded border-gray-300" />
                  <span className="text-slate-700">Tax Inclusive</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.isDefault} onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))} className="rounded border-gray-300" />
                  <span className="text-slate-700">Default Rule</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving...' : editingId ? 'Update Rule' : 'Create Rule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
