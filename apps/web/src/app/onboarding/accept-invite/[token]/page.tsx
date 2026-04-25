'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, Button, Input, Label, Skeleton } from '@platform/ui';
import { Loader2, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface InvitePreview {
  email: string;
  firstName: string | null;
  lastName: string | null;
  roles: string[];
  storeName: string;
  expiresAt: string;
}

type FetchState =
  | { status: 'loading' }
  | { status: 'ok'; preview: InvitePreview }
  | { status: 'gone'; reason: string }
  | { status: 'notfound' }
  | { status: 'error'; message: string };

export default function AcceptInvitePage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;

  const [fetchState, setFetchState] = useState<FetchState>({ status: 'loading' });
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/v1/onboarding/invites/${encodeURIComponent(token)}`);
        if (cancelled) return;
        if (res.status === 404) {
          setFetchState({ status: 'notfound' });
          return;
        }
        if (res.status === 410) {
          const body = await res.json().catch(() => ({}));
          setFetchState({ status: 'gone', reason: body?.message || 'This invitation is no longer valid.' });
          return;
        }
        if (!res.ok) {
          setFetchState({ status: 'error', message: `Could not load invite (${res.status}).` });
          return;
        }
        const json = await res.json();
        const preview = json.data ?? json;
        setFetchState({ status: 'ok', preview });
        setFirstName(preview.firstName || '');
        setLastName(preview.lastName || '');
      } catch (err: any) {
        if (cancelled) return;
        setFetchState({ status: 'error', message: err?.message || 'Network error.' });
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitError(null);

    if (password.length < 8) {
      setSubmitError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setSubmitError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/onboarding/invites/${encodeURIComponent(token)}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSubmitError(body?.message || `Could not accept invite (${res.status}).`);
        setSubmitting(false);
        return;
      }
      const json = await res.json();
      const payload = json.data ?? json;
      if (typeof window !== 'undefined') {
        localStorage.setItem('access_token', payload.access_token);
        if (payload.refresh_token) localStorage.setItem('refresh_token', payload.refresh_token);
        if (payload.user) localStorage.setItem('user', JSON.stringify(payload.user));
        if (payload.tenantId) localStorage.setItem('tenantId', payload.tenantId);
      }
      router.replace('/app');
    } catch (err: any) {
      setSubmitError(err?.message || 'Network error.');
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <Card className="w-full max-w-md p-8 space-y-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-indigo-600" />
          <h1 className="text-2xl font-bold tracking-tight">Accept invitation</h1>
        </div>

        {fetchState.status === 'loading' && (
          <div className="space-y-3">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}

        {fetchState.status === 'notfound' && (
          <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Invitation not found</p>
                <p className="mt-1">The link you followed is no longer valid. Ask your admin to resend the invite.</p>
                <Link href="/login" className="mt-3 inline-block text-rose-700 underline">Back to sign in</Link>
              </div>
            </div>
          </div>
        )}

        {fetchState.status === 'gone' && (
          <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">This invitation is no longer valid</p>
                <p className="mt-1">{fetchState.reason}</p>
                <Link href="/login" className="mt-3 inline-block text-amber-800 underline">Back to sign in</Link>
              </div>
            </div>
          </div>
        )}

        {fetchState.status === 'error' && (
          <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            <p>{fetchState.message}</p>
            <button onClick={() => window.location.reload()} className="mt-2 text-rose-700 underline">Try again</button>
          </div>
        )}

        {fetchState.status === 'ok' && (
          <>
            <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-900">
              <p>
                You&apos;ve been invited to join <span className="font-semibold">{fetchState.preview.storeName}</span> as{' '}
                <span className="font-semibold">{fetchState.preview.roles.join(', ') || 'staff'}</span>.
              </p>
              <p className="mt-1 text-xs text-indigo-700">
                Signing in as <span className="font-mono">{fetchState.preview.email}</span>
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="invite-firstname">First name</Label>
                  <Input
                    id="invite-firstname"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invite-lastname">Last name</Label>
                  <Input
                    id="invite-lastname"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="invite-password">Password</Label>
                <Input
                  id="invite-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-describedby="invite-password-help"
                />
                <p id="invite-password-help" className="text-xs text-muted-foreground">
                  Minimum 8 characters.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="invite-confirm">Confirm password</Label>
                <Input
                  id="invite-confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              {submitError && (
                <div role="alert" aria-live="assertive" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {submitError}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={submitting} aria-busy={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Setting up your account…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Accept &amp; sign in
                  </>
                )}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Invitation expires {new Date(fetchState.preview.expiresAt).toLocaleDateString()}
              </p>
            </form>
          </>
        )}
      </Card>
    </div>
  );
}
