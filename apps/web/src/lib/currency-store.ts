/**
 * Currency State Management using Zustand
 * Manages multi-currency for storefront
 */
'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface StoreCurrency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  exchangeRate: number;
  isDefault: boolean;
  isActive: boolean;
}

interface CurrencyState {
  // State
  currencies: StoreCurrency[];
  selectedCurrency: StoreCurrency | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadCurrencies: () => Promise<void>;
  selectCurrency: (currencyCode: string) => void;
  convertPrice: (priceInBaseCurrency: number) => number;
  formatPrice: (amount: number) => string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

function getTenantId(): string {
  if (typeof window === 'undefined') return process.env.NEXT_PUBLIC_TENANT_ID || 'default';
  // Use resolved tenant from session, or localStorage, or env fallback
  return sessionStorage.getItem('resolved_tenant_id')
    || localStorage.getItem('tenantId')
    || process.env.NEXT_PUBLIC_TENANT_ID
    || 'default';
}

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set, get) => ({
      // Initial state
      currencies: [],
      selectedCurrency: null,
      isLoading: false,
      error: null,

      // Load available currencies from API
      loadCurrencies: async () => {
        set({ isLoading: true, error: null });

        try {
          const response = await fetch(`${API_BASE}/v1/currencies/store`, {
            headers: {
              'Content-Type': 'application/json',
              'x-tenant-id': getTenantId(),
            },
          });

          if (!response.ok) {
            throw new Error('Failed to load currencies');
          }

          const currencies: StoreCurrency[] = await response.json();
          const defaultCurrency = currencies.find((c) => c.isDefault) || currencies[0];

          set({
            currencies,
            selectedCurrency: get().selectedCurrency || defaultCurrency,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to load currencies';
          set({ error: message });
          console.error('Failed to load currencies:', error);
        } finally {
          set({ isLoading: false });
        }
      },

      // Select a currency
      selectCurrency: (currencyCode: string) => {
        const { currencies } = get();
        const currency = currencies.find((c) => c.code === currencyCode);
        if (currency) {
          set({ selectedCurrency: currency });
        }
      },

      // Convert price from base currency to selected currency
      convertPrice: (priceInBaseCurrency: number) => {
        const { selectedCurrency } = get();
        if (!selectedCurrency || selectedCurrency.exchangeRate === 1) {
          return priceInBaseCurrency;
        }
        return priceInBaseCurrency * selectedCurrency.exchangeRate;
      },

      // Format price with currency symbol
      formatPrice: (amount: number) => {
        const { selectedCurrency } = get();
        const convertedAmount = get().convertPrice(amount);
        const symbol = selectedCurrency?.symbol || '$';
        const code = selectedCurrency?.code || 'USD';

        // Format based on currency code
        try {
          return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: code,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(convertedAmount);
        } catch {
          // Fallback formatting
          return `${symbol}${convertedAmount.toFixed(2)}`;
        }
      },
    }),
    {
      name: 'currency-storage',
      partialize: (state) => ({
        selectedCurrency: state.selectedCurrency,
      }),
    }
  )
);
