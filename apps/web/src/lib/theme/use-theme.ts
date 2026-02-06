'use client';

/**
 * Theme Hooks
 * Custom hooks for accessing theme data and utilities
 */

import { useContext, useMemo } from 'react';
import { ThemeContext } from './theme-provider';
import type { ThemeColors, LayoutConfig, TypographyConfig } from './types';

/**
 * Main theme hook - access full theme context
 */
export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }

  return context;
}

/**
 * Get a specific theme color
 */
export function useThemeColor(colorKey: keyof ThemeColors): string {
  const { theme } = useTheme();

  return useMemo(() => {
    if (!theme) return '';
    return theme.colors[colorKey] || '';
  }, [theme, colorKey]);
}

/**
 * Get all theme colors
 */
export function useThemeColors(): ThemeColors | null {
  const { theme } = useTheme();

  return useMemo(() => {
    if (!theme) return null;
    return theme.colors;
  }, [theme]);
}

/**
 * Get theme fonts
 */
export function useThemeFont(): { body: string; heading: string } {
  const { theme } = useTheme();

  return useMemo(() => {
    if (!theme) {
      return {
        body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        heading: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      };
    }

    return {
      body: theme.fontFamily,
      heading: theme.headingFont || theme.fontFamily,
    };
  }, [theme]);
}

/**
 * Get layout configuration
 */
export function useThemeLayout(): LayoutConfig {
  const { theme } = useTheme();

  return useMemo(() => {
    if (!theme) {
      return {
        layoutStyle: 'standard',
        spacing: 'normal',
        borderRadius: 'md',
      };
    }

    return {
      layoutStyle: theme.layoutStyle,
      spacing: theme.spacing,
      borderRadius: theme.borderRadius,
    };
  }, [theme]);
}

/**
 * Get typography configuration
 */
export function useTypography(): TypographyConfig {
  const { theme } = useTheme();

  return useMemo(() => {
    if (!theme) {
      return {
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: 'base',
      };
    }

    return {
      fontFamily: theme.fontFamily,
      headingFont: theme.headingFont,
      fontSize: theme.fontSize,
    };
  }, [theme]);
}

/**
 * Get component styles
 */
export function useComponentStyles() {
  const { theme } = useTheme();

  return useMemo(() => {
    if (!theme) {
      return {
        buttonStyle: 'solid' as const,
        buttonRounding: 'md' as const,
        inputStyle: 'outlined' as const,
        cardStyle: 'elevated' as const,
        cardShadow: 'md' as const,
        navStyle: 'underline' as const,
      };
    }

    return {
      buttonStyle: theme.buttonStyle || 'solid',
      buttonRounding: theme.buttonRounding || 'md',
      inputStyle: theme.inputStyle || 'outlined',
      cardStyle: theme.cardStyle || 'elevated',
      cardShadow: theme.cardShadow || 'md',
      navStyle: theme.navStyle || 'underline',
    };
  }, [theme]);
}

/**
 * Check if theme is loading
 */
export function useThemeLoading(): boolean {
  const { loading } = useTheme();
  return loading;
}

/**
 * Get theme error if any
 */
export function useThemeError(): string | null {
  const { error } = useTheme();
  return error;
}

/**
 * Check if theme is ready (loaded and no error)
 */
export function useThemeReady(): boolean {
  const { loading, error } = useTheme();
  return !loading && !error;
}

/**
 * Get a CSS variable value
 */
export function useCSSVariable(variable: string): string {
  const { theme } = useTheme();

  return useMemo(() => {
    if (typeof window === 'undefined') return '';

    const root = document.documentElement;
    return getComputedStyle(root).getPropertyValue(variable).trim();
  }, [theme, variable]);
}

/**
 * Get theme preset type
 */
export function useThemePreset(): string | null {
  const { theme } = useTheme();

  return useMemo(() => {
    if (!theme || !theme.isPreset) return null;
    return theme.presetType || null;
  }, [theme]);
}

/**
 * Check if current theme is a preset
 */
export function useIsPresetTheme(): boolean {
  const { theme } = useTheme();

  return useMemo(() => {
    return theme?.isPreset || false;
  }, [theme]);
}

/**
 * Get theme ID
 */
export function useThemeId(): string | null {
  const { theme } = useTheme();
  return theme?.id || null;
}

/**
 * Get theme name
 */
export function useThemeName(): string {
  const { theme } = useTheme();
  return theme?.name || 'Default';
}

/**
 * Get primary action color (for buttons, links, etc.)
 */
export function usePrimaryColor(): string {
  return useThemeColor('primary');
}

/**
 * Get background color
 */
export function useBackgroundColor(): string {
  return useThemeColor('background');
}

/**
 * Get foreground/text color
 */
export function useForegroundColor(): string {
  return useThemeColor('foreground');
}

/**
 * Refresh theme manually
 */
export function useRefreshTheme(): () => Promise<void> {
  const { refreshTheme } = useTheme();
  return refreshTheme;
}

/**
 * Get spacing value based on theme
 */
export function useSpacing(): string {
  const { theme } = useTheme();

  return useMemo(() => {
    if (!theme) return '1rem';

    const spacingMap = {
      compact: '0.75rem',
      normal: '1rem',
      relaxed: '1.5rem',
    };

    return spacingMap[theme.spacing];
  }, [theme]);
}

/**
 * Get border radius value based on theme
 */
export function useBorderRadius(): string {
  const { theme } = useTheme();

  return useMemo(() => {
    if (!theme) return '0.375rem';

    const radiusMap = {
      none: '0',
      sm: '0.125rem',
      md: '0.375rem',
      lg: '0.5rem',
      xl: '0.75rem',
    };

    return radiusMap[theme.borderRadius];
  }, [theme]);
}

/**
 * Check if theme is dark (based on background color luminance)
 */
export function useIsDarkTheme(): boolean {
  const backgroundColor = useBackgroundColor();

  return useMemo(() => {
    if (!backgroundColor) return false;

    // Simple check: if background starts with # and first digit is < 8, it's dark
    const hex = backgroundColor.replace('#', '');
    if (hex.length >= 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);

      // Calculate luminance
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance < 0.5;
    }

    return false;
  }, [backgroundColor]);
}
