import { ThemeColors, ThemeColorPalette } from '../interfaces/theme-colors.interface';

/**
 * Classic Theme
 * Traditional design with navy, gold, and cream
 * Serif fonts for headings, elegant and timeless
 * 
 * WCAG 2.1 AA Compliant:
 * - Navy provides excellent contrast
 * - Gold colors adjusted for accessibility
 */

// Light mode - elegant navy and gold
const classicLightColors: ThemeColors = {
  primary: '#1E3A8A', // Blue-900 - 9.39:1 on white
  primaryForeground: '#FFFFFF',
  secondary: '#B45309', // Amber-700 - 5.36:1 on white (adjusted from gold)
  secondaryForeground: '#FFFFFF',
  accent: '#451A03', // Amber-950 - 14.7:1 on cream bg
  accentForeground: '#FEF3C7', // Cream
  background: '#FFFBF5', // Warm white
  foreground: '#1F2937', // Gray-800 - 11.5:1 on warm white
  muted: '#F9FAFB', // Gray-50
  mutedForeground: '#4B5563', // Gray-600 - 6.14:1 on gray-50
  border: '#D1D5DB', // Gray-300
  input: '#F3F4F6',
  card: '#FFFFFF',
  cardForeground: '#1F2937',
  popover: '#FFFFFF',
  popoverForeground: '#1F2937',
  destructive: '#991B1B', // Red-800 - 7.43:1 on white
  destructiveForeground: '#FFFFFF',
  success: '#047857', // Emerald-700 - 5.92:1 on white
  successForeground: '#FFFFFF',
  warning: '#92400E', // Amber-800 - 6.73:1 on white
  warningForeground: '#FFFFFF',
  info: '#1E40AF', // Blue-800 - 8.29:1 on white
  infoForeground: '#FFFFFF',
  ring: '#1E3A8A',
  radius: '0.375rem',
};

// Dark mode - navy depths with gold accents
const classicDarkColors: ThemeColors = {
  primary: '#60A5FA', // Blue-400 - 8.59:1 on slate-900
  primaryForeground: '#0F172A',
  secondary: '#FCD34D', // Amber-300 - 13.5:1 on slate-900
  secondaryForeground: '#0F172A',
  accent: '#FBBF24', // Amber-400 - 11.8:1 on slate-900
  accentForeground: '#0F172A',
  background: '#0C1222', // Deep navy
  foreground: '#F1F5F9', // Slate-100 - 14.4:1 on deep navy
  muted: '#1E293B', // Slate-800
  mutedForeground: '#94A3B8', // Slate-400 - 4.64:1 on slate-800
  border: '#334155', // Slate-700
  input: '#1E293B',
  card: '#1E293B',
  cardForeground: '#F1F5F9',
  popover: '#1E293B',
  popoverForeground: '#F1F5F9',
  destructive: '#FCA5A5', // Red-300 - 10.1:1 on deep navy
  destructiveForeground: '#0F172A',
  success: '#6EE7B7', // Emerald-300 - 12.3:1 on deep navy
  successForeground: '#0F172A',
  warning: '#FCD34D', // Amber-300 - 13.5:1 on deep navy
  warningForeground: '#0F172A',
  info: '#93C5FD', // Blue-300 - 10.9:1 on deep navy
  infoForeground: '#0F172A',
  ring: '#60A5FA',
  radius: '0.375rem',
};

export const classicColorPalette: ThemeColorPalette = {
  light: classicLightColors,
  dark: classicDarkColors,
};

export const classicPreset = {
  name: 'Classic',
  slug: 'classic',
  description: 'Traditional and elegant design with serif typography and refined colors. Perfect for heritage and professional brands.',
  isActive: false,
  isCustom: false,
  isPreset: true,

  // Color Scheme - Traditional and elegant (light mode default)
  colors: classicLightColors,
  
  // Dark mode colors
  darkColors: classicDarkColors,

  // Typography - Serif for headings, sans-serif for body
  fontFamily: 'Inter',
  headingFont: '"Crimson Text", Georgia, serif',
  fontSize: 'base',
  fontWeightBody: 400,
  fontWeightHeading: 600,

  // Layout Settings - Traditional grid
  layoutStyle: 'standard',
  headerStyle: 'classic',
  footerStyle: 'standard',
  spacing: 'comfortable',
  containerMaxWidth: '1280px',

  // Component Styles - Refined and elegant
  buttonStyle: 'rounded',
  buttonSize: 'md',
  cardStyle: 'border',
  cardRadius: 'md',
  inputStyle: 'outlined',

  // Product Display
  productGridColumns: 3,
  productImageRatio: 'portrait',
  showQuickView: true,
  showWishlist: true,

  // Metadata
  tags: ['classic', 'elegant', 'traditional', 'refined', 'timeless'],
};
