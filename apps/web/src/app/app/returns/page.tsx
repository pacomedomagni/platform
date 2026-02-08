'use client';

import { useState, useEffect } from 'react';
import api from '../../../lib/api';

interface ReturnStats {
  totalReturns: number;
  requested: number;
  approved: number;
  refunded: number;
  totalRefundAmount: number;
}

interface ReturnItem {
  id: string;
  productName: string;
  quantity: number;
  reason: string;
  amount: number;
}

interface Return {
  id: string;
  returnNumber: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  reason: string;
  itemsCount: number;
  refundAmount: number;
  status: string;
  items?: ReturnItem[];
  timeline?: { status: string; timestamp: string; note?: string }[];
  createdAt: string;
}

interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  price: number;
}

const statuses = ['REQUESTED', 'APPROVED', 'REJECTED', 'ITEMS_RECEIVED', 'RESTOCKED', 'REFUNDED', 'CLOSED'];
const reasons = ['damaged', 'wrong_item', 'not_as_described', 'changed_mind', 'defective', 'other'];

const statusColors: Record<string, { bg: string; text: string }> = {
  REQUESTED: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  APPROVED: { bg: 'bg-blue-100', text: 'text-blue-700' },
  REJECTED: { bg: 'bg-red-100', text: 'text-red-700' },
  ITEMS_RECEIVED: { bg: 'bg-purple-100', text: 'text-purple-700' },
  RESTOCKED: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  REFUNDED: { bg: 'bg-green-100', text: 'text-green-700' },
  CLOSED: { bg: 'bg-slate-100', text: 'text-slate-600' },
};

export default function ReturnsPage() {
  const [returns, setReturns] = useState<Return[]>([]);
  const [stats, setStats] = useState<ReturnStats>({ totalReturns: 0, requested: 0, approved: 0, refunded: 0, totalRefundAmount: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState<string | null>(null);

  // Create form state
  const [createOrderNumber, setCreateOrderNumber] = useState('');
  const [createReason, setCreateReason] = useState('damaged');
  const [createNotes, setCreateNotes] = useState('');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<{ itemId: string; quantity: number; reason: string }[]>([]);
  const [lookingUpOrder, setLookingUpOrder] = useState(false);

  // Refund form state
  const [refundAmount, setRefundAmount] = useState('');
  const [refundMethod, setRefundMethod] = useState('original_payment');
  const [rejectReason, setRejectReason] = useState('');

  const loadData = async () => {
    try {
      const params: any = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const [returnsRes, statsRes] = await Promise.all([
        api.get('/v1/store/admin/returns', { params }),
        api.get('/v1/store/admin/returns/stats'),
      ]);
      setReturns(returnsRes.data.data || returnsRes.data || []);
      const s = statsRes.data.data || statsRes.data || {};
      setStats({
        totalReturns: s.totalReturns || 0,
        requested: s.requested || 0,
        approved: s.approved || 0,
        refunded: s.refunded || 0,
        totalRefundAmount: s.totalRefundAmount || 0,
      });
    } catch (err) {
      console.error('Failed to load returns:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, statusFilter]);

  const lookupOrder = async () => {
    if (!createOrderNumber.trim()) return;
    setLookingUpOrder(true);
    try {
      const res = await api.get('/v1/store/admin/orders/all', { params: { search: createOrderNumber } });
      const orders = res.data.data || res.data || [];
      const order = orders[0];
      if (order?.items) {
        setOrderItems(order.items.map((item: any) => ({
          id: item.id, productName: item.productName || item.name, quantity: item.quantity, price: item.price || item.unitPrice,
        })));
      }
    } catch (err) {
      console.error('Failed to lookup order:', err);
    } finally {
      setLookingUpOrder(false);
    }
  };

  const toggleSelectItem = (itemId: string) => {
    setSelectedItems((prev) => {
      const exists = prev.find((si) => si.itemId === itemId);
      if (exists) return prev.filter((si) => si.itemId !== itemId);
      const orderItem = orderItems.find((oi) => oi.id === itemId);
      return [...prev, { itemId, quantity: orderItem?.quantity || 1, reason: 'damaged' }];
    });
  };

  const updateSelectedItem = (itemId: string, field: string, value: any) => {
    setSelectedItems((prev) => prev.map((si) => si.itemId === itemId ? { ...si, [field]: value } : si));
  };

  const handleCreateReturn = async () => {
    try {
      await api.post('/v1/store/admin/returns', {
        orderNumber: createOrderNumber,
        reason: createReason,
        notes: createNotes,
        items: selectedItems,
      });
      setShowCreateModal(false);
      setCreateOrderNumber('');
      setCreateReason('damaged');
      setCreateNotes('');
      setOrderItems([]);
      setSelectedItems([]);
      await loadData();
    } catch (err) {
      console.error('Failed to create return:', err);
    }
  };

  const handleAction = async (returnId: string, action: string, body?: any) => {
    try {
      await api.post(`/v1/store/admin/returns/${returnId}/${action}`, body || {});
      await loadData();
    } catch (err) {
      console.error(`Failed to ${action} return:`, err);
    }
  };

  const handleRefund = async () => {
    if (!showRefundModal) return;
    try {
      await api.post(`/v1/store/admin/returns/${showRefundModal}/refund`, {
        amount: parseFloat(refundAmount) || 0,
        method: refundMethod,
      });
      setShowRefundModal(null);
      setRefundAmount('');
      setRefundMethod('original_payment');
      await loadData();
    } catch (err) {
      console.error('Failed to process refund:', err);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const statCards = [
    { label: 'Total Returns', value: stats.totalReturns },
    { label: 'Requested', value: stats.requested },
    { label: 'Approved', value: stats.approved },
    { label: 'Refunded', value: stats.refunded },
    { label: 'Total Refund Amount', value: formatCurrency(stats.totalRefundAmount) },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Returns Management</h1>
          <p className="text-sm text-slate-500 mt-1">Process and track product returns</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
          Create Return
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className="text-sm text-slate-500">{stat.label}</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-wrap gap-3">
        <input
          value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search returns..."
          className="flex-1 min-w-[200px] px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
          <option value="">All Statuses</option>
          {statuses.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">Return #</th>
                <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">Order #</th>
                <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">Customer</th>
                <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">Reason</th>
                <th className="text-right p-3 text-xs font-medium text-slate-500 uppercase">Items</th>
                <th className="text-right p-3 text-xs font-medium text-slate-500 uppercase">Refund</th>
                <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">Created</th>
                <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="p-8 text-center text-slate-400">Loading returns...</td></tr>
              ) : returns.length === 0 ? (
                <tr><td colSpan={9} className="p-8 text-center text-slate-400">No returns found</td></tr>
              ) : (
                returns.map((ret) => {
                  const color = statusColors[ret.status] || statusColors.CLOSED;
                  const isExpanded = expandedId === ret.id;
                  return (
                    <tr key={ret.id} className="border-b border-slate-100">
                      <td className="p-3 text-sm font-medium text-slate-900">{ret.returnNumber}</td>
                      <td className="p-3 text-sm text-blue-600">{ret.orderNumber}</td>
                      <td className="p-3 text-sm text-slate-700">{ret.customerName || ret.customerEmail}</td>
                      <td className="p-3 text-sm text-slate-600 capitalize">{ret.reason?.replace('_', ' ')}</td>
                      <td className="p-3 text-sm text-right text-slate-600">{ret.itemsCount}</td>
                      <td className="p-3 text-sm text-right font-medium text-slate-900">{formatCurrency(ret.refundAmount)}</td>
                      <td className="p-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color.bg} ${color.text}`}>
                          {ret.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-3 text-sm text-slate-500">{formatDate(ret.createdAt)}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button onClick={() => setExpandedId(isExpanded ? null : ret.id)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                            {isExpanded ? 'Hide' : 'Details'}
                          </button>
                          {ret.status === 'REQUESTED' && (
                            <>
                              <button onClick={() => handleAction(ret.id, 'approve')}
                                className="text-xs text-green-600 hover:text-green-800 font-medium">Approve</button>
                              <button onClick={() => {
                                const reason = prompt('Rejection reason:');
                                if (reason) handleAction(ret.id, 'reject', { reason });
                              }} className="text-xs text-red-600 hover:text-red-800 font-medium">Reject</button>
                            </>
                          )}
                          {ret.status === 'APPROVED' && (
                            <button onClick={() => handleAction(ret.id, 'receive')}
                              className="text-xs text-purple-600 hover:text-purple-800 font-medium">Receive Items</button>
                          )}
                          {ret.status === 'ITEMS_RECEIVED' && (
                            <button onClick={() => handleAction(ret.id, 'restock')}
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Restock</button>
                          )}
                          {ret.status === 'RESTOCKED' && (
                            <button onClick={() => { setShowRefundModal(ret.id); setRefundAmount(String(ret.refundAmount)); }}
                              className="text-xs text-green-600 hover:text-green-800 font-medium">Process Refund</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Expanded Detail */}
        {expandedId && (() => {
          const ret = returns.find((r) => r.id === expandedId);
          if (!ret) return null;
          return (
            <div className="border-t border-slate-200 bg-slate-50 p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Items */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Return Items</h3>
                  {ret.items && ret.items.length > 0 ? (
                    <div className="space-y-2">
                      {ret.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2">
                          <div>
                            <p className="text-sm font-medium text-slate-800">{item.productName}</p>
                            <p className="text-xs text-slate-500">Qty: {item.quantity} | {item.reason?.replace('_', ' ')}</p>
                          </div>
                          <p className="text-sm font-medium text-slate-700">{formatCurrency(item.amount)}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">No item details available</p>
                  )}
                </div>
                {/* Timeline */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Status Timeline</h3>
                  {ret.timeline && ret.timeline.length > 0 ? (
                    <div className="space-y-3">
                      {ret.timeline.map((entry, i) => {
                        const tc = statusColors[entry.status] || statusColors.CLOSED;
                        return (
                          <div key={i} className="flex items-start gap-3">
                            <div className={`w-2.5 h-2.5 rounded-full mt-1.5 ${tc.bg.replace('100', '400')}`} />
                            <div>
                              <p className="text-sm font-medium text-slate-700">{entry.status.replace('_', ' ')}</p>
                              <p className="text-xs text-slate-500">{new Date(entry.timestamp).toLocaleString()}</p>
                              {entry.note && <p className="text-xs text-slate-500 mt-0.5">{entry.note}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">No timeline data available</p>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Create Return Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto mx-4 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Create Return</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Order Number</label>
                <div className="flex gap-2">
                  <input value={createOrderNumber} onChange={(e) => setCreateOrderNumber(e.target.value)}
                    placeholder="ORD-001"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                  <button onClick={lookupOrder} disabled={lookingUpOrder}
                    className="px-3 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-colors">
                    {lookingUpOrder ? '...' : 'Lookup'}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
                <select value={createReason} onChange={(e) => setCreateReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
                  {reasons.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea value={createNotes} onChange={(e) => setCreateNotes(e.target.value)} rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none" />
              </div>
              {orderItems.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Select Items to Return</label>
                  <div className="space-y-2">
                    {orderItems.map((item) => {
                      const isSelected = selectedItems.some((si) => si.itemId === item.id);
                      const selected = selectedItems.find((si) => si.itemId === item.id);
                      return (
                        <div key={item.id} className={`border rounded-lg p-3 transition-colors ${isSelected ? 'border-blue-300 bg-blue-50' : 'border-slate-200'}`}>
                          <div className="flex items-center gap-3">
                            <input type="checkbox" checked={isSelected} onChange={() => toggleSelectItem(item.id)}
                              className="h-4 w-4 rounded border-slate-300" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-slate-800">{item.productName}</p>
                              <p className="text-xs text-slate-500">Qty: {item.quantity} | ${item.price}</p>
                            </div>
                          </div>
                          {isSelected && selected && (
                            <div className="flex gap-3 mt-2 ml-7">
                              <div>
                                <label className="block text-xs text-slate-500 mb-0.5">Return Qty</label>
                                <input type="number" min={1} max={item.quantity} value={selected.quantity}
                                  onChange={(e) => updateSelectedItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                                  className="w-20 px-2 py-1 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none" />
                              </div>
                              <div>
                                <label className="block text-xs text-slate-500 mb-0.5">Reason</label>
                                <select value={selected.reason} onChange={(e) => updateSelectedItem(item.id, 'reason', e.target.value)}
                                  className="px-2 py-1 border border-slate-300 rounded text-xs bg-white focus:ring-1 focus:ring-blue-500 outline-none">
                                  {reasons.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                                </select>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">Cancel</button>
              <button onClick={handleCreateReturn} disabled={!createOrderNumber || selectedItems.length === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">Create Return</button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {showRefundModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Process Refund</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Refund Amount ($)</label>
                <input type="number" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Refund Method</label>
                <select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
                  <option value="original_payment">Original Payment</option>
                  <option value="store_credit">Store Credit</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
              <button onClick={() => setShowRefundModal(null)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">Cancel</button>
              <button onClick={handleRefund} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors">Process Refund</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
