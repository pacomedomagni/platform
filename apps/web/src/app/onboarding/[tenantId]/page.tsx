'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';

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

  // Track the interval id in a ref so the polling effect can stop it from
  // anywhere (terminal state, unmount, error). The previous shape returned
  // a cleanup function from inside `.then(...)` — React only honors the
  // return value of the effect callback itself, so the interval was
  // leaking on every re-run and amplifying the 401 storm.
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async (): Promise<OnboardingStatus | null> => {
    try {
      // axios singleton attaches the Bearer token. The previous bare
      // `fetch` had no Authorization header, so the JWT-guarded
      // /:tenantId/status endpoint returned 401 on every poll.
      const res = await api.get<OnboardingStatus>(`/v1/onboarding/${tenantId}/status`);
      return res.data;
    } catch (err: any) {
      // 401 here means the user navigated to onboarding without a valid
      // session. Send them back to login rather than burning CPU polling.
      if (err?.response?.status === 401) {
        router.replace('/login?redirect=' + encodeURIComponent(window.location.pathname));
        return null;
      }
      setError(err?.response?.data?.message || err?.message || 'Failed to fetch status');
      return null;
    }
  }, [tenantId, router]);

  useEffect(() => {
    let cancelled = false;

    const stopPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const tick = async () => {
      const next = await fetchStatus();
      if (cancelled || !next) return;
      setStatus(next);

      // Auto-route once everything is good.
      if (next.provisioningStatus === 'READY' && next.paymentProviderStatus === 'active') {
        stopPolling();
        router.push('/app');
        return;
      }

      // Stop polling once provisioning is settled. After that the page is
      // interactive (user clicks "Connect Stripe" or "Skip"); there is
      // no value in continuing to poll. See O1 in docs/ui-audit.md.
      if (next.provisioningStatus === 'READY' || next.provisioningStatus === 'FAILED') {
        stopPolling();
      }
    };

    // Kick off the first call immediately, then poll every 2s until a
    // terminal state is reached.
    tick();
    intervalRef.current = setInterval(tick, 2000);

    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [fetchStatus, router]);

  const handlePaymentSetup = async () => {
    setIsInitiatingPayment(true);
    setError(null);

    try {
      const res = await api.post<{ url?: string }>(`/v1/onboarding/${tenantId}/payment/initiate`);
      const url = res.data.url;
      if (!url) throw new Error('Server returned no payment-setup URL.');
      window.location.href = url;
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to initiate payment setup',
      );
      setIsInitiatingPayment(false);
    }
  };

  // O2: skipping payment routes the user to the dashboard but never tells
  // the backend that onboarding is paused mid-flow. The dashboard banner
  // covers the visible "you still need payments" call-to-action; we don't
  // need to call /complete here (that would mark onboarding done with no
  // payment provider). Keep the navigation but flag for backend follow-up.
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
                {status.currentStep || 'Something went wrong while creating your store.'}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                This is usually a temporary issue. Please try again.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-5 w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Retry Setup
              </button>
              <a
                href="mailto:support@noslag.com"
                className="mt-3 block text-sm text-slate-500 transition hover:text-slate-700"
              >
                Still having trouble? Contact support
              </a>
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
                Now let&apos;s connect your payment provider so you can start accepting payments.
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
                Skip for now, I&apos;ll set this up later
              </button>
              <p className="mt-1 text-xs text-slate-400">
                Your store won&apos;t be able to accept payments until a payment provider is connected.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
