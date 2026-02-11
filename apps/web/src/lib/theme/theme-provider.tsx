'use client';

/**
 * Theme Provider
 * Manages theme state and applies themes to the application
 */

import { createContext, useCallback, useEffect, useState, useRef } from 'react';
import type { Theme, ThemeContextValue } from './types';
import { applyTheme, removeTheme, createThemeTransition } from './theme-engine';
import {
  validateTheme,
  getCachedTheme,
  cacheTheme,
  clearThemeCache,
  getDefaultColors,
} from './theme-utils';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  tenantId: string;
  defaultTheme?: Theme;
  enableTransitions?: boolean;
  transitionDuration?: number;
  cacheEnabled?: boolean;
}

export function ThemeProvider({
  children,
  tenantId,
  defaultTheme,
  enableTransitions = true,
  transitionDuration = 300,
  cacheEnabled = true,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isInitialized = useRef(false);
  const currentTenantId = useRef(tenantId);

  const loadTheme = useCallback(async () => {
    if (!tenantId) {
      setError('Tenant ID is required');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Try to load from cache first
      if (cacheEnabled) {
        const cachedTheme = getCachedTheme(tenantId);
        if (cachedTheme) {
          setTheme(cachedTheme);
          await applyTheme(cachedTheme);
          setLoading(false);
          // Continue to fetch fresh data in background
        }
      }

      // Fetch theme from API
      const response = await fetch('/api/v1/store/themes/active', {
        headers: {
          'x-tenant-id': tenantId,
        },
      });

      if (!response.ok) {
        // If no active theme found, try to use default or create a fallback
        if (response.status === 404) {
          if (defaultTheme) {
            setTheme(defaultTheme);
            await applyTheme(defaultTheme);
          } else {
            // Create a basic fallback theme
            const fallbackTheme: Theme = {
              id: 'fallback',
              name: 'Default',
              slug: 'default',
              tenantId,
              isActive: true,
              colors: getDefaultColors(),
              typography: { bodyFont: 'Inter', bodyWeight: '400', headingFont: 'Inter', headingWeight: '700', baseFontSize: 'base' },
              layout: { layoutStyle: 'standard', headerStyle: 'default', footerStyle: 'default', spacing: 'normal', containerMaxWidth: 1200 },
              components: { buttonStyle: 'solid', buttonSize: 'md', cardStyle: 'elevated', cardRadius: 8, inputStyle: 'outlined' },
              productDisplay: { gridColumns: 4, imageRatio: '1:1', showQuickView: true, showWishlist: true },
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              fontSize: 'base',
              layoutStyle: 'standard',
              spacing: 'normal',
              borderRadius: 'md',
              isPreset: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            setTheme(fallbackTheme);
            await applyTheme(fallbackTheme);
          }
        } else {
          throw new Error(`Failed to load theme: ${response.statusText}`);
        }
      } else {
        const data = await response.json();

        // Validate theme data
        if (!validateTheme(data)) {
          throw new Error('Invalid theme data received from server');
        }

        // Apply transitions if enabled and not initial load
        if (enableTransitions && isInitialized.current) {
          createThemeTransition(transitionDuration);
        }

        // Apply the theme
        setTheme(data);
        await applyTheme(data);

        // Cache the theme
        if (cacheEnabled) {
          cacheTheme(tenantId, data);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load theme';
      setError(errorMessage);
      console.error('Theme loading error:', err);

      // Try to use cached theme as fallback
      if (cacheEnabled) {
        const cachedTheme = getCachedTheme(tenantId);
        if (cachedTheme) {
          console.log('Using cached theme as fallback');
          setTheme(cachedTheme);
          await applyTheme(cachedTheme);
          setError(null); // Clear error if we have a fallback
        }
      }
    } finally {
      setLoading(false);
      isInitialized.current = true;
    }
  }, [tenantId, defaultTheme, enableTransitions, transitionDuration, cacheEnabled]);

  // Load theme on mount and when tenantId changes
  useEffect(() => {
    // If tenant changed, clear the old theme
    if (currentTenantId.current !== tenantId) {
      if (cacheEnabled) {
        clearThemeCache(currentTenantId.current);
      }
      currentTenantId.current = tenantId;
      isInitialized.current = false;
    }

    loadTheme();

    // Cleanup on unmount
    return () => {
      if (!isInitialized.current) {
        removeTheme();
      }
    };
  }, [tenantId, loadTheme, cacheEnabled]);

  // Handle visibility change - refresh theme when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isInitialized.current) {
        // Optionally refresh theme when user returns to tab
        // This ensures theme is up-to-date if changed elsewhere
        // You might want to add a delay or check timestamp to avoid too frequent refreshes
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const refreshTheme = useCallback(async () => {
    await loadTheme();
  }, [loadTheme]);

  const contextValue: ThemeContextValue = {
    theme,
    loading,
    error,
    refreshTheme,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export { ThemeContext };

/**
 * Server-side theme provider (doesn't apply theme, just provides context)
 */
export function ServerThemeProvider({
  children,
  theme,
}: {
  children: React.ReactNode;
  theme: Theme | null;
}) {
  const contextValue: ThemeContextValue = {
    theme,
    loading: false,
    error: null,
    refreshTheme: async () => {
      console.warn('refreshTheme called on server - no-op');
    },
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}
