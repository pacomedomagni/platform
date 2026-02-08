'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '../../../lib/api';

interface Channel {
  id: string;
  type: 'SMS' | 'WHATSAPP' | 'EMAIL';
  provider: string;
  isActive: boolean;
  isConnected: boolean;
  config: Record<string, string>;
  enabledTypes: string[];
  createdAt: string;
}

interface LogEntry {
  id: string;
  recipient: string;
  type: string;
  channel: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  sentAt: string | null;
  deliveredAt: string | null;
  cost: number;
}

interface NotifStats {
  totalSent: number;
  delivered: number;
  failed: number;
  totalCost: number;
}

const NOTIFICATION_TYPES = ['Order Confirmation', 'Shipping Update', 'Delivery Confirm', 'Abandoned Cart'];

const CHANNEL_ICONS: Record<string, string> = {
  SMS: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  WHATSAPP: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  EMAIL: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
};

const CHANNEL_COLORS: Record<string, string> = {
  SMS: 'bg-blue-50 border-blue-200 text-blue-700',
  WHATSAPP: 'bg-green-50 border-green-200 text-green-700',
  EMAIL: 'bg-purple-50 border-purple-200 text-purple-700',
};

function LogStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-600',
    sent: 'bg-blue-100 text-blue-700',
    delivered: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.pending}`}>
      {status}
    </span>
  );
}

export default function NotificationsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<NotifStats>({ totalSent: 0, delivered: 0, failed: 0, totalCost: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [formType, setFormType] = useState<'SMS' | 'WHATSAPP' | 'EMAIL'>('SMS');
  const [formProvider, setFormProvider] = useState('twilio');
  const [formAccountSid, setFormAccountSid] = useState('');
  const [formAuthToken, setFormAuthToken] = useState('');
  const [formFromNumber, setFormFromNumber] = useState('');
  const [formEnabledTypes, setFormEnabledTypes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError('');
      const [channelsRes, logsRes, statsRes] = await Promise.all([
        api.get('/v1/store/admin/notifications/channels'),
        api.get('/v1/store/admin/notifications/logs'),
        api.get('/v1/store/admin/notifications/stats'),
      ]);
      setChannels(channelsRes.data.data || channelsRes.data || []);
      setLogs(logsRes.data.data || logsRes.data || []);
      setStats(statsRes.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load notification data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openAddModal = () => {
    setEditingChannel(null);
    setFormType('SMS');
    setFormProvider('twilio');
    setFormAccountSid('');
    setFormAuthToken('');
    setFormFromNumber('');
    setFormEnabledTypes([]);
    setShowModal(true);
  };

  const openEditModal = (ch: Channel) => {
    setEditingChannel(ch);
    setFormType(ch.type);
    setFormProvider(ch.provider);
    setFormAccountSid(ch.config.accountSid || '');
    setFormAuthToken(ch.config.authToken || '');
    setFormFromNumber(ch.config.fromNumber || '');
    setFormEnabledTypes(ch.enabledTypes || []);
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        type: formType,
        provider: formProvider,
        config: { accountSid: formAccountSid, authToken: formAuthToken, fromNumber: formFromNumber },
        enabledTypes: formEnabledTypes,
      };
      if (editingChannel) {
        await api.put(`/v1/store/admin/notifications/channels/${editingChannel.id}`, payload);
      } else {
        await api.post('/v1/store/admin/notifications/channels', payload);
      }
      setShowModal(false);
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save channel');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/v1/store/admin/notifications/channels/${id}`);
      setDeleteConfirm(null);
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete channel');
    }
  };

  const handleToggle = async (ch: Channel) => {
    try {
      await api.put(`/v1/store/admin/notifications/channels/${ch.id}`, {
        ...ch,
        isActive: !ch.isActive,
      });
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to toggle channel');
    }
  };

  const toggleNotifType = (type: string) => {
    setFormEnabledTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded w-64" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-36 bg-slate-200 rounded-lg" />)}
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
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Notification Channels</h1>
          <p className="text-sm text-slate-500 mt-1">Manage SMS, WhatsApp, and Email notification channels</p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Channel
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">&times;</button>
        </div>
      )}

      {/* Channel Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {channels.length === 0 ? (
          <div className="col-span-full bg-white border border-slate-200 rounded-xl p-8 text-center">
            <p className="text-slate-400">No channels configured. Add your first notification channel.</p>
          </div>
        ) : (
          channels.map(ch => (
            <div key={ch.id} className={`border rounded-xl p-5 ${CHANNEL_COLORS[ch.type] || 'bg-white border-slate-200'}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={CHANNEL_ICONS[ch.type] || CHANNEL_ICONS.EMAIL} />
                  </svg>
                  <div>
                    <h3 className="font-semibold">{ch.type}</h3>
                    <p className="text-xs opacity-70">{ch.provider}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${ch.isConnected ? 'bg-green-500' : 'bg-red-400'}`} />
                  <span className="text-xs">{ch.isConnected ? 'Connected' : 'Not connected'}</span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <button
                  onClick={() => handleToggle(ch)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${ch.isActive ? 'bg-green-500' : 'bg-slate-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${ch.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                <span className="text-xs font-medium">{ch.isActive ? 'Active' : 'Inactive'}</span>
              </div>

              <div className="mt-3 flex flex-wrap gap-1">
                {(ch.enabledTypes || []).map(t => (
                  <span key={t} className="px-2 py-0.5 bg-white/60 rounded text-[10px] font-medium">{t}</span>
                ))}
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => openEditModal(ch)}
                  className="px-3 py-1 bg-white/80 border border-current/20 rounded text-xs font-medium hover:bg-white"
                >
                  Edit
                </button>
                {deleteConfirm === ch.id ? (
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleDelete(ch.id)}
                      className="px-3 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="px-3 py-1 bg-white border border-slate-200 rounded text-xs font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(ch.id)}
                    className="px-3 py-1 bg-white/80 border border-current/20 rounded text-xs font-medium hover:bg-red-50 hover:text-red-600"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Notification Logs */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Notification Logs</h2>

        {/* Log Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-slate-500 font-medium">Total Sent</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{stats.totalSent}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-slate-500 font-medium">Delivered</p>
            <p className="text-xl font-bold text-green-600 mt-1">{stats.delivered}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-slate-500 font-medium">Failed</p>
            <p className="text-xl font-bold text-red-600 mt-1">{stats.failed}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-slate-500 font-medium">Total Cost</p>
            <p className="text-xl font-bold text-slate-900 mt-1">${stats.totalCost.toFixed(2)}</p>
          </div>
        </div>

        {/* Logs Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-slate-600 font-medium">Recipient</th>
                  <th className="text-left px-4 py-3 text-slate-600 font-medium">Type</th>
                  <th className="text-left px-4 py-3 text-slate-600 font-medium">Channel</th>
                  <th className="text-center px-4 py-3 text-slate-600 font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-slate-600 font-medium">Sent At</th>
                  <th className="text-left px-4 py-3 text-slate-600 font-medium">Delivered At</th>
                  <th className="text-right px-4 py-3 text-slate-600 font-medium">Cost</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">No notification logs yet</td>
                  </tr>
                ) : (
                  logs.map(log => (
                    <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-900 font-medium">{log.recipient}</td>
                      <td className="px-4 py-3 text-slate-600">{log.type}</td>
                      <td className="px-4 py-3 text-slate-600">{log.channel}</td>
                      <td className="px-4 py-3 text-center"><LogStatusBadge status={log.status} /></td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {log.sentAt ? new Date(log.sentAt).toLocaleString() : '--'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {log.deliveredAt ? new Date(log.deliveredAt).toLocaleString() : '--'}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">${log.cost.toFixed(3)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Channel Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-slate-900">
                  {editingChannel ? 'Edit Channel' : 'Add Channel'}
                </h3>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Channel Type</label>
                  <select
                    value={formType}
                    onChange={e => setFormType(e.target.value as 'SMS' | 'WHATSAPP' | 'EMAIL')}
                    disabled={!!editingChannel}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:bg-slate-100"
                  >
                    <option value="SMS">SMS</option>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="EMAIL">Email</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Provider</label>
                  <select
                    value={formProvider}
                    onChange={e => setFormProvider(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="twilio">Twilio</option>
                    <option value="messagebird">MessageBird</option>
                    <option value="sendgrid">SendGrid</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Account SID</label>
                  <input
                    type="text"
                    value={formAccountSid}
                    onChange={e => setFormAccountSid(e.target.value)}
                    placeholder="AC..."
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Auth Token</label>
                  <input
                    type="password"
                    value={formAuthToken}
                    onChange={e => setFormAuthToken(e.target.value)}
                    placeholder="Enter auth token"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">From Number</label>
                  <input
                    type="text"
                    value={formFromNumber}
                    onChange={e => setFormFromNumber(e.target.value)}
                    placeholder="+1234567890"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Enabled Notification Types</label>
                  <div className="space-y-2">
                    {NOTIFICATION_TYPES.map(type => (
                      <label key={type} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formEnabledTypes.includes(type)}
                          onChange={() => toggleNotifType(type)}
                          className="rounded border-slate-300 text-indigo-600"
                        />
                        <span className="text-sm text-slate-700">{type}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !formAccountSid || !formAuthToken}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingChannel ? 'Update Channel' : 'Add Channel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
