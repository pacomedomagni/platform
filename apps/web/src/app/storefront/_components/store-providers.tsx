/**
 * Store Providers - Initializes all store-level providers
 */
'use client';

import { useEffect, useState } from 'react';
import { Toaster } from '@platform/ui';
import { useCartStore } from '../../../lib/cart-store';
import { useAuthStore } from '../../../lib/auth-store';
import { useCurrencyStore } from '../../../lib/currency-store';
import { useOnboardingStore } from '../../../lib/onboarding-store';
import { ThemeProvider } from '../../../lib/theme';
import { FontLoader } from '../../../lib/theme/font-loader';
import { ThemeStyles } from '../../../lib/theme/theme-styles';
import { resolveTenantId } from '../../../lib/store-api';

export function StoreProviders({ children }: { children: React.ReactNode }) {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const initCart = useCartStore((state) => state.initCart);
  const loadProfile = useAuthStore((state) => state.loadProfile);
  const token = useAuthStore((state) => state.token);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const loadCurrencies = useCurrencyStore((state) => state.loadCurrencies);
  const fetchOnboardingStatus = useOnboardingStore((state) => state.fetchStatus);

  useEffect(() => {
    resolveTenantId().then(setTenantId);

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

  if (!tenantId) return null;

  return (
    <ThemeProvider
      tenantId={tenantId}
      enableTransitions={true}
      transitionDuration={300}
      cacheEnabled={true}
    >
      <FontLoader fonts={['Inter', 'Poppins']} />
      <ThemeStyles />
      {children}
      <Toaster />
    </ThemeProvider>
  );
}
