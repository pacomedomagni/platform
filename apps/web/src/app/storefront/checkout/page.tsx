'use client';

import { useEffect, useState } from 'react';
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

const countries = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
];

export default function CheckoutPage() {
  const router = useRouter();
  const { items, itemCount, subtotal, shipping, tax, discount, total, cartId, clearCart, initializeCart } = useCartStore();
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
      setPaymentProvider(config.paymentProvider || 'stripe');
      if (config.paymentProvider === 'square') {
        setSquareApplicationId(config.squareApplicationId);
        setSquareLocationId(config.squareLocationId);
      } else if (config.publicKey) {
        setStripePublicKey(config.publicKey);
      }
    }).catch(err => { if (!cancelled) console.error(err); });

    return () => { cancelled = true; };
  }, [initializeCart]);

  // Pre-fill form if customer is logged in
  useEffect(() => {
    if (customer) {
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
    }
  }, [customer, setValue]);

  // Fetch shipping rates when address country/state/postalCode changes
  const fetchShippingRates = async (country: string, state?: string, postalCode?: string) => {
    if (!country) return;
    setIsLoadingShippingRates(true);
    setShippingRatesError(null);
    try {
      const result = await shippingApi.getRates({
        country,
        state,
        zipCode: postalCode,
        cartTotal: subtotal,
      });
      setShippingRates(result.rates || []);
      // Auto-select the first rate if none selected
      if (result.rates?.length > 0 && !selectedShippingRateId) {
        setSelectedShippingRateId(result.rates[0].id);
      }
    } catch {
      setShippingRates([]);
      setShippingRatesError('Could not load shipping rates. Default shipping will be applied.');
    } finally {
      setIsLoadingShippingRates(false);
    }
  };

  const watchedCountry = watch('country');
  const watchedState = watch('state');
  const watchedPostalCode = watch('postalCode');

  useEffect(() => {
    if (watchedCountry && items.length > 0) {
      const controller = new AbortController();
      fetchShippingRates(watchedCountry, watchedState, watchedPostalCode);
      return () => controller.abort();
    }
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
                    <div className="space-y-2">
                      {shippingRates.map((rate) => (
                        <label
                          key={rate.id}
                          className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors ${
                            selectedShippingRateId === rate.id
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="shippingRate"
                              value={rate.id}
                              checked={selectedShippingRateId === rate.id}
                              onChange={() => setSelectedShippingRateId(rate.id)}
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

              {paymentProvider === 'square' ? (
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
                <span>Shipping</span>
                <span className="font-semibold text-foreground">
                  {shipping > 0 ? formatCurrency(shipping) : 'Calculated'}
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
                    -{formatCurrency(Math.min(giftCardApplied.balance, total))}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-border pt-3 text-base font-semibold text-foreground">
                <span>Total</span>
                <span>
                  {giftCardApplied
                    ? formatCurrency(Math.max(0, total - Math.min(giftCardApplied.balance, total)))
                    : formatCurrency(total)}
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
