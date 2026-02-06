/**
 * Customer Registration Page
 */
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, Input, Button, Spinner } from '@platform/ui';
import { registerSchema, type RegisterInput } from '@platform/validation';
import { useAuthStore } from '../../../../lib/auth-store';
import { FormField } from '@/components/forms';
import { AlertCircle } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const { register: registerUser, isLoading, error, clearError } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    mode: 'onBlur',
  });

  useEffect(() => {
    clearError();
  }, [clearError]);

  const onSubmit = async (data: RegisterInput) => {
    clearError();

    try {
      await registerUser({
        email: data.email,
        password: data.password,
        firstName: data.firstName || undefined,
        lastName: data.lastName || undefined,
      });
      router.push('/storefront/account');
    } catch {
      // Error is handled by the store
    }
  };

  const password = watch('password');

  return (
    <div className="mx-auto w-full max-w-md px-6 py-20">
      <header className="text-center mb-8">
        <h1 className="text-3xl font-semibold text-slate-900">Create an account</h1>
        <p className="text-sm text-slate-500 mt-2">Join us and start shopping</p>
      </header>

      <Card
        className="border-slate-200/70 bg-white p-8 shadow-sm"
        role="main"
        aria-labelledby="register-heading"
      >
        <h2 id="register-heading" className="sr-only">
          Registration Form
        </h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
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

          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="First name"
              htmlFor="firstName"
              error={errors.firstName?.message}
            >
              <Input
                placeholder="John"
                autoComplete="given-name"
                className="h-11"
                disabled={isLoading}
                {...register('firstName')}
              />
            </FormField>

            <FormField
              label="Last name"
              htmlFor="lastName"
              error={errors.lastName?.message}
            >
              <Input
                placeholder="Doe"
                autoComplete="family-name"
                className="h-11"
                disabled={isLoading}
                {...register('lastName')}
              />
            </FormField>
          </div>

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
            hint="At least 8 characters with uppercase, lowercase, number, and special character"
          >
            <Input
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              className="h-11"
              disabled={isLoading}
              {...register('password')}
            />
          </FormField>

          <FormField
            label="Confirm password"
            htmlFor="confirmPassword"
            error={errors.confirmPassword?.message}
            required
          >
            <Input
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              className="h-11"
              disabled={isLoading}
              {...register('confirmPassword')}
            />
          </FormField>

          {password && (
            <div
              className="rounded-lg bg-blue-50 p-3 text-xs"
              role="status"
              aria-live="polite"
            >
              <p className="font-medium text-blue-900 mb-1">Password strength:</p>
              <ul className="space-y-1 text-blue-700">
                <li className={password.length >= 8 ? 'text-green-700' : ''}>
                  {password.length >= 8 ? '✓' : '○'} At least 8 characters
                </li>
                <li className={/[A-Z]/.test(password) ? 'text-green-700' : ''}>
                  {/[A-Z]/.test(password) ? '✓' : '○'} One uppercase letter
                </li>
                <li className={/[a-z]/.test(password) ? 'text-green-700' : ''}>
                  {/[a-z]/.test(password) ? '✓' : '○'} One lowercase letter
                </li>
                <li className={/[0-9]/.test(password) ? 'text-green-700' : ''}>
                  {/[0-9]/.test(password) ? '✓' : '○'} One number
                </li>
                <li className={/[^A-Za-z0-9]/.test(password) ? 'text-green-700' : ''}>
                  {/[^A-Za-z0-9]/.test(password) ? '✓' : '○'} One special character
                </li>
              </ul>
            </div>
          )}

          <Button
            type="submit"
            disabled={isLoading || isSubmitting}
            className="w-full h-11 bg-gradient-to-r from-indigo-600 via-blue-600 to-amber-400 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-busy={isLoading || isSubmitting}
          >
            {isLoading || isSubmitting ? (
              <>
                <Spinner className="h-4 w-4 mr-2" aria-hidden="true" />
                <span>Creating account...</span>
              </>
            ) : (
              'Create account'
            )}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link
            href="/storefront/account/login"
            className="text-blue-600 hover:text-blue-500 font-semibold hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
          >
            Sign in
          </Link>
        </div>
      </Card>
    </div>
  );
}
