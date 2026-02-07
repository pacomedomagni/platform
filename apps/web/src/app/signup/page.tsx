'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const signupSchema = z.object({
  businessName: z.string().min(2, 'Business name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  subdomain: z
    .string()
    .min(3, 'Subdomain must be at least 3 characters')
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens'),
  paymentProvider: z.enum(['stripe', 'square']),
});

type SignupFormData = z.infer<typeof signupSchema>;

const steps = [
  { id: 'info', name: 'Business Info' },
  { id: 'payment', name: 'Payment Provider' },
  { id: 'review', name: 'Review & Create' },
] as const;

export default function SignupPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      businessName: '',
      email: '',
      password: '',
      subdomain: '',
      paymentProvider: 'stripe',
    },
  });

  const onSubmit = async (data: SignupFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/onboarding/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Signup failed');
      }

      const { tenantId, accessToken } = await response.json();

      if (accessToken) {
        localStorage.setItem('access_token', accessToken);
      }

      router.push(`/onboarding/${tenantId}`);
    } catch (err: any) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  const canProceed = () => {
    if (currentStep === 0) {
      const { businessName, email, password, subdomain } = form.getValues();
      return businessName.length >= 2 && email.includes('@') && password.length >= 8 && subdomain.length >= 3;
    }
    return true;
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4 py-12">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-8 text-white">
          <h1 className="text-3xl font-bold">Create Your Online Store</h1>
          <p className="mt-2 text-blue-100">Get started selling in just a few minutes</p>
        </div>

        {/* Step Indicator */}
        <div className="border-b bg-slate-50 px-8 py-5">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex flex-1 items-center">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all ${
                      index < currentStep
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : index === currentStep
                          ? 'border-blue-600 bg-white text-blue-600'
                          : 'border-slate-300 bg-white text-slate-400'
                    }`}
                  >
                    {index < currentStep ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span className={`mt-1.5 text-xs font-medium ${index <= currentStep ? 'text-slate-800' : 'text-slate-400'}`}>
                    {step.name}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`mx-3 h-0.5 flex-1 ${index < currentStep ? 'bg-blue-600' : 'bg-slate-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={form.handleSubmit(onSubmit)} className="p-8">
          {/* Step 1: Business Info */}
          {currentStep === 0 && (
            <div className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Business Name</label>
                <input
                  type="text"
                  {...form.register('businessName')}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Acme Inc."
                />
                {form.formState.errors.businessName && (
                  <p className="mt-1 text-xs text-red-600">{form.formState.errors.businessName.message}</p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  {...form.register('email')}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="you@example.com"
                />
                {form.formState.errors.email && (
                  <p className="mt-1 text-xs text-red-600">{form.formState.errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
                <input
                  type="password"
                  {...form.register('password')}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="8+ characters"
                />
                {form.formState.errors.password && (
                  <p className="mt-1 text-xs text-red-600">{form.formState.errors.password.message}</p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Store Subdomain</label>
                <div className="flex">
                  <input
                    type="text"
                    {...form.register('subdomain')}
                    className="flex-1 rounded-l-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="my-store"
                  />
                  <span className="flex items-center rounded-r-lg border border-l-0 border-slate-300 bg-slate-50 px-4 text-sm text-slate-500">
                    .noslag.com
                  </span>
                </div>
                {form.formState.errors.subdomain && (
                  <p className="mt-1 text-xs text-red-600">{form.formState.errors.subdomain.message}</p>
                )}
              </div>

              <button
                type="button"
                onClick={() => canProceed() && setCurrentStep(1)}
                disabled={!canProceed()}
                className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          )}

          {/* Step 2: Payment Provider */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-slate-900">Choose Your Payment Provider</h2>
              <p className="text-sm text-slate-500">Select how your customers will pay. You can change this later.</p>

              <div className="grid grid-cols-2 gap-4">
                <label
                  className={`cursor-pointer rounded-xl border-2 p-5 transition ${
                    form.watch('paymentProvider') === 'stripe'
                      ? 'border-blue-600 bg-blue-50/50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input type="radio" {...form.register('paymentProvider')} value="stripe" className="sr-only" />
                  <div className="text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                    <h3 className="font-bold">Stripe</h3>
                    <p className="mt-1 text-xs text-slate-500">Industry-leading payments</p>
                    <ul className="mt-3 space-y-1 text-left text-xs text-slate-500">
                      <li>Cards, Apple Pay, Google Pay</li>
                      <li>135+ currencies</li>
                      <li>Instant payouts available</li>
                    </ul>
                  </div>
                </label>

                <label
                  className={`cursor-pointer rounded-xl border-2 p-5 transition ${
                    form.watch('paymentProvider') === 'square'
                      ? 'border-blue-600 bg-blue-50/50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input type="radio" {...form.register('paymentProvider')} value="square" className="sr-only" />
                  <div className="text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <h3 className="font-bold">Square</h3>
                    <p className="mt-1 text-xs text-slate-500">All-in-one commerce</p>
                    <ul className="mt-3 space-y-1 text-left text-xs text-slate-500">
                      <li>Cards, digital wallets</li>
                      <li>In-person POS integration</li>
                      <li>Built-in invoicing</li>
                    </ul>
                  </div>
                </label>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep(0)}
                  className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-slate-900">Review Your Store</h2>

              <div className="space-y-3 rounded-lg bg-slate-50 p-5">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Business Name</span>
                  <span className="text-sm font-medium">{form.watch('businessName')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Email</span>
                  <span className="text-sm font-medium">{form.watch('email')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Store URL</span>
                  <span className="text-sm font-medium">{form.watch('subdomain')}.noslag.com</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Payment Provider</span>
                  <span className="text-sm font-medium capitalize">{form.watch('paymentProvider')}</span>
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  disabled={isSubmitting}
                  className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating Store...' : 'Create Store'}
                </button>
              </div>
            </div>
          )}
        </form>

        <div className="border-t px-8 py-4 text-center">
          <p className="text-sm text-slate-500">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-blue-600 hover:text-blue-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
