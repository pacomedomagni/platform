'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '../../../lib/api';

interface AlertStats {
  active: number;
  critical: number;
  warning: number;
  needingReorder: number;
}

interface ReorderAlert {
  id: string;
  itemName: string;
  currentStock: number;
  reorderLevel: number;
  suggestedQty: number;
  daysUntilStockout: number | null;
  salesRate: number;
  severity: 'critical' | 'warning' | 'info';
  status: 'active' | 'acknowledged' | 'ordered' | 'dismissed';
  createdAt: string;
}

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    critical: 'bg-red-100 text-red-800 border-red-200',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    info: 'bg-blue-100 text-blue-800 border-blue-200',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${styles[severity] || styles.info}`}>
      {severity.toUpperCase()}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-red-50 text-red-700',
    acknowledged: 'bg-blue-50 text-blue-700',
    ordered: 'bg-green-50 text-green-700',
    dismissed: 'bg-slate-100 text-slate-500',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );
}

export default function ReorderAlertsPage() {
  const [alerts, setAlerts] = useState<ReorderAlert[]>([]);
  const [stats, setStats] = useState<AlertStats>({ active: 0, critical: 0, warning: 0, needingReorder: 0 });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  const loadAlerts = useCallback(async () => {
    try {
      setError('');
      const params: Record<string, string> = {};
      if (filterSeverity) params.severity = filterSeverity;
      if (filterStatus) params.status = filterStatus;
      const [alertsRes, statsRes] = await Promise.all([
        api.get('/v1/store/admin/reorder-alerts', { params }),
        api.get('/v1/store/admin/reorder-alerts/stats'),
      ]);
      setAlerts(alertsRes.data.data || alertsRes.data || []);
      setStats(statsRes.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load reorder alerts');
    } finally {
      setLoading(false);
    }
  }, [filterSeverity, filterStatus]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await api.post('/v1/store/admin/reorder-alerts/generate');
      await loadAlerts();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to generate alerts');
    } finally {
      setGenerating(false);
    }
  };

  const handleAction = async (id: string, action: 'acknowledge' | 'dismiss' | 'create-po') => {
    setActionLoading(prev => ({ ...prev, [id + action]: true }));
    try {
      await api.post(`/v1/store/admin/reorder-alerts/${id}/${action}`);
      await loadAlerts();
    } catch (err: any) {
      setError(err.response?.data?.message || `Failed to ${action} alert`);
    } finally {
      setActionLoading(prev => ({ ...prev, [id + action]: false }));
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded w-56" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-slate-200 rounded-lg" />)}
          </div>
          <div className="h-96 bg-slate-200 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Reorder Alerts</h1>
          <p className="text-sm text-slate-500 mt-1">Proactive inventory reorder notifications</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 shadow-sm"
        >
          {generating ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
          {generating ? 'Scanning Inventory...' : 'Generate Alerts'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 ml-4">&times;</button>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <p className="text-sm text-slate-500 font-medium">Active Alerts</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{stats.active}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <p className="text-sm text-red-600 font-medium">Critical</p>
          <p className="text-2xl font-bold text-red-800 mt-1">{stats.critical}</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
          <p className="text-sm text-yellow-700 font-medium">Warnings</p>
          <p className="text-2xl font-bold text-yellow-800 mt-1">{stats.warning}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <p className="text-sm text-slate-500 font-medium">Needing Reorder</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{stats.needingReorder}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-wrap items-center gap-4">
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1">Severity</label>
          <select
            value={filterSeverity}
            onChange={e => setFilterSeverity(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 bg-white"
          >
            <option value="">All</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1">Status</label>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 bg-white"
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="ordered">Ordered</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </div>
        {(filterSeverity || filterStatus) && (
          <button
            onClick={() => { setFilterSeverity(''); setFilterStatus(''); }}
            className="text-sm text-indigo-600 hover:underline mt-4"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Alerts Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-slate-600 font-medium">Item</th>
                <th className="text-right px-4 py-3 text-slate-600 font-medium">Stock</th>
                <th className="text-right px-4 py-3 text-slate-600 font-medium">Reorder Lvl</th>
                <th className="text-right px-4 py-3 text-slate-600 font-medium">Suggested Qty</th>
                <th className="text-right px-4 py-3 text-slate-600 font-medium">Days Left</th>
                <th className="text-right px-4 py-3 text-slate-600 font-medium">Sales/Day</th>
                <th className="text-center px-4 py-3 text-slate-600 font-medium">Severity</th>
                <th className="text-center px-4 py-3 text-slate-600 font-medium">Status</th>
                <th className="text-right px-4 py-3 text-slate-600 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {alerts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                    No reorder alerts found. Click "Generate Alerts" to scan your inventory.
                  </td>
                </tr>
              ) : (
                alerts.map(alert => (
                  <tr key={alert.id} className={`border-b border-slate-100 hover:bg-slate-50 ${alert.severity === 'critical' ? 'bg-red-50/30' : ''}`}>
                    <td className="px-4 py-3 font-medium text-slate-900">{alert.itemName}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${alert.severity === 'critical' ? 'text-red-600' : 'text-slate-700'}`}>
                      {alert.currentStock}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">{alert.reorderLevel}</td>
                    <td className="px-4 py-3 text-right text-slate-900 font-medium">{alert.suggestedQty}</td>
                    <td className="px-4 py-3 text-right">
                      {alert.daysUntilStockout !== null ? (
                        <span className={alert.daysUntilStockout <= 3 ? 'text-red-600 font-semibold' : 'text-slate-600'}>
                          {alert.daysUntilStockout}d
                        </span>
                      ) : (
                        <span className="text-slate-400">--</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">{alert.salesRate.toFixed(1)}</td>
                    <td className="px-4 py-3 text-center"><SeverityBadge severity={alert.severity} /></td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={alert.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {alert.status === 'active' && (
                          <>
                            {alert.severity === 'critical' && (
                              <button
                                onClick={() => handleAction(alert.id, 'create-po')}
                                disabled={!!actionLoading[alert.id + 'create-po']}
                                className="px-2.5 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 disabled:opacity-50"
                              >
                                {actionLoading[alert.id + 'create-po'] ? '...' : 'Create PO'}
                              </button>
                            )}
                            <button
                              onClick={() => handleAction(alert.id, 'acknowledge')}
                              disabled={!!actionLoading[alert.id + 'acknowledge']}
                              className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded text-xs font-medium hover:bg-blue-100 disabled:opacity-50"
                            >
                              {actionLoading[alert.id + 'acknowledge'] ? '...' : 'Acknowledge'}
                            </button>
                            <button
                              onClick={() => handleAction(alert.id, 'dismiss')}
                              disabled={!!actionLoading[alert.id + 'dismiss']}
                              className="px-2.5 py-1 bg-slate-50 text-slate-600 border border-slate-200 rounded text-xs font-medium hover:bg-slate-100 disabled:opacity-50"
                            >
                              {actionLoading[alert.id + 'dismiss'] ? '...' : 'Dismiss'}
                            </button>
                          </>
                        )}
                        {alert.status === 'acknowledged' && (
                          <button
                            onClick={() => handleAction(alert.id, 'create-po')}
                            disabled={!!actionLoading[alert.id + 'create-po']}
                            className="px-2.5 py-1 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
                          >
                            {actionLoading[alert.id + 'create-po'] ? '...' : 'Create PO'}
                          </button>
                        )}
                        {alert.status === 'ordered' && (
                          <span className="text-xs text-green-600 font-medium">PO Created</span>
                        )}
                        {alert.status === 'dismissed' && (
                          <span className="text-xs text-slate-400">Dismissed</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
