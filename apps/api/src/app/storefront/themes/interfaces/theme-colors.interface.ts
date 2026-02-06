/**
 * Theme color palette interface
 * Defines all colors used in the storefront theme
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
 * Validates if a string is a valid hex color
 */
export function isValidHexColor(color: string): boolean {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
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
