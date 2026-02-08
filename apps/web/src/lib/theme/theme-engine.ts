/**
 * Theme Engine
 * Core functions for applying themes to the DOM
 * Supports light/dark mode with WCAG AA compliant colors
 */

import type { Theme, ThemeColors } from './types';
import {
  hexToHSL,
  hslToString,
  extractFontFamilies,
  formatGoogleFontUrl,
  isBrowser,
} from './theme-utils';

const THEME_STYLE_ID = 'noslag-theme-dynamic';
const THEME_FONT_LINK_ID = 'noslag-theme-fonts';

/**
 * Get current color mode from document
 */
export function getCurrentColorMode(): 'light' | 'dark' {
  if (!isBrowser()) return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

/**
 * Apply theme colors as CSS variables to :root
 * Applies both light and dark mode colors using CSS custom properties
 */
export function applyThemeColors(colors: ThemeColors, darkColors?: ThemeColors): void {
  if (!isBrowser()) return;

  const root = document.documentElement;

  // Apply light mode colors as base
  Object.entries(colors).forEach(([key, value]) => {
    const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    const hsl = hexToHSL(value);
    root.style.setProperty(`--${cssKey}`, hslToString(hsl));
  });

  // If dark colors provided, generate dark mode CSS and inject it
  if (darkColors) {
    applyDarkModeColors(darkColors);
  }
}

/**
 * Apply dark mode colors as a separate style block
 * This allows the colors to automatically switch based on .dark class
 */
function applyDarkModeColors(darkColors: ThemeColors): void {
  if (!isBrowser()) return;

  const darkStyleId = 'noslag-theme-dark';
  let styleEl = document.getElementById(darkStyleId) as HTMLStyleElement;

  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = darkStyleId;
    document.head.appendChild(styleEl);
  }

  let css = '.dark {\n';
  Object.entries(darkColors).forEach(([key, value]) => {
    const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    const hsl = hexToHSL(value);
    css += `  --${cssKey}: ${hslToString(hsl)};\n`;
  });
  css += '}\n';

  styleEl.textContent = css;
}

/**
 * Load Google Fonts dynamically
 */
export async function loadThemeFonts(
  fontFamily: string,
  headingFont?: string
): Promise<void> {
  if (!isBrowser()) return;

  // Extract font families
  const fonts = extractFontFamilies(fontFamily);
  if (headingFont) {
    const headingFonts = extractFontFamilies(headingFont);
    fonts.push(...headingFonts);
  }

  // Remove duplicates
  const uniqueFonts = [...new Set(fonts)];

  if (uniqueFonts.length === 0) return;

  // Remove existing font link
  const existingLink = document.getElementById(THEME_FONT_LINK_ID);
  if (existingLink) {
    existingLink.remove();
  }

  // Create new font link
  const link = document.createElement('link');
  link.id = THEME_FONT_LINK_ID;
  link.rel = 'stylesheet';
  link.href = formatGoogleFontUrl(uniqueFonts);

  // Add to document head
  document.head.appendChild(link);

  // Wait for fonts to load
  return new Promise((resolve, reject) => {
    link.onload = () => resolve();
    link.onerror = () => reject(new Error('Failed to load fonts'));

    // Timeout after 5 seconds
    setTimeout(() => resolve(), 5000);
  });
}

/**
 * Apply layout styles
 */
export function applyLayoutStyles(
  layoutStyle: 'standard' | 'wide' | 'boxed',
  spacing: 'compact' | 'normal' | 'relaxed'
): void {
  if (!isBrowser()) return;

  const root = document.documentElement;

  // Apply layout class
  root.classList.remove('layout-standard', 'layout-wide', 'layout-boxed');
  root.classList.add(`layout-${layoutStyle}`);

  // Apply spacing class
  root.classList.remove('spacing-compact', 'spacing-normal', 'spacing-relaxed');
  root.classList.add(`spacing-${spacing}`);

  // Set CSS variables for layout
  const maxWidthMap = {
    standard: '1280px',
    wide: '1536px',
    boxed: '1024px',
  };

  const spacingMap = {
    compact: '0.75rem',
    normal: '1rem',
    relaxed: '1.5rem',
  };

  root.style.setProperty('--layout-max-width', maxWidthMap[layoutStyle]);
  root.style.setProperty('--spacing', spacingMap[spacing]);
}

/**
 * Apply typography styles
 */
export function applyTypographyStyles(theme: Theme): void {
  if (!isBrowser()) return;

  const root = document.documentElement;

  // Font families
  root.style.setProperty('--font-family', theme.fontFamily);
  if (theme.headingFont) {
    root.style.setProperty('--font-heading', theme.headingFont);
  } else {
    root.style.setProperty('--font-heading', theme.fontFamily);
  }

  // Font size
  const fontSizeMap = {
    sm: '14px',
    base: '16px',
    lg: '18px',
  };
  root.style.setProperty('--font-size-base', fontSizeMap[theme.fontSize]);

  // Apply font size class
  root.classList.remove('text-sm', 'text-base', 'text-lg');
  root.classList.add(`text-${theme.fontSize}`);
}

/**
 * Apply component styles
 */
export function applyComponentStyles(theme: Theme): void {
  if (!isBrowser()) return;

  const root = document.documentElement;

  // Border radius
  const radiusMap = {
    none: '0',
    sm: '0.125rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
  };
  root.style.setProperty('--radius', radiusMap[theme.borderRadius]);

  // Button styles
  if (theme.buttonRounding) {
    const buttonRadiusMap = {
      none: '0',
      sm: '0.25rem',
      md: '0.5rem',
      lg: '0.75rem',
      full: '9999px',
    };
    root.style.setProperty('--button-radius', buttonRadiusMap[theme.buttonRounding]);
  }

  // Card shadow
  if (theme.cardShadow) {
    const shadowMap = {
      none: 'none',
      sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
      lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
      xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
    };
    root.style.setProperty('--card-shadow', shadowMap[theme.cardShadow]);
  }
}

/**
 * Generate complete theme CSS
 */
export function generateThemeCSS(theme: Theme): string {
  let css = ':root {\n';

  // Colors
  Object.entries(theme.colors).forEach(([key, value]) => {
    const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    const hsl = hexToHSL(value);
    css += `  --${cssKey}: ${hslToString(hsl)};\n`;
  });

  // Typography
  css += `  --font-family: ${theme.fontFamily};\n`;
  css += `  --font-heading: ${theme.headingFont || theme.fontFamily};\n`;

  const fontSizeMap = {
    sm: '14px',
    base: '16px',
    lg: '18px',
  };
  css += `  --font-size-base: ${fontSizeMap[theme.fontSize]};\n`;

  // Layout
  const maxWidthMap = {
    standard: '1280px',
    wide: '1536px',
    boxed: '1024px',
  };
  css += `  --layout-max-width: ${maxWidthMap[theme.layoutStyle]};\n`;

  const spacingMap = {
    compact: '0.75rem',
    normal: '1rem',
    relaxed: '1.5rem',
  };
  css += `  --spacing: ${spacingMap[theme.spacing]};\n`;

  // Border radius
  const radiusMap = {
    none: '0',
    sm: '0.125rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
  };
  css += `  --radius: ${radiusMap[theme.borderRadius]};\n`;

  // Button radius
  if (theme.buttonRounding) {
    const buttonRadiusMap = {
      none: '0',
      sm: '0.25rem',
      md: '0.5rem',
      lg: '0.75rem',
      full: '9999px',
    };
    css += `  --button-radius: ${buttonRadiusMap[theme.buttonRounding]};\n`;
  }

  // Card shadow
  if (theme.cardShadow) {
    const shadowMap = {
      none: 'none',
      sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
      lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
      xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
    };
    css += `  --card-shadow: ${shadowMap[theme.cardShadow]};\n`;
  }

  css += '}\n';

  return css;
}

/**
 * Inject theme CSS into the document
 */
export function injectThemeCSS(css: string): void {
  if (!isBrowser()) return;

  // Remove existing theme style
  let styleElement = document.getElementById(THEME_STYLE_ID) as HTMLStyleElement;

  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = THEME_STYLE_ID;
    document.head.appendChild(styleElement);
  }

  styleElement.textContent = css;
}

/**
 * Apply custom CSS
 */
export function applyCustomCSS(customCSS?: string): void {
  if (!isBrowser() || !customCSS) return;

  const customStyleId = 'noslag-theme-custom';
  let styleElement = document.getElementById(customStyleId) as HTMLStyleElement;

  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = customStyleId;
    document.head.appendChild(styleElement);
  }

  styleElement.textContent = customCSS;
}

/**
 * Main function to apply complete theme
 */
export async function applyTheme(theme: Theme): Promise<void> {
  if (!isBrowser()) return;

  // Apply colors (including dark mode if available)
  applyThemeColors(theme.colors, theme.darkColors);

  // Apply typography
  applyTypographyStyles(theme);

  // Apply layout
  applyLayoutStyles(theme.layoutStyle, theme.spacing);

  // Apply component styles
  applyComponentStyles(theme);

  // Generate and inject CSS
  const css = generateThemeCSS(theme);
  injectThemeCSS(css);

  // Apply custom CSS
  if (theme.customCSS) {
    applyCustomCSS(theme.customCSS);
  }

  // Load fonts (async, don't block)
  try {
    await loadThemeFonts(theme.fontFamily, theme.headingFont);
  } catch (error) {
    console.error('Failed to load theme fonts:', error);
    // Continue anyway - system fonts will be used as fallback
  }
}

/**
 * Remove theme from document
 */
export function removeTheme(): void {
  if (!isBrowser()) return;

  // Remove dynamic styles
  const styleElement = document.getElementById(THEME_STYLE_ID);
  if (styleElement) {
    styleElement.remove();
  }

  // Remove dark mode styles
  const darkStyleElement = document.getElementById('noslag-theme-dark');
  if (darkStyleElement) {
    darkStyleElement.remove();
  }

  // Remove custom CSS
  const customStyleElement = document.getElementById('noslag-theme-custom');
  if (customStyleElement) {
    customStyleElement.remove();
  }

  // Remove font link
  const fontLink = document.getElementById(THEME_FONT_LINK_ID);
  if (fontLink) {
    fontLink.remove();
  }

  // Remove CSS variables from :root
  const root = document.documentElement;
  const styles = root.style;

  // Remove all theme-related CSS variables
  for (let i = styles.length - 1; i >= 0; i--) {
    const prop = styles[i];
    if (
      prop.startsWith('--primary') ||
      prop.startsWith('--secondary') ||
      prop.startsWith('--accent') ||
      prop.startsWith('--background') ||
      prop.startsWith('--foreground') ||
      prop.startsWith('--card') ||
      prop.startsWith('--font') ||
      prop.startsWith('--layout') ||
      prop.startsWith('--spacing') ||
      prop.startsWith('--radius') ||
      prop.startsWith('--button') ||
      prop.includes('chart')
    ) {
      root.style.removeProperty(prop);
    }
  }

  // Remove theme classes
  root.classList.remove(
    'layout-standard',
    'layout-wide',
    'layout-boxed',
    'spacing-compact',
    'spacing-normal',
    'spacing-relaxed',
    'text-sm',
    'text-base',
    'text-lg'
  );
}

/**
 * Create smooth transition when changing themes
 */
export function createThemeTransition(duration = 300): void {
  if (!isBrowser()) return;

  const root = document.documentElement;

  // Add transition class
  root.style.transition = `background-color ${duration}ms ease-in-out, color ${duration}ms ease-in-out`;

  // Remove transition after duration
  setTimeout(() => {
    root.style.transition = '';
  }, duration);
}

/**
 * Preload theme for instant application
 */
export function preloadTheme(theme: Theme): void {
  if (!isBrowser()) return;

  // Generate CSS
  const css = generateThemeCSS(theme);

  // Inject into a hidden style tag for preloading
  const preloadId = 'noslag-theme-preload';
  let styleElement = document.getElementById(preloadId) as HTMLStyleElement;

  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = preloadId;
    styleElement.setAttribute('data-preload', 'true');
    document.head.appendChild(styleElement);
  }

  styleElement.textContent = css;
}
