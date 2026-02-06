/**
 * Theme Utility Functions
 * Helper functions for theme manipulation and validation
 */

import type { Theme, ThemeColors, HSLColor, RGBColor } from './types';

/**
 * Convert hex color to HSL
 */
export function hexToHSL(hex: string): HSLColor {
  // Remove # if present
  hex = hex.replace(/^#/, '');

  // Parse hex to RGB
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Convert hex color to RGB
 */
export function hexToRGB(hex: string): RGBColor {
  hex = hex.replace(/^#/, '');

  return {
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16),
  };
}

/**
 * Convert HSL to CSS string
 */
export function hslToString(hsl: HSLColor): string {
  return `${hsl.h} ${hsl.s}% ${hsl.l}%`;
}

/**
 * Calculate luminance of a color
 */
export function getLuminance(hex: string): number {
  const rgb = hexToRGB(hex);
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((val) => {
    const normalized = val / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Determine if a background color needs light or dark text
 */
export function getContrastColor(bgColor: string): 'light' | 'dark' {
  const luminance = getLuminance(bgColor);
  return luminance > 0.5 ? 'dark' : 'light';
}

/**
 * Validate theme object
 */
export function validateTheme(theme: Theme): boolean {
  if (!theme || typeof theme !== 'object') return false;

  // Required fields
  const requiredFields = ['id', 'name', 'slug', 'colors', 'fontFamily'];
  for (const field of requiredFields) {
    if (!(field in theme)) {
      console.error(`Theme validation failed: missing ${field}`);
      return false;
    }
  }

  // Validate colors
  const requiredColors: (keyof ThemeColors)[] = [
    'primary',
    'secondary',
    'accent',
    'background',
    'foreground',
  ];

  for (const color of requiredColors) {
    if (!theme.colors[color]) {
      console.error(`Theme validation failed: missing color ${color}`);
      return false;
    }
  }

  return true;
}

/**
 * Merge two themes (base + overrides)
 */
export function mergeThemes(base: Theme, overrides: Partial<Theme>): Theme {
  return {
    ...base,
    ...overrides,
    colors: {
      ...base.colors,
      ...(overrides.colors || {}),
    },
  };
}

/**
 * Get default theme colors
 */
export function getDefaultColors(): ThemeColors {
  return {
    primary: '#0070f3',
    secondary: '#7928ca',
    accent: '#ff0080',
    background: '#ffffff',
    foreground: '#000000',
    card: '#ffffff',
    cardForeground: '#000000',
    popover: '#ffffff',
    popoverForeground: '#000000',
    muted: '#f4f4f5',
    mutedForeground: '#71717a',
    border: '#e4e4e7',
    input: '#e4e4e7',
    ring: '#0070f3',
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
    chart1: '#0070f3',
    chart2: '#7928ca',
    chart3: '#ff0080',
    chart4: '#22c55e',
    chart5: '#f59e0b',
  };
}

/**
 * Convert theme to CSS string
 */
export function themeToCSS(theme: Theme): string {
  let css = ':root {\n';

  // Add color variables
  Object.entries(theme.colors).forEach(([key, value]) => {
    const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    const hsl = hexToHSL(value);
    css += `  --${cssKey}: ${hslToString(hsl)};\n`;
  });

  // Add typography variables
  css += `  --font-family: ${theme.fontFamily};\n`;
  if (theme.headingFont) {
    css += `  --font-heading: ${theme.headingFont};\n`;
  }

  // Add layout variables
  const spacingMap = {
    compact: '0.75rem',
    normal: '1rem',
    relaxed: '1.5rem',
  };
  css += `  --spacing: ${spacingMap[theme.spacing]};\n`;

  const radiusMap = {
    none: '0',
    sm: '0.125rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
  };
  css += `  --radius: ${radiusMap[theme.borderRadius]};\n`;

  const fontSizeMap = {
    sm: '14px',
    base: '16px',
    lg: '18px',
  };
  css += `  --font-size-base: ${fontSizeMap[theme.fontSize]};\n`;

  css += '}\n';

  // Add custom CSS if present
  if (theme.customCSS) {
    css += `\n${theme.customCSS}\n`;
  }

  return css;
}

/**
 * Generate theme preview data URL
 */
export function generateThemePreview(theme: Theme): string {
  // Create a simple SVG preview
  const svg = `
    <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="300" fill="${theme.colors.background}"/>
      <rect x="20" y="20" width="360" height="60" rx="8" fill="${theme.colors.primary}"/>
      <rect x="20" y="100" width="170" height="80" rx="8" fill="${theme.colors.card}"/>
      <rect x="210" y="100" width="170" height="80" rx="8" fill="${theme.colors.card}"/>
      <rect x="20" y="200" width="360" height="80" rx="8" fill="${theme.colors.accent}"/>
    </svg>
  `;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Extract font families from a font string
 */
export function extractFontFamilies(fontFamily: string): string[] {
  return fontFamily
    .split(',')
    .map((font) => font.trim().replace(/['"]/g, ''))
    .filter((font) => font && !font.startsWith('-') && !font.includes('sans-serif') && !font.includes('serif'));
}

/**
 * Format font family for Google Fonts API
 */
export function formatGoogleFontUrl(fonts: string[]): string {
  const families = fonts.map((font) => font.replace(/ /g, '+'));
  return `https://fonts.googleapis.com/css2?${families.map((f) => `family=${f}:wght@400;500;600;700`).join('&')}&display=swap`;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Check if we're in browser environment
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Safe localStorage operations
 */
export const storage = {
  get: (key: string): string | null => {
    if (!isBrowser()) return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  set: (key: string, value: string): void => {
    if (!isBrowser()) return;
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  },

  remove: (key: string): void => {
    if (!isBrowser()) return;
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to remove from localStorage:', error);
    }
  },
};

/**
 * Create a cache key for theme
 */
export function getThemeCacheKey(tenantId: string): string {
  return `noslag-theme-${tenantId}`;
}

/**
 * Parse cached theme
 */
export function getCachedTheme(tenantId: string): Theme | null {
  const cached = storage.get(getThemeCacheKey(tenantId));
  if (!cached) return null;

  try {
    const theme = JSON.parse(cached);
    return validateTheme(theme) ? theme : null;
  } catch {
    return null;
  }
}

/**
 * Cache theme
 */
export function cacheTheme(tenantId: string, theme: Theme): void {
  storage.set(getThemeCacheKey(tenantId), JSON.stringify(theme));
}

/**
 * Clear theme cache
 */
export function clearThemeCache(tenantId: string): void {
  storage.remove(getThemeCacheKey(tenantId));
}
