/**
 * Store Providers - Initializes all store-level providers
 */
'use client';

import { useEffect } from 'react';
import { useCartStore } from '../../../lib/cart-store';
import { useAuthStore } from '../../../lib/auth-store';
import { useCurrencyStore } from '../../../lib/currency-store';
import { useOnboardingStore } from '../../../lib/onboarding-store';
import { ThemeProvider } from '../../../lib/theme';
import { FontLoader } from '../../../lib/theme/font-loader';
import { ThemeStyles } from '../../../lib/theme/theme-styles';

// Get tenant ID from environment or context
// In a real app, this would come from subdomain/domain/auth context
const getTenantId = (): string => {
  return process.env.NEXT_PUBLIC_TENANT_ID || 'default-tenant';
};

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

  const tenantId = getTenantId();

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
    </ThemeProvider>
  );
}
