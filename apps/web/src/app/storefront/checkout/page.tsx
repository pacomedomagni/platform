'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Card, Input, NativeSelect, Textarea, Spinner } from '@platform/ui';
import { AlertCircle, Lock, ShoppingBag, Check } from 'lucide-react';
import { checkoutSchema, type CheckoutInput } from '@platform/validation';
import { useCartStore } from '@/lib/cart-store';
import { useAuthStore } from '@/lib/auth-store';
import { checkoutApi, paymentsApi, shippingApi, giftCardApi } from '@/lib/store-api';
import type { ShippingRate, GiftCardBalance } from '@/lib/store-api';
import { formatCurrency } from '../_lib/format';
import { StripePayment } from '../_components/stripe-payment';
import { SquarePayment } from '../_components/square-payment';
import { FormField } from '@/components/forms';
import { CheckoutProgress } from './_components/checkout-progress';
import { TrustBadges } from './_components/trust-badges';
import { PromoCode } from './_components/promo-code';
import { MobileOrderSummary } from './_components/mobile-order-summary';
import { COUNTRIES as countries } from '@/lib/countries';

export default function CheckoutPage() {
  const router = useRouter();
  const { items, itemCount, subtotal, shipping, tax, discount, total, cartId, shippingEstimate, clearCart, initializeCart } = useCartStore();
  const { customer, isAuthenticated } = useAuthStore();

  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [stripePublicKey, setStripePublicKey] = useState<string | null>(null);
  const [paymentProvider, setPaymentProvider] = useState<string>('stripe');
  const [squareApplicationId, setSquareApplicationId] = useState<string | null>(null);
  const [squareLocationId, setSquareLocationId] = useState<string | null>(null);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'info' | 'payment'>('info');

  // Gift card state
  const [giftCardCode, setGiftCardCode] = useState('');
  const [giftCardPin, setGiftCardPin] = useState('');
  const [giftCardApplied, setGiftCardApplied] = useState<GiftCardBalance | null>(null);
  const [giftCardError, setGiftCardError] = useState<string | null>(null);
  const [isCheckingGiftCard, setIsCheckingGiftCard] = useState(false);

  // Shipping method state
  const [shippingRates, setShippingRates] = useState<ShippingRate[]>([]);
  const [selectedShippingRateId, setSelectedShippingRateId] = useState<string | null>(null);
  const [isLoadingShippingRates, setIsLoadingShippingRates] = useState(false);
  const [shippingRatesError, setShippingRatesError] = useState<string | null>(null);
  // SF-CK8: error shown inline if the user submits without choosing a method.
  const [shippingMethodError, setShippingMethodError] = useState<string | null>(null);

  // SF-CK11/CK12: surface payment-config errors instead of leaving the user
  // staring at a forever-loading Stripe/Square form. Two failure modes:
  //   - getConfig() throws (network / 500 / tenant misconfigured)
  //   - getConfig() succeeds but isConfigured=false or required IDs missing
  const [paymentConfigError, setPaymentConfigError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<CheckoutInput>({
    resolver: zodResolver(checkoutSchema),
    mode: 'onBlur',
    defaultValues: {
      email: '',
      phone: '',
      firstName: '',
      lastName: '',
      company: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'US',
      customerNotes: '',
    },
  });

  const formValues = watch();

  // Initialize cart and load payment config
  useEffect(() => {
    let cancelled = false;
    initializeCart();

    // Load payment config (Stripe or Square depending on tenant)
    paymentsApi.getConfig().then(config => {
      if (cancelled) return;
      const provider = config.paymentProvider || 'stripe';
      setPaymentProvider(provider);
      // SF-CK11/CK12: validate the config so we don't render a stuck
      // payment form when the tenant hasn't finished payments setup.
      if (provider === 'square') {
        if (!config.squareApplicationId || !config.squareLocationId) {
          setPaymentConfigError(
            'Payments are not fully configured for this store yet. Please contact the store owner.',
          );
          return;
        }
        setSquareApplicationId(config.squareApplicationId);
        setSquareLocationId(config.squareLocationId);
        setPaymentConfigError(null);
      } else {
        if (!config.publicKey) {
          setPaymentConfigError(
            'Payments are not fully configured for this store yet. Please contact the store owner.',
          );
          return;
        }
        setStripePublicKey(config.publicKey);
        setPaymentConfigError(null);
      }
    }).catch(err => {
      if (cancelled) return;
      console.error('Failed to load payment config:', err);
      setPaymentConfigError(
        err instanceof Error
          ? `Could not load payment options: ${err.message}`
          : 'Could not load payment options. Please refresh and try again.',
      );
    });

    return () => { cancelled = true; };
  }, [initializeCart]);

  // Pre-fill form if customer is logged in. Runs ONCE per checkout session.
  // The previous shape ran on every `customer` reference change; if
  // `useAuthStore` re-resolved the customer mid-typing (e.g. a refresh-on-401
  // retriggered loadProfile), every setValue() would clobber what the user
  // had just typed. The ref-guard below ensures we only seed once and
  // user edits afterwards always win.
  const didSeedFromCustomerRef = useRef(false);
  useEffect(() => {
    if (didSeedFromCustomerRef.current) return;
    if (!customer) return;
    didSeedFromCustomerRef.current = true;

    if (customer.email) setValue('email', customer.email);
    if (customer.firstName) setValue('firstName', customer.firstName);
    if (customer.lastName) setValue('lastName', customer.lastName);
    if (customer.phone) setValue('phone', customer.phone);

    // If customer has a default address, use it
    if (customer.addresses?.length) {
      const defaultAddr = customer.addresses.find(a => a.isDefault) || customer.addresses[0];
      if (defaultAddr.company) setValue('company', defaultAddr.company);
      if (defaultAddr.addressLine1) setValue('addressLine1', defaultAddr.addressLine1);
      if (defaultAddr.addressLine2) setValue('addressLine2', defaultAddr.addressLine2);
      if (defaultAddr.city) setValue('city', defaultAddr.city);
      if (defaultAddr.state) setValue('state', defaultAddr.state);
      if (defaultAddr.postalCode) setValue('postalCode', defaultAddr.postalCode);
      if (defaultAddr.country) setValue('country', defaultAddr.country);
    }
  }, [customer, setValue]);

  // Pre-fill shipping destination from the cart-page estimate so users don't
  // re-enter country/state/postal if they already calculated shipping. The
  // logged-in customer's saved address takes precedence (more specific —
  // includes street/city), so we skip seeding when a customer address has
  // populated the form. Runs once on mount; user edits afterwards always win.
  // The previously-chosen rate id is remembered so fetchShippingRates can
  // restore the selection once rates load.
  const preselectedRateIdRef = useRef<string | null>(shippingEstimate?.rateId ?? null);
  const didSeedFromEstimateRef = useRef(false);
  useEffect(() => {
    if (didSeedFromEstimateRef.current) return;
    if (!shippingEstimate) return;
    // Customer's saved address wins. Detect "customer pre-fill ran" by checking
    // for a populated address line — that field has no default so it's a clean
    // signal.
    if (customer?.addresses?.length) return;
    didSeedFromEstimateRef.current = true;
    if (shippingEstimate.country) setValue('country', shippingEstimate.country);
    if (shippingEstimate.state) setValue('state', shippingEstimate.state);
    if (shippingEstimate.postalCode) setValue('postalCode', shippingEstimate.postalCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shippingEstimate, customer]);

  // SF-CK5: fetch shipping rates with a signal so the cleanup effect can
  // abort an in-flight request when the user keeps editing address fields.
  // Without this, fast typing produced a flurry of overlapping requests and
  // the last response to land — not the latest the user typed — won.
  const fetchShippingRates = async (
    country: string,
    state: string | undefined,
    postalCode: string | undefined,
    signal: AbortSignal,
  ) => {
    if (!country) return;
    setIsLoadingShippingRates(true);
    setShippingRatesError(null);
    try {
      const result = await shippingApi.getRates(
        {
          country,
          state,
          zipCode: postalCode,
          cartTotal: subtotal,
        },
        { signal },
      );
      if (signal.aborted) return;
      setShippingRates(result.rates || []);
      // Functional updater so back-to-back fetches don't race against a stale
      // closure (country + state setValue in the same tick each trigger a
      // fetch). The cart-page rate wins on first auto-select; later refreshes
      // see a non-null current value and bail out.
      if (result.rates?.length > 0) {
        setSelectedShippingRateId((current) => {
          if (current) return current;
          const preferred = preselectedRateIdRef.current
            ? result.rates.find((r) => r.id === preselectedRateIdRef.current)
            : null;
          preselectedRateIdRef.current = null;
          return preferred?.id ?? result.rates[0].id;
        });
      }
    } catch (err) {
      if (signal.aborted || (err as { name?: string })?.name === 'AbortError') return;
      setShippingRates([]);
      setShippingRatesError('Could not load shipping rates. Default shipping will be applied.');
    } finally {
      if (!signal.aborted) setIsLoadingShippingRates(false);
    }
  };

  const watchedCountry = watch('country');
  const watchedState = watch('state');
  const watchedPostalCode = watch('postalCode');

  useEffect(() => {
    if (!watchedCountry || items.length === 0) return;
    const controller = new AbortController();
    fetchShippingRates(watchedCountry, watchedState, watchedPostalCode, controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedCountry, watchedState, watchedPostalCode, subtotal]);

  // Gift card handlers
  const handleApplyGiftCard = async () => {
    if (!giftCardCode.trim()) return;
    setIsCheckingGiftCard(true);
    setGiftCardError(null);
    try {
      const balance = await giftCardApi.checkBalance(giftCardCode.trim(), giftCardPin || undefined);
      if (balance.balance <= 0) {
        setGiftCardError('This gift card has no remaining balance.');
        return;
      }
      setGiftCardApplied(balance);
    } catch (err) {
      setGiftCardError(err instanceof Error ? err.message : 'Invalid gift card.');
      setGiftCardApplied(null);
    } finally {
      setIsCheckingGiftCard(false);
    }
  };

  const handleRemoveGiftCard = () => {
    setGiftCardApplied(null);
    setGiftCardCode('');
    setGiftCardPin('');
    setGiftCardError(null);
  };

  const onSubmit = async (data: CheckoutInput) => {
    if (!cartId) {
      setError('No cart found. Please add items to your cart.');
      return;
    }
    // Phase 2 W2.8: belt-and-suspenders against double-submit. The button
    // is already disabled while isCreatingOrder is true, but mobile tap
    // events can fire before React's render commit. Reject any concurrent
    // call here before we hit the network.
    if (isCreatingOrder) {
      return;
    }

    // SF-CK8: if rates loaded but the user hasn't picked one (rare — we
    // auto-select — but possible if they actively cleared the radio), block
    // submit with an inline error rather than silently using the cart's
    // default shipping.
    if (shippingRates.length > 0 && !selectedShippingRateId) {
      setShippingMethodError('Please select a shipping method to continue.');
      return;
    }
    setShippingMethodError(null);

    setIsCreatingOrder(true);
    setError(null);

    try {
      const checkout = await checkoutApi.create({
        cartId,
        email: data.email,
        phone: data.phone || undefined,
        shippingAddress: {
          firstName: data.firstName,
          lastName: data.lastName,
          company: data.company || undefined,
          addressLine1: data.addressLine1,
          addressLine2: data.addressLine2 || undefined,
          city: data.city,
          state: data.state,
          postalCode: data.postalCode,
          country: data.country,
        },
        customerNotes: data.customerNotes || undefined,
        ...(giftCardApplied && {
          giftCardCode: giftCardCode.trim(),
          giftCardPin: giftCardPin || undefined,
        }),
        ...(selectedShippingRateId && {
          shippingRateId: selectedShippingRateId,
        }),
      });

      setOrderId(checkout.id);
      setOrderNumber(checkout.orderNumber);

      // Determine provider from checkout response (backend is authoritative)
      const provider = checkout.paymentProvider || paymentProvider;
      setPaymentProvider(provider);

      if (provider === 'square') {
        // Square: no clientSecret needed -- card tokenization happens on frontend
        setStep('payment');
      } else if (checkout.clientSecret) {
        setStripeClientSecret(checkout.clientSecret);
        setStep('payment');
      } else {
        // No payment needed (free order?) - redirect to confirmation
        await clearCart();
        router.push(`/storefront/order-confirmation?order=${checkout.orderNumber}`);
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create order. Please try again.');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  // SF-CK1: derive an effective shipping cost from the user's chosen rate.
  // The cart-store `shipping` lags the picker until the backend reconciles
  // on order create, so the summary used to show "Calculated" while the
  // user clicked Continue with no idea what they were about to pay. Prefer
  // the chosen rate's price; fall back to the cart-store value.
  const selectedShippingRate = shippingRates.find((r) => r.id === selectedShippingRateId) ?? null;
  const effectiveShipping =
    selectedShippingRate
      ? Number(selectedShippingRate.price ?? 0)
      : shipping;
  const effectiveTotal = subtotal + effectiveShipping + tax - discount;

  const handlePaymentSuccess = async () => {
    await clearCart();
    router.push(`/storefront/order-confirmation?order=${orderNumber}`);
  };

  const handlePaymentError = (message: string) => {
    setError(message);
  };

  // Empty cart check
  if (items.length === 0 && step === 'info') {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-10 px-6 py-12">
        <Card
          className="flex flex-col items-center justify-center p-16 text-center"
          role="status"
        >
          <ShoppingBag className="h-16 w-16 text-muted mb-6" aria-hidden="true" />
          <h2 className="text-2xl font-semibold text-foreground mb-2">Your cart is empty</h2>
          <p className="text-muted-foreground mb-6">Add some items to your cart before checking out.</p>
          <Link
            href="/storefront/products"
            className="inline-flex items-center justify-center rounded-md bg-gradient-to-r from-primary via-secondary to-accent px-6 py-3 text-primary-foreground shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            Browse Products
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 px-6 py-8">
      {/* Progress Indicator */}
      <div className="mx-auto max-w-3xl">
        <CheckoutProgress currentStep={step} />
      </div>

      {/* Mobile Order Summary */}
      <MobileOrderSummary itemCount={itemCount} total={total} items={items} />

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Checkout</h1>
          <p className="text-sm text-muted-foreground">
            {step === 'info' ? 'Confirm delivery details.' : 'Complete payment to place your order.'}
          </p>
        </div>
        {step === 'info' ? (
          <Link
            href="/storefront/cart"
            className="text-sm font-semibold text-primary hover:opacity-80 hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
          >
            Back to cart
          </Link>
        ) : (
          <button
            onClick={() => setStep('info')}
            className="text-sm font-semibold text-primary hover:opacity-80 hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
            aria-label="Edit shipping information"
          >
            Edit shipping info
          </button>
        )}
      </header>

      {error && (
        <Card
          className="flex items-center gap-3 border-red-200 bg-red-50 p-4"
          role="alert"
          aria-live="assertive"
        >
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" aria-hidden="true" />
          <p className="text-sm text-red-700">{error}</p>
        </Card>
      )}

      {paymentConfigError && step === 'info' && (
        <Card
          className="flex items-center gap-3 border-amber-200 bg-amber-50 p-4"
          role="status"
          aria-live="polite"
        >
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" aria-hidden="true" />
          <p className="text-sm text-amber-800">{paymentConfigError}</p>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        {step === 'info' ? (
          <main>
            <Card
              className="space-y-8 border-border bg-card p-6 shadow-sm"
              role="main"
              aria-labelledby="checkout-form-heading"
            >
              <h2 id="checkout-form-heading" className="sr-only">
                Checkout Information Form
              </h2>

              <form onSubmit={handleSubmit(onSubmit)} noValidate>
                <section className="space-y-4 mb-8" aria-labelledby="contact-heading">
                  <h3 id="contact-heading" className="text-lg font-semibold text-foreground">
                    Contact
                  </h3>
                  {!isAuthenticated && (
                    <p className="text-sm text-muted-foreground">
                      Already have an account?{' '}
                      <Link
                        href="/storefront/account/login?redirect=/storefront/checkout"
                        className="text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
                      >
                        Sign in
                      </Link>
                    </p>
                  )}
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      label="First name"
                      htmlFor="firstName"
                      error={errors.firstName?.message}
                      required
                    >
                      <Input
                        className="h-10"
                        placeholder="Amina"
                        autoComplete="given-name"
                        {...register('firstName')}
                      />
                    </FormField>
                    <FormField
                      label="Last name"
                      htmlFor="lastName"
                      error={errors.lastName?.message}
                      required
                    >
                      <Input
                        className="h-10"
                        placeholder="Rahman"
                        autoComplete="family-name"
                        {...register('lastName')}
                      />
                    </FormField>
                    <FormField
                      label="Email"
                      htmlFor="email"
                      error={errors.email?.message}
                      required
                      className="md:col-span-2"
                    >
                      <Input
                        className="h-10"
                        type="email"
                        placeholder="amina@company.com"
                        autoComplete="email"
                        {...register('email')}
                      />
                    </FormField>
                    <FormField
                      label="Phone"
                      htmlFor="phone"
                      error={errors.phone?.message}
                      className="md:col-span-2"
                    >
                      <Input
                        className="h-10"
                        type="tel"
                        placeholder="+1 234 567 8900"
                        autoComplete="tel"
                        {...register('phone')}
                      />
                    </FormField>
                  </div>
                </section>

                <section className="space-y-4" aria-labelledby="shipping-heading">
                  <h3 id="shipping-heading" className="text-lg font-semibold text-foreground">
                    Shipping Address
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      label="Company"
                      htmlFor="company"
                      error={errors.company?.message}
                      className="md:col-span-2"
                    >
                      <Input
                        className="h-10"
                        placeholder="NoSlag Logistics"
                        autoComplete="organization"
                        {...register('company')}
                      />
                    </FormField>
                    <FormField
                      label="Address Line 1"
                      htmlFor="addressLine1"
                      error={errors.addressLine1?.message}
                      required
                      className="md:col-span-2"
                    >
                      <Input
                        className="h-10"
                        placeholder="Street address"
                        autoComplete="address-line1"
                        {...register('addressLine1')}
                      />
                    </FormField>
                    <FormField
                      label="Address Line 2"
                      htmlFor="addressLine2"
                      error={errors.addressLine2?.message}
                      className="md:col-span-2"
                    >
                      <Input
                        className="h-10"
                        placeholder="Apt, suite, unit, etc."
                        autoComplete="address-line2"
                        {...register('addressLine2')}
                      />
                    </FormField>
                    <FormField
                      label="City"
                      htmlFor="city"
                      error={errors.city?.message}
                      required
                    >
                      <Input
                        className="h-10"
                        placeholder="Dubai"
                        autoComplete="address-level2"
                        {...register('city')}
                      />
                    </FormField>
                    <FormField
                      label="State / Province"
                      htmlFor="state"
                      error={errors.state?.message}
                    >
                      <Input
                        className="h-10"
                        placeholder="State"
                        autoComplete="address-level1"
                        {...register('state')}
                      />
                    </FormField>
                    <FormField
                      label="Postal code"
                      htmlFor="postalCode"
                      error={errors.postalCode?.message}
                      required
                    >
                      <Input
                        className="h-10"
                        placeholder="00000"
                        autoComplete="postal-code"
                        {...register('postalCode')}
                      />
                    </FormField>
                    <FormField
                      label="Country"
                      htmlFor="country"
                      error={errors.country?.message}
                      required
                    >
                      <NativeSelect
                        className="h-10"
                        {...register('country')}
                      >
                        {countries.map(c => (
                          <option key={c.code} value={c.code}>{c.name}</option>
                        ))}
                      </NativeSelect>
                    </FormField>
                    <FormField
                      label="Delivery notes"
                      htmlFor="customerNotes"
                      error={errors.customerNotes?.message}
                      className="md:col-span-2"
                    >
                      <Textarea
                        placeholder="Preferred delivery window, dock instructions, etc."
                        {...register('customerNotes')}
                      />
                    </FormField>
                  </div>
                </section>

                {/* Shipping Method Selection */}
                <section className="space-y-4 mt-8" aria-labelledby="shipping-method-heading">
                  <h3 id="shipping-method-heading" className="text-lg font-semibold text-foreground">
                    Shipping Method
                  </h3>
                  {isLoadingShippingRates ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Spinner className="h-4 w-4" aria-hidden="true" />
                      Loading shipping rates...
                    </div>
                  ) : shippingRates.length > 0 ? (
                    <div
                      className="space-y-2"
                      role="radiogroup"
                      aria-labelledby="shipping-method-heading"
                      aria-invalid={shippingMethodError ? 'true' : 'false'}
                      aria-describedby={shippingMethodError ? 'shipping-method-error' : undefined}
                    >
                      {shippingRates.map((rate) => (
                        <label
                          key={rate.id}
                          className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors ${
                            selectedShippingRateId === rate.id
                              ? 'border-primary bg-primary/5'
                              : shippingMethodError
                                ? 'border-red-300'
                                : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="shippingRate"
                              value={rate.id}
                              checked={selectedShippingRateId === rate.id}
                              onChange={() => {
                                setSelectedShippingRateId(rate.id);
                                if (shippingMethodError) setShippingMethodError(null);
                              }}
                              className="h-4 w-4 text-primary"
                            />
                            <div>
                              <p className="text-sm font-medium text-foreground">{rate.name}</p>
                              {rate.estimatedDays && (
                                <p className="text-xs text-muted-foreground">{rate.estimatedDays}</p>
                              )}
                            </div>
                          </div>
                          <span className="text-sm font-semibold text-foreground">
                            {rate.isFree ? 'Free' : formatCurrency(rate.price)}
                          </span>
                        </label>
                      ))}
                      {shippingMethodError && (
                        <p
                          id="shipping-method-error"
                          className="text-xs text-red-600"
                          role="alert"
                        >
                          {shippingMethodError}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {shippingRatesError || 'Enter your shipping address to see available rates.'}
                    </p>
                  )}
                </section>

                <Button
                  type="submit"
                  className="w-full mt-8 bg-gradient-to-r from-primary via-secondary to-accent text-primary-foreground shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  disabled={isCreatingOrder || isSubmitting}
                  aria-busy={isCreatingOrder || isSubmitting}
                >
                  {isCreatingOrder || isSubmitting ? (
                    <>
                      <Spinner className="h-4 w-4 mr-2" aria-hidden="true" />
                      Creating order...
                    </>
                  ) : (
                    'Continue to Payment'
                  )}
                </Button>
              </form>
            </Card>
          </main>
        ) : (
          <main>
            <Card
              className="space-y-6 border-border bg-card p-6 shadow-sm"
              role="main"
              aria-labelledby="payment-heading"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-green-600" aria-hidden="true" />
                  <h2 id="payment-heading" className="text-lg font-semibold text-foreground">
                    Secure Payment
                  </h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  {paymentProvider === 'square'
                    ? 'Your payment is secured by Square. We never store your card details.'
                    : 'Your payment is secured by Stripe. We never store your card details.'}
                </p>
              </div>

              <div
                className="rounded-lg bg-muted p-4 text-sm"
                role="region"
                aria-labelledby="shipping-summary-heading"
              >
                <p id="shipping-summary-heading" className="font-medium text-foreground mb-2">
                  Shipping to:
                </p>
                <address className="text-muted-foreground not-italic">
                  {formValues.firstName} {formValues.lastName}<br />
                  {formValues.addressLine1}<br />
                  {formValues.addressLine2 && <>{formValues.addressLine2}<br /></>}
                  {formValues.city}, {formValues.state} {formValues.postalCode}<br />
                  {countries.find(c => c.code === formValues.country)?.name}
                </address>
              </div>

              {paymentConfigError ? (
                <div
                  className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4"
                  role="alert"
                  aria-live="assertive"
                >
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="space-y-2">
                    <p className="text-sm text-red-700">{paymentConfigError}</p>
                    <button
                      type="button"
                      onClick={() => setStep('info')}
                      className="text-sm font-medium text-red-700 underline focus:outline-none focus:ring-2 focus:ring-red-300 rounded"
                    >
                      Return to shipping
                    </button>
                  </div>
                </div>
              ) : paymentProvider === 'square' ? (
                squareApplicationId && squareLocationId && orderId ? (
                  <SquarePayment
                    orderId={orderId}
                    applicationId={squareApplicationId}
                    locationId={squareLocationId}
                    onSuccess={handlePaymentSuccess}
                    onError={handlePaymentError}
                  />
                ) : (
                  <div
                    className="flex items-center justify-center py-10"
                    role="status"
                    aria-live="polite"
                  >
                    <Spinner className="h-8 w-8" aria-hidden="true" />
                    <span className="ml-3 text-muted-foreground">Loading payment form...</span>
                  </div>
                )
              ) : stripePublicKey && stripeClientSecret ? (
                <StripePayment
                  clientSecret={stripeClientSecret}
                  orderId={orderId || undefined}
                  orderNumber={orderNumber || undefined}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                />
              ) : (
                <div
                  className="flex items-center justify-center py-10"
                  role="status"
                  aria-live="polite"
                >
                  <Spinner className="h-8 w-8" aria-hidden="true" />
                  <span className="ml-3 text-muted-foreground">Loading payment form...</span>
                </div>
              )}
            </Card>
          </main>
        )}

        <aside aria-labelledby="order-summary-heading" className="space-y-4">
          {/* Trust Badges */}
          {step === 'info' && <TrustBadges />}

          {/* Order Summary Card */}
          <Card className="h-fit space-y-6 border-border bg-card p-6 shadow-sm lg:sticky lg:top-6">
            <div className="space-y-2">
              <h2 id="order-summary-heading" className="text-lg font-semibold text-foreground">
                Order summary
              </h2>
              <p className="text-sm text-muted-foreground">
                {orderNumber ? `Order #${orderNumber}` : 'Live inventory reserved for 30 minutes.'}
              </p>
            </div>
            <div
              className="space-y-4 max-h-64 overflow-y-auto"
              role="list"
              aria-label="Cart items"
            >
              {items.map((item) => (
                <div key={item.id} className="flex items-start justify-between text-sm" role="listitem">
                  <div>
                    <p className="font-semibold text-foreground">{item.name}</p>
                    {item.variant && <p className="text-xs text-muted-foreground">{item.variant}</p>}
                    <p className="text-xs text-muted-foreground">Qty {item.quantity}</p>
                  </div>
                  <p className="font-semibold text-foreground">{formatCurrency(item.price * item.quantity)}</p>
                </div>
              ))}
            </div>
            {/* Promo Code Section */}
            {step === 'info' && (
              <div className="border-t border-border pt-4">
                <PromoCode />
              </div>
            )}

            {/* Gift Card Section */}
            {step === 'info' && (
              <div className="border-t border-border pt-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Gift Card</h3>
                {giftCardApplied ? (
                  <div className="flex items-center justify-between rounded-lg bg-green-50 border border-green-200 p-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Check className="h-4 w-4 text-green-600" aria-hidden="true" />
                        <span className="text-sm font-medium text-green-700">
                          Gift card applied
                        </span>
                      </div>
                      <p className="text-xs text-green-600 mt-0.5">
                        Balance: {formatCurrency(giftCardApplied.balance)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveGiftCard}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <Input
                        className="h-9 text-sm"
                        placeholder="Gift card code"
                        value={giftCardCode}
                        onChange={(e) => setGiftCardCode(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Input
                        className="h-9 text-sm"
                        placeholder="PIN (if required)"
                        value={giftCardPin}
                        onChange={(e) => setGiftCardPin(e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 shrink-0"
                        onClick={handleApplyGiftCard}
                        disabled={!giftCardCode.trim() || isCheckingGiftCard}
                      >
                        {isCheckingGiftCard ? (
                          <Spinner className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          'Apply'
                        )}
                      </Button>
                    </div>
                    {giftCardError && (
                      <p className="text-xs text-red-600">{giftCardError}</p>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="space-y-3 text-sm text-muted-foreground border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <span>Subtotal</span>
                <span className="font-semibold text-foreground">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>
                  Shipping
                  {selectedShippingRate && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({selectedShippingRate.name})
                    </span>
                  )}
                </span>
                <span className="font-semibold text-foreground">
                  {effectiveShipping > 0
                    ? formatCurrency(effectiveShipping)
                    : selectedShippingRate
                      ? 'Free'
                      : 'Calculated'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Tax</span>
                <span className="font-semibold text-foreground">
                  {tax > 0 ? formatCurrency(tax) : 'Calculated'}
                </span>
              </div>
              {discount > 0 && (
                <div className="flex items-center justify-between text-green-600">
                  <span>Discount</span>
                  <span className="font-semibold">-{formatCurrency(discount)}</span>
                </div>
              )}
              {giftCardApplied && (
                <div className="flex items-center justify-between text-green-600">
                  <span>Gift Card</span>
                  <span className="font-semibold">
                    -{formatCurrency(Math.min(giftCardApplied.balance, effectiveTotal))}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-border pt-3 text-base font-semibold text-foreground">
                <span>Total</span>
                <span>
                  {giftCardApplied
                    ? formatCurrency(
                        Math.max(0, effectiveTotal - Math.min(giftCardApplied.balance, effectiveTotal)),
                      )
                    : formatCurrency(effectiveTotal)}
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              By placing your order, you agree to the NoSlag storefront terms and ERP-managed fulfillment policies.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
