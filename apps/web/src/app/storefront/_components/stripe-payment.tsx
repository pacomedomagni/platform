/**
 * Stripe Payment Component
 * Handles payment form with Stripe Elements
 */
'use client';

import { useState, useEffect } from 'react';
import {
  PaymentElement,
  Elements,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { paymentsApi } from '../../../lib/store-api';

// Stripe promise - loaded once
let stripePromise: Promise<Stripe | null> | null = null;

async function getStripePromise() {
  if (!stripePromise) {
    const config = await paymentsApi.getConfig();
    if (config.publicKey) {
      stripePromise = loadStripe(config.publicKey);
    }
  }
  return stripePromise;
}

interface PaymentFormProps {
  clientSecret: string;
  orderId?: string;
  orderNumber?: string;
  onSuccess: () => void;
  onError: (message: string) => void;
}

function PaymentForm({ clientSecret, orderId, orderNumber, onSuccess, onError }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setMessage(null);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/storefront/order-confirmation?order=${orderNumber || orderId || ''}`,
        },
        redirect: 'if_required',
      });

      if (error) {
        setMessage(error.message || 'Payment failed');
        onError(error.message || 'Payment failed');
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        onSuccess();
      } else if (paymentIntent && paymentIntent.status === 'requires_action') {
        // 3D Secure or other authentication
        const { error: confirmError } = await stripe.confirmPayment({
          elements,
          confirmParams: {
            return_url: `${window.location.origin}/storefront/order-confirmation?order=${orderNumber || orderId || ''}`,
          },
        });
        
        if (confirmError) {
          setMessage(confirmError.message || 'Payment authentication failed');
          onError(confirmError.message || 'Payment authentication failed');
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Payment failed';
      setMessage(errorMessage);
      onError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement
        options={{
          layout: 'tabs',
        }}
      />
      
      {message && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {message}
        </div>
      )}

      <button
        type="submit"
        disabled={isProcessing || !stripe || !elements}
        className="w-full rounded-lg bg-gradient-to-r from-indigo-600 via-blue-600 to-amber-400 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Processing...
          </span>
        ) : (
          'Complete Payment'
        )}
      </button>
    </form>
  );
}

interface StripePaymentProps {
  clientSecret: string;
  orderId?: string;
  orderNumber?: string;
  onSuccess: () => void;
  onError: (message: string) => void;
}

export function StripePayment({ clientSecret, orderId, orderNumber, onSuccess, onError }: StripePaymentProps) {
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStripePromise().then((s) => {
      setStripe(s);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!stripe) {
    return (
      <div className="rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800">
        Payment processing is not available. Please contact support.
      </div>
    );
  }

  return (
    <Elements
      stripe={stripe}
      options={{
        clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#4f46e5',
            colorBackground: '#ffffff',
            colorText: '#1e293b',
            colorDanger: '#dc2626',
            fontFamily: 'system-ui, sans-serif',
            spacingUnit: '4px',
            borderRadius: '8px',
          },
        },
      }}
    >
      {/* Express Checkout Notice */}
      <div className="mb-4 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="font-medium">Express checkout available</span>
        </div>
        <p className="mt-1 text-xs text-blue-600">
          Apple Pay, Google Pay, and Link are supported for faster checkout when available on your device.
        </p>
      </div>
      <PaymentForm
        clientSecret={clientSecret}
        orderId={orderId}
        orderNumber={orderNumber}
        onSuccess={onSuccess}
        onError={onError}
      />
    </Elements>
  );
}

// Demo/test mode indicator
export function PaymentModeIndicator() {
  const [isTestMode, setIsTestMode] = useState<boolean | null>(null);

  useEffect(() => {
    paymentsApi.getConfig().then((config) => {
      setIsTestMode(config.publicKey?.startsWith('pk_test_') ?? null);
    });
  }, []);

  if (isTestMode === null) return null;

  return isTestMode ? (
    <div className="mb-4 rounded-lg bg-amber-50 px-4 py-2 text-xs text-amber-700">
      🧪 Test mode — Use card <code className="mx-1 rounded bg-amber-100 px-1">4242 4242 4242 4242</code> with any future date and CVC
    </div>
  ) : null;
}
