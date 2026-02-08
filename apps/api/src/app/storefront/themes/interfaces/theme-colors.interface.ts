/**
 * Theme color palette interface
 * Defines all colors used in the storefront theme
 * WCAG 2.1 AA compliant - minimum 4.5:1 contrast for normal text, 3:1 for large text
 */
export interface ThemeColors {
  // Primary colors
  primary: string;
  primaryForeground: string;

  // Secondary colors
  secondary: string;
  secondaryForeground: string;

  // Accent colors
  accent: string;
  accentForeground: string;

  // Background colors
  background: string;
  foreground: string;

  // Muted colors
  muted: string;
  mutedForeground: string;

  // Border
  border: string;

  // Input
  input: string;

  // Card
  card: string;
  cardForeground: string;

  // Popover
  popover: string;
  popoverForeground: string;

  // Destructive (errors, danger)
  destructive: string;
  destructiveForeground: string;

  // Success
  success: string;
  successForeground: string;

  // Warning
  warning: string;
  warningForeground: string;

  // Info
  info: string;
  infoForeground: string;

  // Ring (focus outline)
  ring: string;

  // Radius (border radius values)
  radius: string;
}

/**
 * Theme color palette with light and dark mode support
 * Both modes must maintain WCAG AA contrast ratios
 */
export interface ThemeColorPalette {
  light: ThemeColors;
  dark: ThemeColors;
}

/**
 * Validates if a string is a valid hex color
 */
export function isValidHexColor(color: string): boolean {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}

/**
 * Calculate relative luminance of a color (for WCAG contrast)
 * @see https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function getRelativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;

  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((c) => {
    const sRGB = c / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate contrast ratio between two colors
 * @see https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 * @returns Contrast ratio (1:1 to 21:1)
 */
export function getContrastRatio(color1: string, color2: string): number {
  const l1 = getRelativeLuminance(color1);
  const l2 = getRelativeLuminance(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if contrast meets WCAG AA requirements
 * @param contrast - Contrast ratio
 * @param largeText - Whether text is large (18pt+ or 14pt+ bold)
 */
export function meetsWCAGAA(contrast: number, largeText = false): boolean {
  return largeText ? contrast >= 3 : contrast >= 4.5;
}

/**
 * Check if contrast meets WCAG AAA requirements
 */
export function meetsWCAGAAA(contrast: number, largeText = false): boolean {
  return largeText ? contrast >= 4.5 : contrast >= 7;
}

/**
 * Convert hex to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Validates if all colors in the palette are valid hex colors
 */
export function validateThemeColors(colors: Partial<ThemeColors>): boolean {
  const colorKeys = Object.keys(colors) as (keyof ThemeColors)[];

  for (const key of colorKeys) {
    const value = colors[key];
    if (typeof value === 'string' && value.startsWith('#')) {
      if (!isValidHexColor(value)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Validate contrast ratios for a theme color palette
 * Returns warnings for any pairs that don't meet WCAG AA
 */
export function validateThemeContrast(colors: ThemeColors): string[] {
  const warnings: string[] = [];

  // Check primary text contrast pairs
  const pairs: [keyof ThemeColors, keyof ThemeColors, string][] = [
    ['foreground', 'background', 'Body text on background'],
    ['primaryForeground', 'primary', 'Text on primary buttons'],
    ['secondaryForeground', 'secondary', 'Text on secondary buttons'],
    ['accentForeground', 'accent', 'Text on accent elements'],
    ['cardForeground', 'card', 'Text on cards'],
    ['popoverForeground', 'popover', 'Text on popovers'],
    ['mutedForeground', 'muted', 'Muted text on muted background'],
    ['destructiveForeground', 'destructive', 'Text on destructive buttons'],
    ['successForeground', 'success', 'Text on success elements'],
    ['warningForeground', 'warning', 'Text on warning elements'],
    ['infoForeground', 'info', 'Text on info elements'],
  ];

  for (const [fg, bg, label] of pairs) {
    const contrast = getContrastRatio(colors[fg], colors[bg]);
    if (!meetsWCAGAA(contrast)) {
      warnings.push(
        `${label}: contrast ratio ${contrast.toFixed(2)}:1 is below WCAG AA requirement (4.5:1)`
      );
    }
  }

  return warnings;
}

