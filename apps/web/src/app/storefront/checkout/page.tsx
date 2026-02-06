'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Card, Input, Label, NativeSelect, Textarea, Spinner } from '@platform/ui';
import { AlertCircle, Lock, ShoppingBag } from 'lucide-react';
import { useCartStore } from '@/lib/cart-store';
import { useAuthStore } from '@/lib/auth-store';
import { checkoutApi, paymentsApi } from '@/lib/store-api';
import { formatCurrency } from '../_lib/format';
import { StripePayment } from '../_components/stripe-payment';

interface CheckoutForm {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  company: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  customerNotes: string;
}

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
  
  const [form, setForm] = useState<CheckoutForm>({
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
  });
  
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [stripePublicKey, setStripePublicKey] = useState<string | null>(null);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'info' | 'payment'>('info');

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
      setForm(prev => ({
        ...prev,
        email: customer.email || prev.email,
        firstName: customer.firstName || prev.firstName,
        lastName: customer.lastName || prev.lastName,
        phone: customer.phone || prev.phone,
      }));

      // If customer has a default address, use it
      if (customer.addresses?.length) {
        const defaultAddr = customer.addresses.find(a => a.isDefault) || customer.addresses[0];
        setForm(prev => ({
          ...prev,
          company: defaultAddr.company || prev.company,
          addressLine1: defaultAddr.addressLine1 || prev.addressLine1,
          addressLine2: defaultAddr.addressLine2 || prev.addressLine2,
          city: defaultAddr.city || prev.city,
          state: defaultAddr.state || prev.state,
          postalCode: defaultAddr.postalCode || prev.postalCode,
          country: defaultAddr.country || prev.country,
        }));
      }
    }
  }, [customer]);

  const handleInputChange = (field: keyof CheckoutForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = (): boolean => {
    if (!form.email || !form.firstName || !form.lastName) {
      setError('Please fill in all required contact fields');
      return false;
    }
    if (!form.addressLine1 || !form.city || !form.postalCode || !form.country) {
      setError('Please fill in all required shipping fields');
      return false;
    }
    return true;
  };

  const handleCreateOrder = async () => {
    if (!validateForm()) return;
    if (!cartId) {
      setError('No cart found. Please add items to your cart.');
      return;
    }

    setIsCreatingOrder(true);
    setError(null);

    try {
      const checkout = await checkoutApi.create({
        cartId,
        email: form.email,
        phone: form.phone || undefined,
        shippingAddress: {
          firstName: form.firstName,
          lastName: form.lastName,
          company: form.company || undefined,
          addressLine1: form.addressLine1,
          addressLine2: form.addressLine2 || undefined,
          city: form.city,
          state: form.state,
          postalCode: form.postalCode,
          country: form.country,
        },
        customerNotes: form.customerNotes || undefined,
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
        <Card className="flex flex-col items-center justify-center p-16 text-center">
          <ShoppingBag className="h-16 w-16 text-slate-300 mb-6" />
          <h2 className="text-2xl font-semibold text-slate-900 mb-2">Your cart is empty</h2>
          <p className="text-slate-500 mb-6">Add some items to your cart before checking out.</p>
          <Link
            href="/storefront/products"
            className="inline-flex items-center justify-center rounded-md bg-gradient-to-r from-indigo-600 via-blue-600 to-amber-400 px-6 py-3 text-white shadow-md hover:shadow-lg"
          >
            Browse Products
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-10 px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Checkout</h1>
          <p className="text-sm text-slate-500">
            {step === 'info' ? 'Confirm delivery details.' : 'Complete payment to place your order.'}
          </p>
        </div>
        {step === 'info' ? (
          <Link href="/storefront/cart" className="text-sm font-semibold text-blue-600 hover:text-blue-500">
            Back to cart
          </Link>
        ) : (
          <button 
            onClick={() => setStep('info')} 
            className="text-sm font-semibold text-blue-600 hover:text-blue-500"
          >
            Edit shipping info
          </button>
        )}
      </div>

      {error && (
        <Card className="flex items-center gap-3 border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        {step === 'info' ? (
          <Card className="space-y-8 border-slate-200/70 bg-white p-6 shadow-sm">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">Contact</h2>
              {!isAuthenticated && (
                <p className="text-sm text-slate-500">
                  Already have an account?{' '}
                  <Link href="/storefront/account/login?redirect=/storefront/checkout" className="text-blue-600 hover:underline">
                    Sign in
                  </Link>
                </p>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>First name *</Label>
                  <Input 
                    className="h-10" 
                    placeholder="Amina" 
                    value={form.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last name *</Label>
                  <Input 
                    className="h-10" 
                    placeholder="Rahman" 
                    value={form.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Email *</Label>
                  <Input 
                    className="h-10" 
                    type="email"
                    placeholder="amina@company.com" 
                    value={form.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Phone</Label>
                  <Input 
                    className="h-10" 
                    type="tel"
                    placeholder="+1 234 567 8900" 
                    value={form.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">Shipping Address</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label>Company</Label>
                  <Input 
                    className="h-10" 
                    placeholder="NoSlag Logistics" 
                    value={form.company}
                    onChange={(e) => handleInputChange('company', e.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Address Line 1 *</Label>
                  <Input 
                    className="h-10" 
                    placeholder="Street address" 
                    value={form.addressLine1}
                    onChange={(e) => handleInputChange('addressLine1', e.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Address Line 2</Label>
                  <Input 
                    className="h-10" 
                    placeholder="Apt, suite, unit, etc." 
                    value={form.addressLine2}
                    onChange={(e) => handleInputChange('addressLine2', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>City *</Label>
                  <Input 
                    className="h-10" 
                    placeholder="Dubai" 
                    value={form.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>State / Province</Label>
                  <Input 
                    className="h-10" 
                    placeholder="State" 
                    value={form.state}
                    onChange={(e) => handleInputChange('state', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Postal code *</Label>
                  <Input 
                    className="h-10" 
                    placeholder="00000" 
                    value={form.postalCode}
                    onChange={(e) => handleInputChange('postalCode', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Country *</Label>
                  <NativeSelect 
                    className="h-10"
                    value={form.country}
                    onChange={(e) => handleInputChange('country', e.target.value)}
                  >
                    {countries.map(c => (
                      <option key={c.code} value={c.code}>{c.name}</option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Delivery notes</Label>
                  <Textarea 
                    placeholder="Preferred delivery window, dock instructions, etc." 
                    value={form.customerNotes}
                    onChange={(e) => handleInputChange('customerNotes', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <Button 
              className="w-full bg-gradient-to-r from-indigo-600 via-blue-600 to-amber-400 text-white shadow-md hover:shadow-lg"
              onClick={handleCreateOrder}
              disabled={isCreatingOrder}
            >
              {isCreatingOrder ? (
                <>
                  <Spinner className="h-4 w-4 mr-2" />
                  Creating order...
                </>
              ) : (
                'Continue to Payment'
              )}
            </Button>
          </Card>
        ) : (
          <Card className="space-y-6 border-slate-200/70 bg-white p-6 shadow-sm">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-green-600" />
                <h2 className="text-lg font-semibold text-slate-900">Secure Payment</h2>
              </div>
              <p className="text-sm text-slate-500">
                Your payment is secured by Stripe. We never store your card details.
              </p>
            </div>

            {/* Shipping summary */}
            <div className="rounded-lg bg-slate-50 p-4 text-sm">
              <p className="font-medium text-slate-700 mb-2">Shipping to:</p>
              <p className="text-slate-600">
                {form.firstName} {form.lastName}<br />
                {form.addressLine1}<br />
                {form.addressLine2 && <>{form.addressLine2}<br /></>}
                {form.city}, {form.state} {form.postalCode}<br />
                {countries.find(c => c.code === form.country)?.name}
              </p>
            </div>

            {stripePublicKey && stripeClientSecret ? (
              <StripePayment
                clientSecret={stripeClientSecret}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
              />
            ) : (
              <div className="flex items-center justify-center py-10">
                <Spinner className="h-8 w-8" />
                <span className="ml-3 text-slate-600">Loading payment form...</span>
              </div>
            )}
          </Card>
        )}

        <Card className="h-fit space-y-6 border-slate-200/70 bg-white p-6 shadow-sm">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">Order summary</h2>
            <p className="text-sm text-slate-500">
              {orderNumber ? `Order #${orderNumber}` : 'Live inventory reserved for 30 minutes.'}
            </p>
          </div>
          <div className="space-y-4 max-h-64 overflow-y-auto">
            {items.map((item) => (
              <div key={item.id} className="flex items-start justify-between text-sm">
                <div>
                  <p className="font-semibold text-slate-900">{item.name}</p>
                  {item.variant && <p className="text-xs text-slate-400">{item.variant}</p>}
                  <p className="text-xs text-slate-500">Qty {item.quantity}</p>
                </div>
                <p className="font-semibold text-slate-900">{formatCurrency(item.price * item.quantity)}</p>
              </div>
            ))}
          </div>
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
      </div>
    </div>
  );
}
