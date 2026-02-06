'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button, Card, Input, Label, Spinner } from '@platform/ui';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';

export default function ForgotPasswordPage() {
  const { forgotPassword } = useAuthStore();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await forgotPassword(email);
      setIsSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="mx-auto w-full max-w-md py-16 px-6">
        <Card className="p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-2">Check your email</h1>
          <p className="text-slate-500 mb-6">
            If an account exists for <span className="font-medium text-slate-700">{email}</span>, 
            we&apos;ve sent password reset instructions to that address.
          </p>
          <p className="text-sm text-slate-500 mb-6">
            Didn&apos;t receive the email? Check your spam folder or try again in a few minutes.
          </p>
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setIsSubmitted(false);
                setEmail('');
              }}
            >
              Try a different email
            </Button>
            <Link
              href="/storefront/account/login"
              className="block text-sm font-medium text-blue-600 hover:text-blue-500"
            >
              Back to sign in
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md py-16 px-6">
      <Card className="p-8">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6">
            <Mail className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-2">Forgot your password?</h1>
          <p className="text-slate-500">
            No problem! Enter your email address and we&apos;ll send you a link to reset it.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11"
              autoComplete="email"
              autoFocus
            />
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-11 bg-gradient-to-r from-indigo-600 via-blue-600 to-amber-400 text-white shadow-md hover:shadow-lg"
          >
            {isLoading ? (
              <>
                <Spinner className="h-4 w-4 mr-2" />
                Sending...
              </>
            ) : (
              'Send reset link'
            )}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <Link
            href="/storefront/account/login"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
        </div>
      </Card>
    </div>
  );
}
