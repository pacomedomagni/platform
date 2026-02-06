/**
 * Currency Switcher Component
 * Dropdown to select currency in storefront header
 */
'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Globe } from 'lucide-react';
import { useCurrencyStore, StoreCurrency } from '../../../lib/currency-store';

export function CurrencySwitcher() {
  const { currencies, selectedCurrency, isLoading, loadCurrencies, selectCurrency } = useCurrencyStore();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (currencies.length === 0) {
      loadCurrencies();
    }
  }, [currencies.length, loadCurrencies]);

  if (isLoading || currencies.length <= 1) {
    return null; // Don't show if only one currency or still loading
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
      >
        <Globe className="h-4 w-4" />
        <span className="font-medium">{selectedCurrency?.code || 'USD'}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-30"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute right-0 top-full z-40 mt-1 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            <div className="px-3 py-2 border-b border-slate-100">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Select Currency
              </p>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {currencies.filter((c) => c.isActive).map((currency) => (
                <button
                  key={currency.code}
                  type="button"
                  onClick={() => {
                    selectCurrency(currency.code);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                    selectedCurrency?.code === currency.code
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-6 text-center font-medium">{currency.symbol}</span>
                    <span>{currency.name}</span>
                  </span>
                  <span className="text-slate-400 text-xs">{currency.code}</span>
                </button>
              ))}
            </div>
            {currencies.some((c) => !c.isDefault) && (
              <div className="px-3 py-2 border-t border-slate-100">
                <p className="text-[11px] text-slate-400">
                  Prices converted at current rates
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Price Display Component
 * Shows price in selected currency
 */
export function Price({
  amount,
  compareAt,
  className = '',
}: {
  amount: number;
  compareAt?: number | null;
  className?: string;
}) {
  const { formatPrice } = useCurrencyStore();

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="font-semibold">{formatPrice(amount)}</span>
      {compareAt && compareAt > amount && (
        <span className="text-sm text-slate-400 line-through">
          {formatPrice(compareAt)}
        </span>
      )}
    </span>
  );
}
