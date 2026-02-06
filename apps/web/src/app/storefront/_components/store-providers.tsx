/**
 * Cart Provider - Initializes cart on app load
 */
'use client';

import { useEffect } from 'react';
import { useCartStore } from '../../../lib/cart-store';
import { useAuthStore } from '../../../lib/auth-store';
import { useCurrencyStore } from '../../../lib/currency-store';

export function StoreProviders({ children }: { children: React.ReactNode }) {
  const initCart = useCartStore((state) => state.initCart);
  const loadProfile = useAuthStore((state) => state.loadProfile);
  const token = useAuthStore((state) => state.token);
  const loadCurrencies = useCurrencyStore((state) => state.loadCurrencies);

  useEffect(() => {
    // Initialize cart
    initCart();

    // Load available currencies
    loadCurrencies();

    // Load customer profile if token exists
    if (token) {
      loadProfile();
    }
  }, [initCart, loadProfile, token, loadCurrencies]);

  return <>{children}</>;
}
