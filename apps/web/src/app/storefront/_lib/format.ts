'use client';

import { useCurrencyStore } from '@/lib/currency-store';

/**
 * Format currency using the storefront currency store.
 * When the currency store is active (client-side with currencies loaded),
 * it delegates to the store's formatPrice which respects the selected currency.
 * Falls back to basic USD formatting for SSR or when the store is not yet hydrated.
 */
export const formatCurrency = (value: number, currency?: string) => {
  // Try to use the currency store (available on client after hydration)
  try {
    const store = useCurrencyStore.getState();
    if (store.selectedCurrency) {
      return store.formatPrice(value);
    }
  } catch {
    // Store not available (SSR or not yet initialized)
  }

  // Fallback formatting - use browser locale when available
  const code = currency || 'USD';
  const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: code,
    maximumFractionDigits: 2,
  }).format(value);
};
