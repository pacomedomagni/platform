'use client';

import { useState, useEffect } from 'react';
import api from '../../../lib/api';

interface CartStats {
  totalAbandoned: number;
  emailsSent: number;
  recovered: number;
  recoveryRate: number;
  recoveredRevenue: number;
}

interface AbandonedCart {
  id: string;
  customerEmail: string;
  cartValue: number;
  itemsCount: number;
  abandonedAt: string;
  emailsSent: number;
  status: 'abandoned' | 'email_sent' | 'recovered';
  emailSequence?: { step: number; status: string; sentAt?: string }[];
}

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  abandoned: { label: 'Abandoned', bg: 'bg-red-100', text: 'text-red-700' },
  email_sent: { label: 'Email Sent', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  recovered: { label: 'Recovered', bg: 'bg-green-100', text: 'text-green-700' },
};

export default function AbandonedCartsPage() {
  const [carts, setCarts] = useState<AbandonedCart[]>([]);
  const [stats, setStats] = useState<CartStats>({
    totalAbandoned: 0,
    emailsSent: 0,
    recovered: 0,
    recoveryRate: 0,
    recoveredRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [scheduling, setScheduling] = useState(false);
  const [expandedCart, setExpandedCart] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [cartsRes, statsRes] = await Promise.all([
        api.get('/v1/store/admin/abandoned-carts'),
        api.get('/v1/store/admin/abandoned-carts/stats'),
      ]);
      setCarts(cartsRes.data.data || cartsRes.data || []);
      const s = statsRes.data.data || statsRes.data || {};
      setStats({
        totalAbandoned: s.totalAbandoned || 0,
        emailsSent: s.emailsSent || 0,
        recovered: s.recovered || 0,
        recoveryRate: s.recoveryRate || 0,
        recoveredRevenue: s.recoveredRevenue || 0,
      });
    } catch (err) {
      console.error('Failed to load abandoned carts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleScheduleEmails = async () => {
    setScheduling(true);
    try {
      await api.post('/v1/store/admin/abandoned-carts/schedule');
      await loadData();
    } catch (err) {
      console.error('Failed to schedule recovery emails:', err);
    } finally {
      setScheduling(false);
    }
  };

  const handleMarkRecovered = async (cartId: string) => {
    try {
      await api.post(`/v1/store/admin/abandoned-carts/${cartId}/recover`);
      await loadData();
    } catch (err) {
      console.error('Failed to mark cart as recovered:', err);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const statCards = [
    { label: 'Total Abandoned', value: stats.totalAbandoned, icon: '\u{1F6D2}' },
    { label: 'Emails Sent', value: stats.emailsSent, icon: '\u{1F4E7}' },
    { label: 'Recovered', value: stats.recovered, icon: '\u{2705}' },
    { label: 'Recovery Rate', value: `${stats.recoveryRate.toFixed(1)}%`, icon: '\u{1F4C8}' },
    { label: 'Recovered Revenue', value: formatCurrency(stats.recoveredRevenue), icon: '\u{1F4B0}' },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Abandoned Cart Recovery
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitor and recover abandoned shopping carts
          </p>
        </div>
        <button
          onClick={handleScheduleEmails}
          disabled={scheduling}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {scheduling ? 'Scheduling...' : 'Schedule Recovery Emails'}
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-500">{stat.label}</span>
              <span className="text-lg">{stat.icon}</span>
            </div>
            <p className="text-xl font-bold text-slate-900">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">Cart ID</th>
                <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">Customer Email</th>
                <th className="text-right p-3 text-xs font-medium text-slate-500 uppercase">Cart Value</th>
                <th className="text-right p-3 text-xs font-medium text-slate-500 uppercase">Items</th>
                <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">Abandoned Since</th>
                <th className="text-right p-3 text-xs font-medium text-slate-500 uppercase">Emails Sent</th>
                <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    Loading abandoned carts...
                  </td>
                </tr>
              ) : carts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    No abandoned carts found
                  </td>
                </tr>
              ) : (
                carts.map((cart) => {
                  const badge = statusConfig[cart.status] || statusConfig.abandoned;
                  return (
                    <tr key={cart.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-3 text-sm font-mono text-slate-600">
                        {cart.id.substring(0, 8)}...
                      </td>
                      <td className="p-3 text-sm text-slate-700">{cart.customerEmail}</td>
                      <td className="p-3 text-sm text-right font-medium text-slate-900">
                        {formatCurrency(cart.cartValue)}
                      </td>
                      <td className="p-3 text-sm text-right text-slate-600">{cart.itemsCount}</td>
                      <td className="p-3 text-sm text-slate-500">{timeAgo(cart.abandonedAt)}</td>
                      <td className="p-3 text-sm text-right text-slate-600">{cart.emailsSent}</td>
                      <td className="p-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setExpandedCart(expandedCart === cart.id ? null : cart.id)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            View
                          </button>
                          {cart.status !== 'recovered' && (
                            <button
                              onClick={() => handleMarkRecovered(cart.id)}
                              className="text-xs text-green-600 hover:text-green-800 font-medium"
                            >
                              Mark Recovered
                            </button>
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

        {/* Expanded Cart Detail */}
        {expandedCart && (
          <div className="border-t border-slate-200 bg-slate-50 p-4">
            {(() => {
              const cart = carts.find((c) => c.id === expandedCart);
              if (!cart) return null;
              return (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-700">
                    Email Sequence for Cart {cart.id.substring(0, 8)}...
                  </h3>
                  {cart.emailSequence && cart.emailSequence.length > 0 ? (
                    <div className="flex flex-wrap gap-3">
                      {cart.emailSequence.map((step) => {
                        const stepColors: Record<string, string> = {
                          sent: 'bg-green-100 text-green-700 border-green-200',
                          pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
                          scheduled: 'bg-blue-100 text-blue-700 border-blue-200',
                          failed: 'bg-red-100 text-red-700 border-red-200',
                        };
                        const color = stepColors[step.status] || 'bg-slate-100 text-slate-600 border-slate-200';
                        return (
                          <div
                            key={step.step}
                            className={`border rounded-lg px-3 py-2 text-xs ${color}`}
                          >
                            <div className="font-medium">Email #{step.step}</div>
                            <div className="capitalize">{step.status}</div>
                            {step.sentAt && (
                              <div className="text-xs opacity-75 mt-1">
                                {new Date(step.sentAt).toLocaleString()}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">No email sequence data available</p>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
