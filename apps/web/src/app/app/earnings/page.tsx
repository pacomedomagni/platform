'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Skeleton, StatusBadge } from '@platform/ui';
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
  AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';

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
  /** Provider-account status from Stripe/Square. 'active' means payouts are enabled. */
  paymentStatus?: string;
  /** Connection presence — set false when the merchant hasn't connected any provider. */
  paymentsConnected?: boolean;
  paymentProvider?: string | null;
}

const _locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';

function formatCurrency(amount: number, currency = 'usd'): string {
  return new Intl.NumberFormat(_locale, {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString(_locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'N/A';
  }
}

function formatDateTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString(_locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return 'N/A';
  }
}

// Stripe/Square use lowercase enum strings (paid|pending|in_transit|canceled|failed).
// StatusBadge expects uppercased keys; normalise here so we never duplicate the lookup.
function PayoutStatusBadge({ status }: { status: string }) {
  return <StatusBadge kind="payout" status={status?.toUpperCase()} />;
}

export default function EarningsPage() {
  const router = useRouter();
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEarnings = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    setError(null);
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        router.push('/login');
        return;
      }

      // 6.1: axios interceptor handles 401 → /login redirect already, so
      // we don't have to clear the token + redirect manually.
      const res = await api.get('/v1/store/admin/dashboard/earnings');
      setData(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || (err instanceof Error ? err.message : 'An error occurred'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

  const handleOpenStripeDashboard = async () => {
    try {
      const tenantId = localStorage.getItem('tenantId');
      const res = await api.get<{ url: string }>(`/v1/onboarding/${tenantId}/stripe/dashboard`);
      window.open(res.data.url, '_blank');
    } catch (err: any) {
      setError(err?.response?.data?.message || (err instanceof Error ? err.message : 'Failed to open dashboard'));
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

        {/*
          Rose banner mirrors the dashboard banner so the disconnect state is consistent
          across screens. Single CTA points to the settings page where this gets fixed.
        */}
        <div role="status" className="flex items-center gap-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100">
            <CreditCard className="h-5 w-5 text-rose-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-rose-800">Connect a payment provider</h3>
            <p className="text-sm text-rose-700">
              Your store cannot accept payments — and you have no earnings to track — until Stripe or Square is connected.
            </p>
          </div>
          <Link
            href="/app/settings/payments"
            className="shrink-0 rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
          >
            Resolve in Settings
          </Link>
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
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-800"
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {/*
        Mirrors the dashboard rose banner — payments connected (we wouldn't be in this branch
        otherwise) but the provider account is not currently active. Rendered ABOVE the balance
        cards so the merchant can't miss it before reading numbers.
      */}
      {data.paymentStatus && data.paymentStatus !== 'active' && (
        <div role="status" className="flex items-center gap-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100">
            <AlertTriangle className="h-5 w-5 text-rose-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-rose-800">Payouts are paused</h3>
            <p className="text-sm text-rose-700">
              {data.paymentProvider
                ? data.paymentProvider.charAt(0).toUpperCase() + data.paymentProvider.slice(1)
                : 'Your payment provider'}{' '}
              needs additional information before payouts can resume.
            </p>
          </div>
          <Link
            href="/app/settings/payments"
            className="shrink-0 rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
          >
            Resolve in Settings
          </Link>
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

      {/*
        Totals breakdown — surfaces the platform fee inline alongside the numbers it impacts,
        so the merchant sees the deduction at the same glance as their balance, not buried below.
      */}
      <Card className="p-6">
        <h3 className="text-sm font-semibold text-slate-900">Earnings Summary</h3>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div className="flex items-baseline justify-between sm:flex-col sm:items-start sm:gap-1">
            <dt className="text-slate-500">Available</dt>
            <dd className="font-semibold text-slate-900">{formatCurrency(availableTotal)}</dd>
          </div>
          <div className="flex items-baseline justify-between sm:flex-col sm:items-start sm:gap-1">
            <dt className="text-slate-500">Pending</dt>
            <dd className="font-semibold text-slate-900">{formatCurrency(pendingTotal)}</dd>
          </div>
          <div className="flex items-baseline justify-between sm:flex-col sm:items-start sm:gap-1">
            <dt className="text-slate-500">Total Balance</dt>
            <dd className="font-semibold text-slate-900">{formatCurrency(totalEarnings)}</dd>
          </div>
          <div className="flex items-baseline justify-between sm:flex-col sm:items-start sm:gap-1">
            <dt className="text-slate-500">Platform fee</dt>
            <dd className="font-semibold text-slate-900">
              {data.platformFeePercent > 0 ? `${data.platformFeePercent}%` : '—'}
            </dd>
          </div>
        </dl>
      </Card>

      {/* Platform Fee Info — kept as the long-form explanation; the summary above is the at-a-glance view. */}
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
