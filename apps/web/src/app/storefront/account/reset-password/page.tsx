'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button, Card, Input, Label, Spinner } from '@platform/ui';
import { Lock, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { authApi } from '@/lib/store-api';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing reset token. Please request a new password reset link.');
    }
  }, [token]);

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      setError('Invalid reset token');
      return;
    }

    // Validate password
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    // Check passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await authApi.resetPassword(token, password);
      setIsSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error 
          ? err.message 
          : 'Failed to reset password. The link may have expired. Please request a new reset link.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="mx-auto w-full max-w-md py-16 px-6">
        <Card className="p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-2">Password reset successful!</h1>
          <p className="text-slate-500 mb-6">
            Your password has been changed. You can now sign in with your new password.
          </p>
          <Button
            onClick={() => router.push('/storefront/account/login')}
            className="w-full h-11 bg-gradient-to-r from-indigo-600 via-blue-600 to-amber-400 text-white shadow-md hover:shadow-lg"
          >
            Sign in
          </Button>
        </Card>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="mx-auto w-full max-w-md py-16 px-6">
        <Card className="p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-2">Invalid reset link</h1>
          <p className="text-slate-500 mb-6">
            This password reset link is invalid or has expired. Please request a new one.
          </p>
          <Button
            onClick={() => router.push('/storefront/account/forgot-password')}
            className="w-full h-11 bg-gradient-to-r from-indigo-600 via-blue-600 to-amber-400 text-white shadow-md hover:shadow-lg"
          >
            Request new link
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md py-16 px-6">
      <Card className="p-8">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6">
            <Lock className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-2">Create new password</h1>
          <p className="text-slate-500">
            Enter your new password below. Make sure it&apos;s secure and unique.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 pr-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Must be at least 8 characters with uppercase, lowercase, and a number
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-11"
              autoComplete="new-password"
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
                Resetting password...
              </>
            ) : (
              'Reset password'
            )}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <Link
            href="/storefront/account/login"
            className="text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            Remember your password? Sign in
          </Link>
        </div>
      </Card>
    </div>
  );
}
