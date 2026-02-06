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
import { checkoutApi, paymentsApi } from '@/lib/store-api';
import { formatCurrency } from '../_lib/format';
import { StripePayment } from '../_components/stripe-payment';
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
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'info' | 'payment'>('info');

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

  // Initialize cart and load Stripe config
  useEffect(() => {
    initializeCart();

    // Load Stripe config
    paymentsApi.getConfig().then(config => {
      if (config.publicKey) {
        setStripePublicKey(config.publicKey);
      }
    }).catch(console.error);
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
      });

      setOrderId(checkout.id);
      setOrderNumber(checkout.orderNumber);

      if (checkout.clientSecret) {
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
          <ShoppingBag className="h-16 w-16 text-slate-300 mb-6" aria-hidden="true" />
          <h2 className="text-2xl font-semibold text-slate-900 mb-2">Your cart is empty</h2>
          <p className="text-slate-500 mb-6">Add some items to your cart before checking out.</p>
          <Link
            href="/storefront/products"
            className="inline-flex items-center justify-center rounded-md bg-gradient-to-r from-indigo-600 via-blue-600 to-amber-400 px-6 py-3 text-white shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
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
          <h1 className="text-3xl font-semibold text-slate-900">Checkout</h1>
          <p className="text-sm text-slate-500">
            {step === 'info' ? 'Confirm delivery details.' : 'Complete payment to place your order.'}
          </p>
        </div>
        {step === 'info' ? (
          <Link
            href="/storefront/cart"
            className="text-sm font-semibold text-blue-600 hover:text-blue-500 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
          >
            Back to cart
          </Link>
        ) : (
          <button
            onClick={() => setStep('info')}
            className="text-sm font-semibold text-blue-600 hover:text-blue-500 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
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
              className="space-y-8 border-slate-200/70 bg-white p-6 shadow-sm"
              role="main"
              aria-labelledby="checkout-form-heading"
            >
              <h2 id="checkout-form-heading" className="sr-only">
                Checkout Information Form
              </h2>

              <form onSubmit={handleSubmit(onSubmit)} noValidate>
                <section className="space-y-4 mb-8" aria-labelledby="contact-heading">
                  <h3 id="contact-heading" className="text-lg font-semibold text-slate-900">
                    Contact
                  </h3>
                  {!isAuthenticated && (
                    <p className="text-sm text-slate-500">
                      Already have an account?{' '}
                      <Link
                        href="/storefront/account/login?redirect=/storefront/checkout"
                        className="text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
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
                  <h3 id="shipping-heading" className="text-lg font-semibold text-slate-900">
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

                <Button
                  type="submit"
                  className="w-full mt-8 bg-gradient-to-r from-indigo-600 via-blue-600 to-amber-400 text-white shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
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
              className="space-y-6 border-slate-200/70 bg-white p-6 shadow-sm"
              role="main"
              aria-labelledby="payment-heading"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-green-600" aria-hidden="true" />
                  <h2 id="payment-heading" className="text-lg font-semibold text-slate-900">
                    Secure Payment
                  </h2>
                </div>
                <p className="text-sm text-slate-500">
                  Your payment is secured by Stripe. We never store your card details.
                </p>
              </div>

              <div
                className="rounded-lg bg-slate-50 p-4 text-sm"
                role="region"
                aria-labelledby="shipping-summary-heading"
              >
                <p id="shipping-summary-heading" className="font-medium text-slate-700 mb-2">
                  Shipping to:
                </p>
                <address className="text-slate-600 not-italic">
                  {formValues.firstName} {formValues.lastName}<br />
                  {formValues.addressLine1}<br />
                  {formValues.addressLine2 && <>{formValues.addressLine2}<br /></>}
                  {formValues.city}, {formValues.state} {formValues.postalCode}<br />
                  {countries.find(c => c.code === formValues.country)?.name}
                </address>
              </div>

              {stripePublicKey && stripeClientSecret ? (
                <StripePayment
                  clientSecret={stripeClientSecret}
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
                  <span className="ml-3 text-slate-600">Loading payment form...</span>
                </div>
              )}
            </Card>
          </main>
        )}

        <aside aria-labelledby="order-summary-heading" className="space-y-4">
          {/* Trust Badges */}
          {step === 'info' && <TrustBadges />}

          {/* Order Summary Card */}
          <Card className="h-fit space-y-6 border-slate-200/70 bg-white p-6 shadow-sm lg:sticky lg:top-6">
            <div className="space-y-2">
              <h2 id="order-summary-heading" className="text-lg font-semibold text-slate-900">
                Order summary
              </h2>
              <p className="text-sm text-slate-500">
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
                    <p className="font-semibold text-slate-900">{item.name}</p>
                    {item.variant && <p className="text-xs text-slate-400">{item.variant}</p>}
                    <p className="text-xs text-slate-500">Qty {item.quantity}</p>
                  </div>
                  <p className="font-semibold text-slate-900">{formatCurrency(item.price * item.quantity)}</p>
                </div>
              ))}
            </div>
            {/* Promo Code Section */}
            {step === 'info' && (
              <div className="border-t border-slate-200 pt-4">
                <PromoCode />
              </div>
            )}

            <div className="space-y-3 text-sm text-slate-600 border-t border-slate-200 pt-4">
              <div className="flex items-center justify-between">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-900">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Shipping</span>
                <span className="font-semibold text-slate-900">
                  {shipping > 0 ? formatCurrency(shipping) : 'Calculated'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Tax</span>
                <span className="font-semibold text-slate-900">
                  {tax > 0 ? formatCurrency(tax) : 'Calculated'}
                </span>
              </div>
              {discount > 0 && (
                <div className="flex items-center justify-between text-green-600">
                  <span>Discount</span>
                  <span className="font-semibold">-{formatCurrency(discount)}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-base font-semibold text-slate-900">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              By placing your order, you agree to the NoSlag storefront terms and ERP-managed fulfillment policies.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
