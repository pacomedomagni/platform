'use client';

import { useEffect, useState, useCallback } from 'react';

interface TenantPaymentInfo {
  paymentProvider: string | null;
  paymentProviderStatus: string;
  stripeChargesEnabled: boolean;
  stripePayoutsEnabled: boolean;
  stripeDetailsSubmitted: boolean;
  squareMerchantId: string | null;
  squareLocationId: string | null;
  platformFeePercent: number;
  platformFeeFixed: number;
}

export default function PaymentSettingsPage() {
  const [info, setInfo] = useState<TenantPaymentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null;

  const fetchPaymentInfo = useCallback(async () => {
    if (!tenantId) return;
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/v1/onboarding/${tenantId}/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch payment info');
      const data = await res.json();
      setInfo({
        paymentProvider: data.paymentProvider,
        paymentProviderStatus: data.paymentProviderStatus,
        stripeChargesEnabled: data.stripeChargesEnabled,
        stripePayoutsEnabled: data.stripePayoutsEnabled || false,
        stripeDetailsSubmitted: data.stripeDetailsSubmitted || false,
        squareMerchantId: data.squareMerchantId,
        squareLocationId: data.squareLocationId || null,
        platformFeePercent: data.platformFeePercent || 2.9,
        platformFeeFixed: data.platformFeeFixed || 0.30,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchPaymentInfo();
  }, [fetchPaymentInfo]);

  const handleOpenStripeDashboard = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/v1/onboarding/${tenantId}/stripe/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to get dashboard link');
      const { url } = await res.json();
      window.open(url, '_blank');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleReconnect = async () => {
    setIsReconnecting(true);
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/v1/onboarding/${tenantId}/payment/initiate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to initiate reconnection');
      const { url } = await res.json();
      window.location.href = url;
    } catch (err: any) {
      setError(err.message);
      setIsReconnecting(false);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'onboarding': return 'bg-amber-100 text-amber-700';
      case 'disabled': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold">Payment Settings</h1>
        <div className="mt-8 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-900">Payment Settings</h1>
      <p className="mt-1 text-sm text-slate-500">Manage your payment provider connection</p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {!info?.paymentProvider ? (
        <div className="mt-8 rounded-xl border-2 border-dashed border-slate-300 p-8 text-center">
          <p className="text-lg font-semibold text-slate-700">No Payment Provider Connected</p>
          <p className="mt-2 text-sm text-slate-500">
            Connect Stripe or Square to start accepting payments.
          </p>
          <button
            onClick={() => window.location.href = `/onboarding/${tenantId}`}
            className="mt-4 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Set Up Payments
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {/* Provider Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                  info.paymentProvider === 'stripe' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'
                }`}>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold capitalize">{info.paymentProvider}</h2>
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusColor(info.paymentProviderStatus)}`}>
                    {info.paymentProviderStatus}
                  </span>
                </div>
              </div>

              {info.paymentProviderStatus === 'active' && info.paymentProvider === 'stripe' && (
                <button
                  onClick={handleOpenStripeDashboard}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Open Stripe Dashboard
                </button>
              )}

              {info.paymentProviderStatus === 'disabled' && (
                <button
                  onClick={handleReconnect}
                  disabled={isReconnecting}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isReconnecting ? 'Redirecting...' : 'Reconnect'}
                </button>
              )}
            </div>

            {/* Provider-specific details */}
            {info.paymentProvider === 'stripe' && (
              <div className="mt-5 grid grid-cols-3 gap-4 border-t pt-5">
                <div>
                  <p className="text-xs text-slate-500">Charges</p>
                  <p className={`text-sm font-medium ${info.stripeChargesEnabled ? 'text-green-600' : 'text-slate-400'}`}>
                    {info.stripeChargesEnabled ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Payouts</p>
                  <p className={`text-sm font-medium ${info.stripePayoutsEnabled ? 'text-green-600' : 'text-slate-400'}`}>
                    {info.stripePayoutsEnabled ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Details Submitted</p>
                  <p className={`text-sm font-medium ${info.stripeDetailsSubmitted ? 'text-green-600' : 'text-slate-400'}`}>
                    {info.stripeDetailsSubmitted ? 'Yes' : 'No'}
                  </p>
                </div>
              </div>
            )}

            {info.paymentProvider === 'square' && (
              <div className="mt-5 grid grid-cols-2 gap-4 border-t pt-5">
                <div>
                  <p className="text-xs text-slate-500">Merchant ID</p>
                  <p className="text-sm font-medium font-mono">{info.squareMerchantId || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Location ID</p>
                  <p className="text-sm font-medium font-mono">{info.squareLocationId || 'N/A'}</p>
                </div>
              </div>
            )}
          </div>

          {/* Platform Fees */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="font-semibold text-slate-900">Platform Fees</h3>
            <p className="mt-1 text-sm text-slate-500">Fees deducted from each transaction</p>
            <div className="mt-4 flex gap-6">
              <div className="rounded-lg bg-slate-50 px-4 py-3">
                <p className="text-xs text-slate-500">Percentage Fee</p>
                <p className="text-lg font-bold">{info.platformFeePercent}%</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-4 py-3">
                <p className="text-xs text-slate-500">Fixed Fee</p>
                <p className="text-lg font-bold">${info.platformFeeFixed}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
