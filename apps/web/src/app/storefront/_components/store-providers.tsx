/**
 * Cart Provider - Initializes cart on app load
 */
'use client';

import { useEffect } from 'react';
import { useCartStore } from '../../../lib/cart-store';
import { useAuthStore } from '../../../lib/auth-store';
import { useCurrencyStore } from '../../../lib/currency-store';
import { useOnboardingStore } from '../../../lib/onboarding-store';

export function StoreProviders({ children }: { children: React.ReactNode }) {
  const initCart = useCartStore((state) => state.initCart);
  const loadProfile = useAuthStore((state) => state.loadProfile);
  const token = useAuthStore((state) => state.token);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const loadCurrencies = useCurrencyStore((state) => state.loadCurrencies);
  const fetchOnboardingStatus = useOnboardingStore((state) => state.fetchStatus);

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

  // Initialize onboarding after authentication
  useEffect(() => {
    if (isAuthenticated) {
      fetchOnboardingStatus();
    }
  }, [isAuthenticated, fetchOnboardingStatus]);

  return <>{children}</>;
}
