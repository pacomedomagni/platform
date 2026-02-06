/**
 * Customer Login Page
 */
'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, Input, Button, Spinner } from '@platform/ui';
import { loginSchema, type LoginInput } from '@platform/validation';
import { useAuthStore } from '../../../../lib/auth-store';
import { FormField } from '@/components/forms';
import { AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/storefront/account';
  const { login, isLoading, error, clearError } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
  });

  useEffect(() => {
    clearError();
  }, [clearError]);

  const onSubmit = async (data: LoginInput) => {
    clearError();

    try {
      await login(data.email, data.password);
      router.push(redirectUrl);
    } catch {
      // Error is handled by the store
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-6 py-20">
      <header className="text-center mb-8">
        <h1 className="text-3xl font-semibold text-slate-900">Welcome back</h1>
        <p className="text-sm text-slate-500 mt-2">Sign in to your account</p>
      </header>

      <Card
        className="border-slate-200/70 bg-white p-8 shadow-sm"
        role="main"
        aria-labelledby="login-heading"
      >
        <h2 id="login-heading" className="sr-only">
          Login Form
        </h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600"
            >
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <FormField
            label="Email"
            htmlFor="email"
            error={errors.email?.message}
            required
          >
            <Input
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              className="h-11"
              disabled={isLoading}
              {...register('email')}
            />
          </FormField>

          <FormField
            label="Password"
            htmlFor="password"
            error={errors.password?.message}
            required
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">Password</span>
              <Link
                href="/storefront/account/forgot-password"
                className="text-sm text-blue-600 hover:text-blue-500 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                tabIndex={0}
              >
                Forgot password?
              </Link>
            </div>
            <Input
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              className="h-11"
              disabled={isLoading}
              {...register('password')}
            />
          </FormField>

          <Button
            type="submit"
            disabled={isLoading || isSubmitting}
            className="w-full h-11 bg-gradient-to-r from-indigo-600 via-blue-600 to-amber-400 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-busy={isLoading || isSubmitting}
          >
            {isLoading || isSubmitting ? (
              <>
                <Spinner className="h-4 w-4 mr-2" aria-hidden="true" />
                <span>Signing in...</span>
              </>
            ) : (
              'Sign in'
            )}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500">
          Don&apos;t have an account?{' '}
          <Link
            href="/storefront/account/register"
            className="text-blue-600 hover:text-blue-500 font-semibold hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
          >
            Create one
          </Link>
        </div>
      </Card>
    </div>
  );
}
