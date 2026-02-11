'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, Skeleton } from '@platform/ui';
import {
  DollarSign,
  TrendingUp,
  Clock,
  ArrowUpRight,
  Calendar,
  ExternalLink,
  RefreshCw,
  Banknote,
  AlertCircle,
  CreditCard,
} from 'lucide-react';
import Link from 'next/link';

interface BalanceAmount {
  amount: number;
  currency: string;
}

interface Payout {
  id: string;
  amount: number;
  currency: string;
  status: string;
  arrivalDate: string;
  createdAt: string;
}

interface EarningsData {
  balance: {
    available: BalanceAmount[];
    pending: BalanceAmount[];
  } | null;
  payouts: Payout[];
  platformFeePercent: number;
  message?: string;
}

function formatCurrency(amount: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function PayoutStatusBadge({ status }: { status: string }) {
  const styles: Record<string, { className: string; label: string }> = {
    paid: { className: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Paid' },
    pending: { className: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Pending' },
    in_transit: { className: 'bg-blue-50 text-blue-700 border-blue-200', label: 'In Transit' },
    canceled: { className: 'bg-red-50 text-red-700 border-red-200', label: 'Canceled' },
    failed: { className: 'bg-red-50 text-red-700 border-red-200', label: 'Failed' },
  };

  const style = styles[status] || { className: 'bg-slate-50 text-slate-600 border-slate-200', label: status };

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${style.className}`}>
      {style.label}
    </span>
  );
}

export default function EarningsPage() {
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEarnings = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const token = localStorage.getItem('access_token');
      const tenantId = localStorage.getItem('tenantId');

      const res = await fetch('/api/v1/store/admin/dashboard/earnings', {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-tenant-id': tenantId || '',
        },
      });

      if (!res.ok) throw new Error('Failed to load earnings');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

  const handleOpenStripeDashboard = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const tenantId = localStorage.getItem('tenantId');
      const res = await fetch(`/api/v1/onboarding/${tenantId}/stripe/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to get dashboard link');
      const { url } = await res.json();
      window.open(url, '_blank');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open dashboard');
    }
  };

  // Calculate totals
  const availableTotal = data?.balance?.available?.reduce((sum, b) => sum + b.amount, 0) ?? 0;
  const pendingTotal = data?.balance?.pending?.reduce((sum, b) => sum + b.amount, 0) ?? 0;
  const totalEarnings = availableTotal + pendingTotal;

  // Find next payout (first pending or in_transit)
  const nextPayout = data?.payouts?.find(p => p.status === 'pending' || p.status === 'in_transit');

  // Recent completed payouts
  const completedPayouts = data?.payouts?.filter(p => p.status === 'paid') ?? [];
  const lastPayout = completedPayouts[0];

  if (loading) {
    return (
      <div className="p-6 lg:p-8 space-y-8">
        <div>
          <Skeleton className="h-9 w-48" />
          <Skeleton className="mt-2 h-5 w-72" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-6">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-8 w-32" />
            </Card>
          ))}
        </div>
        <Card className="p-6">
          <Skeleton className="h-6 w-40" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  // No payment provider connected
  if (data?.message || !data?.balance) {
    return (
      <div className="p-6 lg:p-8 space-y-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Earnings</h1>
          <p className="mt-1 text-slate-500">Track your revenue and payouts</p>
        </div>

        <Card className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
            <CreditCard className="h-8 w-8 text-amber-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900">Connect Payment Provider</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            {data?.message || 'Connect Stripe or Square to start accepting payments and track your earnings.'}
          </p>
          <Link
            href="/app/settings/payments"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Set Up Payments
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Earnings</h1>
          <p className="mt-1 text-slate-500">Track your revenue and payouts</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchEarnings(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleOpenStripeDashboard}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Stripe Dashboard
            <ExternalLink className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Balance Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Available Balance */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Available Balance</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-slate-900">
            {formatCurrency(availableTotal)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Ready for payout</p>
        </Card>

        {/* Pending Balance */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Pending Balance</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-slate-900">
            {formatCurrency(pendingTotal)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Processing (usually 2-7 days)</p>
        </Card>

        {/* Total Earnings */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Total Balance</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-slate-900">
            {formatCurrency(totalEarnings)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Available + Pending</p>
        </Card>

        {/* Next Payout */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Next Payout</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <Calendar className="h-5 w-5" />
            </div>
          </div>
          {nextPayout ? (
            <>
              <p className="mt-3 text-3xl font-bold text-slate-900">
                {formatCurrency(nextPayout.amount, nextPayout.currency)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Arrives {formatDate(nextPayout.arrivalDate)}
              </p>
            </>
          ) : lastPayout ? (
            <>
              <p className="mt-3 text-xl font-semibold text-slate-700">
                Last: {formatCurrency(lastPayout.amount, lastPayout.currency)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {formatDate(lastPayout.arrivalDate)}
              </p>
            </>
          ) : (
            <>
              <p className="mt-3 text-lg font-medium text-slate-400">No payouts yet</p>
              <p className="mt-1 text-xs text-slate-500">Complete a sale to see payouts</p>
            </>
          )}
        </Card>
      </div>

      {/* Platform Fee Info */}
      {data.platformFeePercent > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <AlertCircle className="h-5 w-5 text-blue-600" />
          <p className="text-sm text-blue-700">
            <strong>Platform Fee:</strong> {data.platformFeePercent}% is deducted from each transaction. 
            Your balance shown is after fees.
          </p>
        </div>
      )}

      {/* How Payouts Work */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-slate-900">How Payouts Work</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600">
              1
            </div>
            <div>
              <p className="font-medium text-slate-900">Customer Pays</p>
              <p className="text-sm text-slate-500">Payment is captured at checkout</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-600">
              2
            </div>
            <div>
              <p className="font-medium text-slate-900">Processing Period</p>
              <p className="text-sm text-slate-500">Funds held 2-7 days (fraud protection)</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-600">
              3
            </div>
            <div>
              <p className="font-medium text-slate-900">Automatic Payout</p>
              <p className="text-sm text-slate-500">Deposited to your bank account</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Payout History */}
      <Card className="p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Payout History</h3>
            <p className="text-sm text-slate-500">Recent transfers to your bank account</p>
          </div>
          <button
            onClick={handleOpenStripeDashboard}
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            View all in Stripe →
          </button>
        </div>

        {data.payouts.length === 0 ? (
          <div className="py-12 text-center">
            <Banknote className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-4 text-slate-500">No payouts yet</p>
            <p className="mt-1 text-sm text-slate-400">
              Once you make sales, payouts will appear here
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                  <th className="pb-3 pr-4">Date</th>
                  <th className="pb-3 pr-4">Amount</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3">Arrival Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.payouts.map((payout) => (
                  <tr key={payout.id} className="text-sm">
                    <td className="py-4 pr-4 text-slate-600">
                      {formatDateTime(payout.createdAt)}
                    </td>
                    <td className="py-4 pr-4">
                      <span className="font-semibold text-slate-900">
                        {formatCurrency(payout.amount, payout.currency)}
                      </span>
                    </td>
                    <td className="py-4 pr-4">
                      <PayoutStatusBadge status={payout.status} />
                    </td>
                    <td className="py-4 text-slate-600">
                      {formatDate(payout.arrivalDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
