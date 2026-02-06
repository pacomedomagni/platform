'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button, Card } from '@platform/ui';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console in development
    console.error('Application error:', error);

    // In production, you would send this to an error tracking service like Sentry
    if (process.env.NODE_ENV === 'production' && typeof window !== 'undefined') {
      // Example: Sentry.captureException(error);
      // For now, we'll just log it
      console.error('Error digest:', error.digest);
    }
  }, [error]);

  const errorId = error.digest || `ERR-${Date.now()}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <Card className="w-full max-w-2xl border-slate-200/70 bg-white p-8 shadow-lg sm:p-12">
        <div className="flex flex-col items-center text-center">
          {/* Error Icon */}
          <div className="mb-6 rounded-full bg-red-100 p-6">
            <AlertTriangle className="h-16 w-16 text-red-600" />
          </div>

          {/* Error Message */}
          <h1 className="mb-2 text-3xl font-bold text-slate-900">Something went wrong</h1>
          <p className="mb-6 text-lg text-slate-600">
            We encountered an unexpected error. Our team has been notified and is working to
            fix the issue.
          </p>

          {/* Error Details (development only) */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mb-6 w-full rounded-lg border border-slate-200 bg-slate-50 p-4 text-left">
              <h2 className="mb-2 text-sm font-semibold text-slate-700">Error Details:</h2>
              <p className="text-xs font-mono text-slate-600 break-all">
                {error.message || 'Unknown error'}
              </p>
              {error.stack && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-700">
                    Stack Trace
                  </summary>
                  <pre className="mt-2 overflow-x-auto text-xs text-slate-600">
                    {error.stack}
                  </pre>
                </details>
              )}
            </div>
          )}

          {/* Error ID */}
          <div className="mb-8 rounded-lg bg-slate-100 px-4 py-2">
            <p className="text-sm text-slate-600">
              Error ID:{' '}
              <code className="font-mono text-xs text-slate-800">{errorId}</code>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Please reference this ID when contacting support
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              onClick={() => reset()}
              className="bg-gradient-to-r from-indigo-600 via-blue-600 to-amber-400 text-white shadow-md hover:shadow-lg"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            <Link href="/">
              <Button variant="outline" className="w-full sm:w-auto">
                <Home className="mr-2 h-4 w-4" />
                Go Home
              </Button>
            </Link>
          </div>

          {/* Support Info */}
          <div className="mt-8 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm text-blue-900">
              <strong>Need help?</strong> Contact our support team at{' '}
              <a
                href="mailto:support@noslag.com"
                className="font-semibold underline hover:text-blue-700"
              >
                support@noslag.com
              </a>
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
