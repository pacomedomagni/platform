'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface OnboardingStatus {
  tenantId: string;
  businessName: string;
  subdomain: string;
  onboardingStep: string;
  provisioningStatus: string;
  provisioningProgress: number;
  currentStep: string;
  paymentProvider: string | null;
  paymentProviderStatus: string | null;
  stripeChargesEnabled: boolean;
  squareMerchantId: string | null;
}

export default function OnboardingStatusPage() {
  const { tenantId } = useParams();
  const router = useRouter();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitiatingPayment, setIsInitiatingPayment] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/onboarding/${tenantId}/status`);
      if (!res.ok) throw new Error('Failed to fetch status');
      const data = await res.json();
      setStatus(data);
      return data;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, [tenantId]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(async () => {
      const data = await fetchStatus();
      if (!data) return;

      // Stop polling once provisioning is done and payment is active
      if (data.provisioningStatus === 'READY' && data.paymentProviderStatus === 'active') {
        clearInterval(interval);
        router.push('/app');
      }

      // Stop polling once provisioning is complete (user needs to click to continue)
      if (data.provisioningStatus === 'READY') {
        clearInterval(interval);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [fetchStatus, router]);

  const handlePaymentSetup = async () => {
    setIsInitiatingPayment(true);
    setError(null);

    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/onboarding/${tenantId}/payment/initiate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to initiate payment setup');
      }

      const { url } = await res.json();
      window.location.href = url;
    } catch (err: any) {
      setError(err.message);
      setIsInitiatingPayment(false);
    }
  };

  const handleSkipForNow = () => {
    router.push('/app');
  };

  if (error && !status) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="w-full max-w-lg rounded-xl bg-white p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-500">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold">Something went wrong</h1>
          <p className="mt-2 text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
      </div>
    );
  }

  const isProvisioning = status.provisioningStatus !== 'READY';
  const provisioningFailed = status.provisioningStatus === 'FAILED';

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4 py-12">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 text-white">
          <h1 className="text-2xl font-bold">Welcome to NoSlag</h1>
          <p className="mt-1 text-blue-100">Setting up {status.businessName}</p>
        </div>

        <div className="p-8">
          {/* Provisioning in progress */}
          {isProvisioning && !provisioningFailed && (
            <div className="text-center">
              <div className="mx-auto mb-5 h-14 w-14 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
              <h2 className="text-xl font-semibold">Creating Your Store...</h2>
              <p className="mt-2 text-sm text-slate-500">
                {status.currentStep || 'This will only take a moment'}
              </p>
              <div className="mt-6">
                <div className="h-2.5 w-full rounded-full bg-slate-200">
                  <div
                    className="h-2.5 rounded-full bg-blue-600 transition-all duration-500"
                    style={{ width: `${status.provisioningProgress}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">{status.provisioningProgress}% complete</p>
              </div>
            </div>
          )}

          {/* Provisioning failed */}
          {provisioningFailed && (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-500">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold">Setup Failed</h2>
              <p className="mt-2 text-sm text-slate-500">
                Something went wrong during setup. Please try again or contact support.
              </p>
            </div>
          )}

          {/* Provisioning complete — payment setup */}
          {!isProvisioning && !provisioningFailed && (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold">Store Created</h2>
              <p className="mt-2 text-sm text-slate-500">
                Now let's connect your payment provider so you can start accepting payments.
              </p>

              <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-5 text-left">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold capitalize">{status.paymentProvider}</p>
                    <p className="text-xs text-slate-500">
                      {status.paymentProvider === 'stripe'
                        ? "You'll be redirected to Stripe to complete setup (2-3 min)"
                        : "You'll be redirected to Square to authorize your account"}
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <button
                onClick={handlePaymentSetup}
                disabled={isInitiatingPayment}
                className="mt-6 w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {isInitiatingPayment
                  ? 'Redirecting...'
                  : `Connect ${status.paymentProvider === 'stripe' ? 'Stripe' : 'Square'}`}
              </button>

              <button
                onClick={handleSkipForNow}
                className="mt-3 w-full rounded-lg py-2 text-sm text-slate-500 transition hover:text-slate-700"
              >
                Skip for now, I'll set this up later
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
