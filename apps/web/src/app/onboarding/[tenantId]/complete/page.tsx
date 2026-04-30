'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { unwrapJson } from '@/lib/admin-fetch';

function OnboardingCompleteContent() {
  const { tenantId } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isCompleting, setIsCompleting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const provider = searchParams.get('provider');

  useEffect(() => {
    let cancelled = false;
    let redirectTimer: ReturnType<typeof setTimeout> | null = null;

    const completeOnboarding = async () => {
      // Idempotency guard against reload during the 3s redirect window:
      // record the tenant id we've already POSTed to /complete in
      // sessionStorage so a refresh doesn't double-fire. See C1 in
      // docs/ui-audit.md.
      const storageKey = 'onboarding_completed_for';
      try {
        if (typeof window !== 'undefined' && sessionStorage.getItem(storageKey) === tenantId) {
          // Already completed this session; skip the POST and just route on.
          if (!cancelled) setIsCompleting(false);
          redirectTimer = setTimeout(() => {
            if (!cancelled) router.push('/app');
          }, 1500);
          return;
        }

        const token = localStorage.getItem('access_token');
        if (!token) {
          throw new Error('Please sign in again to complete onboarding.');
        }
        const res = await fetch(`/api/v1/onboarding/${tenantId}/complete`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!res.ok) {
          const err = unwrapJson(await res.json().catch(() => null));
          throw new Error(err.message || 'Failed to complete onboarding');
        }

        if (typeof window !== 'undefined') {
          sessionStorage.setItem(storageKey, String(tenantId));
        }
        if (cancelled) return;
        setIsCompleting(false);

        // Redirect to dashboard after 3 seconds. Timer is cleared on
        // unmount so navigating away mid-countdown doesn't force a redirect.
        redirectTimer = setTimeout(() => {
          if (!cancelled) router.push('/app');
        }, 3000);
      } catch (err: any) {
        if (cancelled) return;
        setError(err.message);
        setIsCompleting(false);
      }
    };

    completeOnboarding();

    return () => {
      cancelled = true;
      if (redirectTimer) clearTimeout(redirectTimer);
    };
  }, [tenantId, router]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="w-full max-w-lg rounded-xl bg-white p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-500">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold">Almost There</h1>
          <p className="mt-2 text-slate-600">{error}</p>
          <button
            onClick={() => router.push(`/onboarding/${tenantId}`)}
            className="mt-6 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50">
      <div className="w-full max-w-lg rounded-2xl bg-white p-10 text-center shadow-xl">
        {isCompleting ? (
          <>
            <div className="mx-auto mb-5 h-14 w-14 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
            <h1 className="text-2xl font-bold">Finalizing Setup...</h1>
            <p className="mt-2 text-slate-500">Just a moment</p>
          </>
        ) : (
          <>
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-green-600">
              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-slate-900">You're All Set!</h1>
            <p className="mt-3 text-lg text-slate-600">
              Your {provider === 'stripe' ? 'Stripe' : 'Square'} account has been connected.
            </p>
            <p className="mt-6 text-sm text-slate-400">Redirecting to your dashboard...</p>
            <div className="mt-4 flex justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}


export default function OnboardingCompletePage() {
  return (
    <Suspense>
      <OnboardingCompleteContent />
    </Suspense>
  );
}
