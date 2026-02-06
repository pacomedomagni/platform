'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button, Card } from '@platform/ui';
import { AlertTriangle, RefreshCw, Home, FileText } from 'lucide-react';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Admin panel error:', error);
  }, [error]);

  const errorId = error.digest || `ADMIN-ERR-${Date.now()}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <Card className="w-full max-w-2xl border-slate-200/70 bg-white p-8 shadow-md sm:p-12">
        <div className="flex flex-col items-center text-center">
          {/* Error Icon */}
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-10 w-10 text-red-600" />
          </div>

          {/* Error Message */}
          <h1 className="mb-2 text-3xl font-bold text-slate-900">
            Admin Panel Error
          </h1>
          <p className="mb-6 max-w-md text-lg text-slate-600">
            An error occurred while loading this admin page. Your data is safe.
          </p>

          {/* Error Details */}
          <div className="mb-6 w-full rounded-lg border border-slate-200 bg-slate-50 p-4 text-left">
            <div className="mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-600" />
              <h2 className="text-sm font-semibold text-slate-700">Error Information</h2>
            </div>
            <p className="mb-2 text-xs text-slate-600">
              <strong>Message:</strong> {error.message || 'Unknown error'}
            </p>
            <p className="text-xs text-slate-600">
              <strong>Reference ID:</strong>{' '}
              <code className="rounded bg-slate-200 px-1 py-0.5 font-mono">
                {errorId}
              </code>
            </p>
            {process.env.NODE_ENV === 'development' && error.stack && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-semibold text-slate-700">
                  Stack Trace (Development Only)
                </summary>
                <pre className="mt-2 max-h-40 overflow-auto rounded bg-slate-900 p-2 text-xs text-slate-100">
                  {error.stack}
                </pre>
              </details>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              onClick={() => reset()}
              className="bg-gradient-to-r from-indigo-600 via-blue-600 to-amber-400 text-white shadow-md hover:shadow-lg"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
            <Link href="/app">
              <Button variant="outline">
                <Home className="mr-2 h-4 w-4" />
                Dashboard
              </Button>
            </Link>
          </div>

          {/* Quick Links */}
          <div className="mt-12 grid w-full gap-3 text-left sm:grid-cols-2">
            <Link href="/app">
              <Card className="border-slate-200/70 bg-slate-50 p-4 transition-colors hover:bg-slate-100">
                <h3 className="text-sm font-semibold text-slate-900">Dashboard</h3>
                <p className="mt-1 text-xs text-slate-600">Return to main dashboard</p>
              </Card>
            </Link>
            <Link href="/app/reports">
              <Card className="border-slate-200/70 bg-slate-50 p-4 transition-colors hover:bg-slate-100">
                <h3 className="text-sm font-semibold text-slate-900">Reports</h3>
                <p className="mt-1 text-xs text-slate-600">View business reports</p>
              </Card>
            </Link>
          </div>

          {/* Support Notice */}
          <div className="mt-8 w-full rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-900">
              <strong>Persistent errors?</strong> Contact technical support with the
              reference ID above. Include details about what you were doing when this error
              occurred.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
