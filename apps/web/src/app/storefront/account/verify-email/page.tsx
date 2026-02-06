'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button, Card, Spinner } from '@platform/ui';
import { Mail, CheckCircle, AlertCircle } from 'lucide-react';
import { authApi } from '@/lib/store-api';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing verification token. Please check your email for the correct link.');
      setIsLoading(false);
      return;
    }

    // Automatically verify on mount
    const verify = async () => {
      try {
        await authApi.verifyEmail(token);
        setIsSuccess(true);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to verify email. The link may have expired. Please request a new verification email.'
        );
      } finally {
        setIsLoading(false);
      }
    };

    verify();
  }, [token]);

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-md py-16 px-6">
        <Card className="p-8 text-center">
          <Spinner className="h-8 w-8 mx-auto text-blue-600 mb-4" />
          <h1 className="text-xl font-semibold text-slate-900 mb-2">Verifying your email...</h1>
          <p className="text-slate-500">
            Please wait while we verify your email address.
          </p>
        </Card>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="mx-auto w-full max-w-md py-16 px-6">
        <Card className="p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-2">Email verified successfully!</h1>
          <p className="text-slate-500 mb-6">
            Your email has been verified. You can now access all features of your account.
          </p>
          <Button
            onClick={() => router.push('/storefront/account')}
            className="w-full h-11 bg-gradient-to-r from-indigo-600 via-blue-600 to-amber-400 text-white shadow-md hover:shadow-lg"
          >
            Go to My Account
          </Button>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-md py-16 px-6">
        <Card className="p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-2">Verification failed</h1>
          <p className="text-slate-500 mb-6">
            {error}
          </p>
          <div className="space-y-3">
            <Button
              onClick={() => router.push('/storefront/account')}
              className="w-full h-11 bg-gradient-to-r from-indigo-600 via-blue-600 to-amber-400 text-white shadow-md hover:shadow-lg"
            >
              Go to My Account
            </Button>
            <Link
              href="/storefront/account/login"
              className="block text-sm font-medium text-slate-500 hover:text-slate-700"
            >
              Back to Sign in
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return null;
}

// Wrapper with Suspense boundary for useSearchParams
export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-md py-16 px-6">
          <Card className="p-8 text-center">
            <Spinner className="h-8 w-8 mx-auto text-blue-600" />
            <p className="mt-4 text-slate-500">Loading...</p>
          </Card>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
