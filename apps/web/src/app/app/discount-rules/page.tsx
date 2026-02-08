'use client';

import { useState, useEffect } from 'react';
import api from '../../../lib/api';

interface DiscountRule {
  id: string;
  name: string;
  type: string;
  value: number;
  minOrderAmount?: number;
  minItemQuantity?: number;
  maxDiscount?: number;
  buyQuantity?: number;
  getQuantity?: number;
  getDiscountPercent?: number;
  spendThreshold?: number;
  discountAmount?: number;
  isAutomatic: boolean;
  isActive: boolean;
  usageCount: number;
  usageLimit?: number;
  startDate?: string;
  endDate?: string;
  priority?: number;
  createdAt: string;
}

interface RuleForm {
  name: string;
  type: string;
  value: number;
  minOrderAmount: number;
  minItemQuantity: number;
  maxDiscount: number;
  buyQuantity: number;
  getQuantity: number;
  getDiscountPercent: number;
  spendThreshold: number;
  discountAmount: number;
  isAutomatic: boolean;
  usageLimit: number;
  startDate: string;
  endDate: string;
  priority: number;
}

const emptyForm: RuleForm = {
  name: '', type: 'PERCENTAGE_OFF', value: 0, minOrderAmount: 0, minItemQuantity: 0,
  maxDiscount: 0, buyQuantity: 0, getQuantity: 0, getDiscountPercent: 0,
  spendThreshold: 0, discountAmount: 0, isAutomatic: false, usageLimit: 0,
  startDate: '', endDate: '', priority: 0,
};

const typeLabels: Record<string, { label: string; bg: string; text: string }> = {
  PERCENTAGE_OFF: { label: '% Off', bg: 'bg-blue-100', text: 'text-blue-700' },
  FIXED_AMOUNT_OFF: { label: 'Fixed Off', bg: 'bg-green-100', text: 'text-green-700' },
  BUY_X_GET_Y: { label: 'Buy X Get Y', bg: 'bg-purple-100', text: 'text-purple-700' },
  FREE_SHIPPING: { label: 'Free Ship', bg: 'bg-orange-100', text: 'text-orange-700' },
  SPEND_X_GET_Y_OFF: { label: 'Spend & Save', bg: 'bg-pink-100', text: 'text-pink-700' },
};

export default function DiscountRulesPage() {
  const [rules, setRules] = useState<DiscountRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RuleForm>(emptyForm);
  const [testSubtotal, setTestSubtotal] = useState('');
  const [testQuantity, setTestQuantity] = useState('');
  const [testResults, setTestResults] = useState<any[] | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  const loadRules = async () => {
    try {
      const res = await api.get('/v1/store/admin/discount-rules');
      setRules(res.data.data || res.data || []);
    } catch (err) {
      console.error('Failed to load discount rules:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (rule: DiscountRule) => {
    setEditingId(rule.id);
    setForm({
      name: rule.name,
      type: rule.type,
      value: rule.value || 0,
      minOrderAmount: rule.minOrderAmount || 0,
      minItemQuantity: rule.minItemQuantity || 0,
      maxDiscount: rule.maxDiscount || 0,
      buyQuantity: rule.buyQuantity || 0,
      getQuantity: rule.getQuantity || 0,
      getDiscountPercent: rule.getDiscountPercent || 0,
      spendThreshold: rule.spendThreshold || 0,
      discountAmount: rule.discountAmount || 0,
      isAutomatic: rule.isAutomatic,
      usageLimit: rule.usageLimit || 0,
      startDate: rule.startDate ? rule.startDate.split('T')[0] : '',
      endDate: rule.endDate ? rule.endDate.split('T')[0] : '',
      priority: rule.priority || 0,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      const payload: any = {
        name: form.name,
        type: form.type,
        isAutomatic: form.isAutomatic,
        priority: form.priority || 0,
      };
      if (form.minOrderAmount > 0) payload.minOrderAmount = form.minOrderAmount;
      if (form.minItemQuantity > 0) payload.minItemQuantity = form.minItemQuantity;
      if (form.usageLimit > 0) payload.usageLimit = form.usageLimit;
      if (form.startDate) payload.startDate = form.startDate;
      if (form.endDate) payload.endDate = form.endDate;

      if (form.type === 'PERCENTAGE_OFF') {
        payload.value = form.value;
        if (form.maxDiscount > 0) payload.maxDiscount = form.maxDiscount;
      } else if (form.type === 'FIXED_AMOUNT_OFF') {
        payload.value = form.value;
      } else if (form.type === 'BUY_X_GET_Y') {
        payload.buyQuantity = form.buyQuantity;
        payload.getQuantity = form.getQuantity;
        payload.getDiscountPercent = form.getDiscountPercent;
      } else if (form.type === 'FREE_SHIPPING') {
        if (form.minOrderAmount > 0) payload.minOrderAmount = form.minOrderAmount;
      } else if (form.type === 'SPEND_X_GET_Y_OFF') {
        payload.spendThreshold = form.spendThreshold;
        payload.discountAmount = form.discountAmount;
      }

      if (editingId) {
        await api.put(`/v1/store/admin/discount-rules/${editingId}`, payload);
      } else {
        await api.post('/v1/store/admin/discount-rules', payload);
      }
      setShowModal(false);
      await loadRules();
    } catch (err) {
      console.error('Failed to save discount rule:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this discount rule?')) return;
    try {
      await api.delete(`/v1/store/admin/discount-rules/${id}`);
      await loadRules();
    } catch (err) {
      console.error('Failed to delete discount rule:', err);
    }
  };

  const handleToggleActive = async (rule: DiscountRule) => {
    try {
      await api.put(`/v1/store/admin/discount-rules/${rule.id}`, { isActive: !rule.isActive });
      await loadRules();
    } catch (err) {
      console.error('Failed to toggle rule:', err);
    }
  };

  const handleTest = async () => {
    setTestLoading(true);
    try {
      const res = await api.post('/v1/store/admin/discount-rules/evaluate', {
        subtotal: parseFloat(testSubtotal) || 0,
        quantity: parseInt(testQuantity) || 1,
      });
      setTestResults(res.data.data || res.data?.appliedRules || res.data || []);
    } catch (err) {
      console.error('Failed to test discount rules:', err);
    } finally {
      setTestLoading(false);
    }
  };

  const formatDate = (d?: string) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const activeCount = rules.filter((r) => r.isActive).length;
  const totalApplied = rules.reduce((sum, r) => sum + (r.usageCount || 0), 0);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Discount Rules</h1>
          <p className="text-sm text-slate-500 mt-1">Create and manage discount rules for your store</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
          Create Rule
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-sm text-slate-500">Active Rules</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{activeCount}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-sm text-slate-500">Total Discounts Applied</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{totalApplied}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">Name</th>
                <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">Type</th>
                <th className="text-right p-3 text-xs font-medium text-slate-500 uppercase">Value</th>
                <th className="text-right p-3 text-xs font-medium text-slate-500 uppercase">Min Order</th>
                <th className="text-center p-3 text-xs font-medium text-slate-500 uppercase">Active</th>
                <th className="text-center p-3 text-xs font-medium text-slate-500 uppercase">Mode</th>
                <th className="text-center p-3 text-xs font-medium text-slate-500 uppercase">Usage</th>
                <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">Schedule</th>
                <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="p-8 text-center text-slate-400">Loading rules...</td></tr>
              ) : rules.length === 0 ? (
                <tr><td colSpan={9} className="p-8 text-center text-slate-400">No discount rules found</td></tr>
              ) : (
                rules.map((rule) => {
                  const badge = typeLabels[rule.type] || { label: rule.type, bg: 'bg-slate-100', text: 'text-slate-700' };
                  return (
                    <tr key={rule.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-3 text-sm font-medium text-slate-900">{rule.name}</td>
                      <td className="p-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="p-3 text-sm text-right text-slate-700">
                        {rule.type === 'PERCENTAGE_OFF' ? `${rule.value}%` : rule.type === 'FIXED_AMOUNT_OFF' ? `$${rule.value}` : '-'}
                      </td>
                      <td className="p-3 text-sm text-right text-slate-600">
                        {rule.minOrderAmount ? `$${rule.minOrderAmount}` : '-'}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleToggleActive(rule)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${rule.isActive ? 'bg-green-500' : 'bg-slate-300'}`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${rule.isActive ? 'translate-x-4.5' : 'translate-x-1'}`} />
                        </button>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${rule.isAutomatic ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                          {rule.isAutomatic ? 'Auto' : 'Manual'}
                        </span>
                      </td>
                      <td className="p-3 text-sm text-center text-slate-600">
                        {rule.usageCount}{rule.usageLimit ? `/${rule.usageLimit}` : ''}
                      </td>
                      <td className="p-3 text-xs text-slate-500">
                        {rule.startDate || rule.endDate ? (
                          <>{formatDate(rule.startDate)} - {formatDate(rule.endDate)}</>
                        ) : (
                          <span className="text-slate-400">Always</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEdit(rule)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                          <button onClick={() => handleDelete(rule.id)} className="text-xs text-red-600 hover:text-red-800 font-medium">Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Test Discount Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Test Discount Rules</h2>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Subtotal ($)</label>
            <input
              type="number" value={testSubtotal} onChange={(e) => setTestSubtotal(e.target.value)}
              placeholder="100.00"
              className="w-36 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Quantity</label>
            <input
              type="number" value={testQuantity} onChange={(e) => setTestQuantity(e.target.value)}
              placeholder="1"
              className="w-28 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <button
            onClick={handleTest} disabled={testLoading}
            className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-900 disabled:opacity-50 transition-colors"
          >
            {testLoading ? 'Testing...' : 'Test'}
          </button>
        </div>
        {testResults !== null && (
          <div className="mt-4 border-t border-slate-200 pt-4">
            {Array.isArray(testResults) && testResults.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">Matching Rules:</p>
                {testResults.map((r: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm">
                    <span className="font-medium text-green-800">{r.name || r.ruleName || `Rule #${i + 1}`}</span>
                    {r.discount !== undefined && (
                      <span className="text-green-600">-${Number(r.discount).toFixed(2)}</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No rules match these cart parameters.</p>
            )}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto mx-4 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              {editingId ? 'Edit Discount Rule' : 'Create Discount Rule'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
                  <option value="PERCENTAGE_OFF">Percentage Off</option>
                  <option value="FIXED_AMOUNT_OFF">Fixed Amount Off</option>
                  <option value="BUY_X_GET_Y">Buy X Get Y</option>
                  <option value="FREE_SHIPPING">Free Shipping</option>
                  <option value="SPEND_X_GET_Y_OFF">Spend X Get Y Off</option>
                </select>
              </div>

              {/* Dynamic fields based on type */}
              {form.type === 'PERCENTAGE_OFF' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Discount %</label>
                    <input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Max Discount ($)</label>
                    <input type="number" value={form.maxDiscount} onChange={(e) => setForm({ ...form, maxDiscount: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                  </div>
                </>
              )}
              {form.type === 'FIXED_AMOUNT_OFF' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Amount ($)</label>
                  <input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                </div>
              )}
              {form.type === 'BUY_X_GET_Y' && (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Buy Qty</label>
                      <input type="number" value={form.buyQuantity} onChange={(e) => setForm({ ...form, buyQuantity: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Get Qty</label>
                      <input type="number" value={form.getQuantity} onChange={(e) => setForm({ ...form, getQuantity: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Get Discount %</label>
                      <input type="number" value={form.getDiscountPercent} onChange={(e) => setForm({ ...form, getDiscountPercent: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                    </div>
                  </div>
                </>
              )}
              {form.type === 'FREE_SHIPPING' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Min Order Amount ($)</label>
                  <input type="number" value={form.minOrderAmount} onChange={(e) => setForm({ ...form, minOrderAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                </div>
              )}
              {form.type === 'SPEND_X_GET_Y_OFF' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Spend Threshold ($)</label>
                    <input type="number" value={form.spendThreshold} onChange={(e) => setForm({ ...form, spendThreshold: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Discount Amount ($)</label>
                    <input type="number" value={form.discountAmount} onChange={(e) => setForm({ ...form, discountAmount: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                  </div>
                </div>
              )}

              {/* Common fields */}
              <div className="flex items-center gap-3 pt-2">
                <label className="text-sm font-medium text-slate-700">Is Automatic</label>
                <button
                  onClick={() => setForm({ ...form, isAutomatic: !form.isAutomatic })}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.isAutomatic ? 'bg-blue-500' : 'bg-slate-300'}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${form.isAutomatic ? 'translate-x-4.5' : 'translate-x-1'}`} />
                </button>
              </div>

              {form.type !== 'FREE_SHIPPING' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Min Order Amount ($)</label>
                  <input type="number" value={form.minOrderAmount} onChange={(e) => setForm({ ...form, minOrderAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Min Item Quantity</label>
                <input type="number" value={form.minItemQuantity} onChange={(e) => setForm({ ...form, minItemQuantity: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Usage Limit</label>
                  <input type="number" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                  <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
                  <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                <input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">Cancel</button>
              <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                {editingId ? 'Update Rule' : 'Create Rule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
