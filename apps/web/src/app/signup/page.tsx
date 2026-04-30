'use client';

import { Suspense, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { unwrapJson } from '@/lib/admin-fetch';

const PLATFORM_DOMAIN = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || 'noslag.com';

const signupSchema = z.object({
  businessName: z.string().min(2, 'Business name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
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

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialStep = Math.min(2, Math.max(0, Number(searchParams.get('step') ?? '0') || 0));
  const [currentStep, setCurrentStep] = useState<number>(initialStep);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    mode: 'onBlur',
    defaultValues: {
      businessName: '',
      email: '',
      password: '',
      subdomain: '',
      paymentProvider: 'stripe',
    },
  });

  // Persist step in URL so browser back/refresh restores position.
  useEffect(() => {
    const sp = new URLSearchParams(searchParams.toString());
    if (currentStep === 0) sp.delete('step');
    else sp.set('step', String(currentStep));
    const qs = sp.toString();
    router.replace(qs ? `/signup?${qs}` : '/signup', { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  const goTo = (step: number) => {
    if (isSubmitting) return;
    setCurrentStep(step);
  };

  const onSubmit = async (data: SignupFormData) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/onboarding/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const err = unwrapJson(await response.json());
        throw new Error(err.message || 'Signup failed');
      }

      const { tenantId, accessToken } = unwrapJson(await response.json());
      localStorage.setItem('tenantId', tenantId);

      if (accessToken) {
        localStorage.setItem('access_token', accessToken);
        // Replace history so back button doesn't return to the signup form post-submit.
        window.history.replaceState(null, '', `/onboarding/${tenantId}`);
        router.replace(`/onboarding/${tenantId}`);
        return;
      }

      setError('Account created. Please sign in to continue.');
      setIsSubmitting(false);
    } catch (err: any) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  // Subscribe to live form values so the Continue button re-evaluates as
  // the user types. `form.getValues()` is a snapshot read that does NOT
  // trigger a re-render, so with mode:'onBlur' the button stayed disabled
  // until the user clicked out of the last field — even when every field
  // was already valid.
  const watchedValues = form.watch();

  // S1: when the user submits from step 3 (Review) and Zod fails on a
  // step-0 field, react-hook-form aborts the submit silently — the
  // failing field's <p> error only renders inside step 0's JSX, so the
  // user on step 3 sees nothing happen. Jump back to whichever step
  // owns the first failing field and surface a top-level alert.
  const STEP_FIELDS: Record<number, Array<keyof SignupFormData>> = {
    0: ['businessName', 'email', 'password', 'subdomain'],
    1: ['paymentProvider'],
    2: [],
  };
  const onInvalid = (errors: Record<string, unknown>) => {
    const errored = Object.keys(errors) as Array<keyof SignupFormData>;
    if (errored.length === 0) return;
    const firstStep = (Object.entries(STEP_FIELDS).find(([, fields]) =>
      fields.some((f) => errored.includes(f))
    )?.[0] ?? '0') as unknown as string;
    const stepIndex = Number(firstStep);
    setError(
      'Some fields need attention. Please review and fix the highlighted errors.'
    );
    if (Number.isFinite(stepIndex) && stepIndex !== currentStep) {
      setCurrentStep(stepIndex);
    }
  };

  const canProceed = () => {
    if (currentStep === 0) {
      const { businessName, email, password, subdomain } = watchedValues;
      return (
        businessName.length >= 2 &&
        email.includes('@') &&
        password.length >= 8 &&
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password) &&
        subdomain.length >= 3
      );
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
          <div className="mt-4 flex items-center gap-4 text-sm text-blue-100">
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              14-day free trial
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              No credit card required
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Cancel anytime
            </span>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="border-b bg-slate-50 px-8 py-5" aria-label="Signup progress">
          <ol className="flex items-center justify-between">
            {steps.map((step, index) => (
              <li key={step.id} className="flex flex-1 items-center" aria-current={index === currentStep ? 'step' : undefined}>
                <div className="flex flex-1 flex-col items-center">
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
              </li>
            ))}
          </ol>
        </div>

        {/* Form */}
        <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="p-8" noValidate>
          {/* Step 1: Business Info */}
          {currentStep === 0 && (
            <div className="space-y-5">
              <div>
                <label htmlFor="signup-business" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Business Name
                </label>
                <input
                  id="signup-business"
                  type="text"
                  autoComplete="organization"
                  required
                  aria-invalid={!!form.formState.errors.businessName}
                  aria-describedby={form.formState.errors.businessName ? 'signup-business-err' : undefined}
                  {...form.register('businessName')}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Acme Inc."
                />
                <p id="signup-business-err" aria-live="polite" className="mt-1 min-h-[1rem] text-xs text-red-600">
                  {form.formState.errors.businessName?.message ?? ''}
                </p>
              </div>

              <div>
                <label htmlFor="signup-email" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Email
                </label>
                <input
                  id="signup-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  aria-invalid={!!form.formState.errors.email}
                  aria-describedby={form.formState.errors.email ? 'signup-email-err' : undefined}
                  {...form.register('email')}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="you@example.com"
                />
                <p id="signup-email-err" aria-live="polite" className="mt-1 min-h-[1rem] text-xs text-red-600">
                  {form.formState.errors.email?.message ?? ''}
                </p>
              </div>

              <div>
                <label htmlFor="signup-password" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="signup-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    aria-invalid={!!form.formState.errors.password}
                    aria-describedby="signup-password-help signup-password-err"
                    {...form.register('password')}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="8+ chars, uppercase, lowercase, number"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {/* Password requirements checklist */}
                {(() => {
                  const pwd = form.watch('password') || '';
                  const requirements = [
                    { label: '8+ characters', met: pwd.length >= 8 },
                    { label: 'Lowercase letter', met: /[a-z]/.test(pwd) },
                    { label: 'Uppercase letter', met: /[A-Z]/.test(pwd) },
                    { label: 'Number', met: /\d/.test(pwd) },
                  ];
                  const allMet = requirements.every((r) => r.met);

                  return (
                    <div id="signup-password-help" className="mt-2 space-y-1">
                      <div className="grid grid-cols-2 gap-1">
                        {requirements.map((req) => (
                          <div
                            key={req.label}
                            className={`flex items-center gap-1.5 text-xs ${req.met ? 'text-green-600' : 'text-slate-400'}`}
                          >
                            {req.met ? (
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <circle cx="12" cy="12" r="9" />
                              </svg>
                            )}
                            {req.label}
                          </div>
                        ))}
                      </div>
                      {pwd.length > 0 && (
                        <div className="pt-1">
                          <div className="flex gap-1">
                            {[1, 2, 3, 4].map((i) => {
                              const score = requirements.filter((r) => r.met).length;
                              const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500'];
                              return (
                                <div
                                  key={i}
                                  className={`h-1 flex-1 rounded-full ${i <= score ? colors[score - 1] || 'bg-slate-200' : 'bg-slate-200'}`}
                                />
                              );
                            })}
                          </div>
                          <p className={`mt-1 text-xs ${allMet ? 'text-green-600' : 'text-slate-500'}`}>
                            {allMet ? '✓ Password meets all requirements' : 'Complete all requirements above'}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}
                <p id="signup-password-err" aria-live="polite" className="mt-1 min-h-[1rem] text-xs text-red-600">
                  {form.formState.errors.password?.message ?? ''}
                </p>
              </div>

              <div>
                <label htmlFor="signup-subdomain" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Store Subdomain
                </label>
                <p className="mb-1.5 text-xs text-slate-500">This will be your store&apos;s web address</p>
                <div className="flex">
                  <input
                    id="signup-subdomain"
                    type="text"
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    required
                    aria-invalid={!!form.formState.errors.subdomain}
                    aria-describedby={form.formState.errors.subdomain ? 'signup-subdomain-err' : undefined}
                    {...form.register('subdomain')}
                    className="flex-1 rounded-l-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="my-store"
                  />
                  <span className="flex items-center rounded-r-lg border border-l-0 border-slate-300 bg-slate-50 px-4 text-sm text-slate-500">
                    .{PLATFORM_DOMAIN}
                  </span>
                </div>
                <p id="signup-subdomain-err" aria-live="polite" className="mt-1 min-h-[1rem] text-xs text-red-600">
                  {form.formState.errors.subdomain?.message ?? ''}
                </p>
              </div>

              <button
                type="button"
                onClick={() => canProceed() && goTo(1)}
                disabled={!canProceed() || isSubmitting}
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

              <div className="grid grid-cols-2 gap-4" role="radiogroup" aria-label="Payment provider">
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
                  onClick={() => goTo(0)}
                  disabled={isSubmitting}
                  className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => goTo(2)}
                  disabled={isSubmitting}
                  className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
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
                  <span className="text-sm font-medium">
                    {form.watch('subdomain')}.{PLATFORM_DOMAIN}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Payment Provider</span>
                  <span className="text-sm font-medium capitalize">{form.watch('paymentProvider')}</span>
                </div>
              </div>

              {error && (
                <div role="alert" aria-live="assertive" className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <p className="text-sm text-red-600">{error}</p>
                  {(error.toLowerCase().includes('already registered') || error.toLowerCase().includes('already exists')) && (
                    <p className="mt-2 text-sm text-red-600">
                      Already have an account?{' '}
                      <Link href="/login" className="font-medium underline">
                        Sign in instead
                      </Link>
                      .
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => goTo(1)}
                  disabled={isSubmitting}
                  className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                  className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating Store…' : 'Create Store'}
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

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
