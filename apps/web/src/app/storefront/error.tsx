'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button, Card } from '@platform/ui';
import { ShoppingBag, AlertCircle, RefreshCw, Home } from 'lucide-react';

export default function StorefrontError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Storefront error:', error);
  }, [error]);

  const errorId = error.digest || `STORE-ERR-${Date.now()}`;

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-16">
      <Card className="border-slate-200/70 bg-white p-8 shadow-md sm:p-12">
        <div className="flex flex-col items-center text-center">
          {/* Error Icon */}
          <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-red-100">
            <ShoppingBag className="h-12 w-12 text-red-600" />
          </div>

          {/* Error Message */}
          <h1 className="mb-2 text-3xl font-bold text-slate-900">
            Oops! Something went wrong
          </h1>
          <p className="mb-6 max-w-md text-lg text-slate-600">
            We're having trouble loading this page. Don't worry, your cart and account are
            safe.
          </p>

          {/* Error ID */}
          <div className="mb-8 rounded-lg bg-slate-100 px-4 py-2">
            <p className="text-sm text-slate-600">
              Reference ID: <code className="font-mono text-xs">{errorId}</code>
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
            <Link href="/storefront">
              <Button variant="outline">
                <Home className="mr-2 h-4 w-4" />
                Back to Storefront
              </Button>
            </Link>
          </div>

          {/* Shopping Options */}
          <div className="mt-12 grid w-full gap-4 sm:grid-cols-3">
            <Link href="/storefront/products">
              <Card className="group h-full border-slate-200/70 bg-slate-50 p-4 text-center transition-colors hover:bg-slate-100">
                <h3 className="font-semibold text-slate-900">Browse Products</h3>
                <p className="mt-1 text-sm text-slate-600">Explore our catalog</p>
              </Card>
            </Link>
            <Link href="/storefront/cart">
              <Card className="group h-full border-slate-200/70 bg-slate-50 p-4 text-center transition-colors hover:bg-slate-100">
                <h3 className="font-semibold text-slate-900">View Cart</h3>
                <p className="mt-1 text-sm text-slate-600">Check your items</p>
              </Card>
            </Link>
            <Link href="/storefront/account">
              <Card className="group h-full border-slate-200/70 bg-slate-50 p-4 text-center transition-colors hover:bg-slate-100">
                <h3 className="font-semibold text-slate-900">My Account</h3>
                <p className="mt-1 text-sm text-slate-600">View orders & profile</p>
              </Card>
            </Link>
          </div>

          {/* Support */}
          <div className="mt-8 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-blue-600" />
              <div className="text-left">
                <p className="text-sm font-semibold text-blue-900">Need assistance?</p>
                <p className="mt-1 text-sm text-blue-700">
                  Contact our support team at{' '}
                  <a
                    href="mailto:support@noslag.com"
                    className="font-semibold underline hover:text-blue-800"
                  >
                    support@noslag.com
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
