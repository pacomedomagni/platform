/**
 * Square Payment Component
 * Handles card payment form using Square Web Payments SDK
 */
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { paymentsApi } from '../../../lib/store-api';

// Square SDK type declarations (minimal subset for card payments)
interface SquarePayments {
  card: () => Promise<SquareCard>;
}

interface SquareCard {
  attach: (selector: string) => Promise<void>;
  tokenize: () => Promise<SquareTokenResult>;
  destroy: () => Promise<void>;
}

interface SquareTokenResult {
  status: 'OK' | 'ERROR';
  token?: string;
  errors?: Array<{ message: string }>;
}

declare global {
  interface Window {
    Square?: {
      payments: (appId: string, locationId: string) => SquarePayments;
    };
  }
}

interface SquarePaymentProps {
  orderId: string;
  applicationId: string;
  locationId: string;
  onSuccess: () => void;
  onError: (message: string) => void;
}

/**
 * Dynamically load the Square Web Payments SDK script.
 * Uses sandbox URL when the applicationId starts with "sandbox-" otherwise production.
 */
function loadSquareSdk(applicationId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Square) {
      resolve();
      return;
    }

    const existing = document.querySelector('script[data-square-sdk]');
    if (existing) {
      // Script already appended but not loaded yet - wait for it
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Square SDK')));
      return;
    }

    const isSandbox = applicationId.startsWith('sandbox-');
    const src = isSandbox
      ? 'https://sandbox.web.squarecdn.com/v1/square.js'
      : 'https://web.squarecdn.com/v1/square.js';

    const script = document.createElement('script');
    script.src = src;
    script.setAttribute('data-square-sdk', 'true');
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Square SDK'));
    document.head.appendChild(script);
  });
}

export function SquarePayment({
  orderId,
  applicationId,
  locationId,
  onSuccess,
  onError,
}: SquarePaymentProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [cardReady, setCardReady] = useState(false);
  const cardRef = useRef<SquareCard | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // L4: Stabilize onError reference to prevent useEffect re-runs
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        await loadSquareSdk(applicationId);

        if (cancelled || !window.Square) return;

        const payments = window.Square.payments(applicationId, locationId);
        const card = await payments.card();

        if (cancelled) {
          await card.destroy();
          return;
        }

        await card.attach('#square-card-container');
        cardRef.current = card;
        setCardReady(true);
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Failed to initialize payment form';
          setMessage(msg);
          onErrorRef.current(msg);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      if (cardRef.current) {
        cardRef.current.destroy().catch(() => {});
        cardRef.current = null;
      }
    };
  }, [applicationId, locationId]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!cardRef.current || isProcessing) return;

      setIsProcessing(true);
      setMessage(null);

      try {
        // Step 1: Tokenize the card with Square SDK
        const result = await cardRef.current.tokenize();

        if (result.status !== 'OK' || !result.token) {
          const errorMsg =
            result.errors?.[0]?.message || 'Card tokenization failed. Please check your card details.';
          setMessage(errorMsg);
          onError(errorMsg);
          return;
        }

        // Step 2: Send the nonce (sourceId) + orderId to our backend
        await paymentsApi.processSquarePayment(orderId, result.token);

        // Step 3: Payment succeeded
        onSuccess();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Payment failed. Please try again.';
        setMessage(errorMsg);
        onError(errorMsg);
      } finally {
        setIsProcessing(false);
      }
    },
    [orderId, isProcessing, onSuccess, onError],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Square card form will be injected here */}
      <div
        id="square-card-container"
        ref={containerRef}
        className="min-h-[90px]"
      />

      {message && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {message}
        </div>
      )}

      <button
        type="submit"
        disabled={isProcessing || !cardReady}
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
