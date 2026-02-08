import { ThemeColors, ThemeColorPalette } from '../interfaces/theme-colors.interface';

/**
 * Minimal Theme
 * Ultra-minimal monochrome design with typography focus
 * Clean, centered layout with black, white, and gray palette
 * 
 * WCAG 2.1 AA Compliant:
 * - Monochrome design with maximum contrast
 * - Clean borders and subtle backgrounds that don't interfere
 */

// Light mode - crisp black on white
const minimalLightColors: ThemeColors = {
  primary: '#171717', // Neutral-900 - 18.1:1 on white
  primaryForeground: '#FFFFFF',
  secondary: '#404040', // Neutral-700 - 9.03:1 on white
  secondaryForeground: '#FFFFFF',
  accent: '#525252', // Neutral-600 - 7.0:1 on white
  accentForeground: '#FFFFFF',
  background: '#FFFFFF',
  foreground: '#0A0A0A', // Neutral-950 - 19.6:1 on white
  muted: '#FAFAFA', // Neutral-50
  mutedForeground: '#525252', // Neutral-600 - 7.0:1 on neutral-50
  border: '#E5E5E5', // Neutral-200
  input: '#F5F5F5',
  card: '#FFFFFF',
  cardForeground: '#0A0A0A',
  popover: '#FFFFFF',
  popoverForeground: '#0A0A0A',
  destructive: '#171717', // Keep monochrome aesthetic
  destructiveForeground: '#FFFFFF',
  success: '#262626', // Neutral-800
  successForeground: '#FFFFFF',
  warning: '#404040', // Neutral-700
  warningForeground: '#FFFFFF',
  info: '#525252', // Neutral-600
  infoForeground: '#FFFFFF',
  ring: '#171717',
  radius: '0.25rem',
};

// Dark mode - crisp white on black
const minimalDarkColors: ThemeColors = {
  primary: '#FAFAFA', // Neutral-50 - 19.6:1 on neutral-950
  primaryForeground: '#0A0A0A',
  secondary: '#D4D4D4', // Neutral-300 - 12.6:1 on neutral-950
  secondaryForeground: '#0A0A0A',
  accent: '#A3A3A3', // Neutral-400 - 7.73:1 on neutral-950
  accentForeground: '#0A0A0A',
  background: '#0A0A0A', // Neutral-950
  foreground: '#FAFAFA', // Neutral-50 - 19.6:1 on neutral-950
  muted: '#171717', // Neutral-900
  mutedForeground: '#A3A3A3', // Neutral-400 - 5.32:1 on neutral-900
  border: '#262626', // Neutral-800
  input: '#171717',
  card: '#171717',
  cardForeground: '#FAFAFA',
  popover: '#171717',
  popoverForeground: '#FAFAFA',
  destructive: '#FAFAFA',
  destructiveForeground: '#0A0A0A',
  success: '#E5E5E5', // Neutral-200
  successForeground: '#0A0A0A',
  warning: '#D4D4D4', // Neutral-300
  warningForeground: '#0A0A0A',
  info: '#A3A3A3', // Neutral-400
  infoForeground: '#0A0A0A',
  ring: '#FAFAFA',
  radius: '0.25rem',
};

export const minimalColorPalette: ThemeColorPalette = {
  light: minimalLightColors,
  dark: minimalDarkColors,
};

export const minimalPreset = {
  name: 'Minimal',
  slug: 'minimal',
  description: 'Ultra-minimal monochrome design focused on typography and whitespace. Perfect for luxury and artistic brands.',
  isActive: false,
  isCustom: false,
  isPreset: true,

  // Color Scheme - Monochrome (light mode default)
  colors: minimalLightColors,
  
  // Dark mode colors
  darkColors: minimalDarkColors,

  // Typography - Clean sans-serif
  fontFamily: '"Helvetica Neue", -apple-system, sans-serif',
  headingFont: '"Helvetica Neue", -apple-system, sans-serif',
  fontSize: 'base',
  fontWeightBody: 400,
  fontWeightHeading: 600,

  // Layout Settings - Centered and clean
  layoutStyle: 'standard',
  headerStyle: 'centered',
  footerStyle: 'minimal',
  spacing: 'spacious',
  containerMaxWidth: '1200px',

  // Component Styles - Minimal aesthetic
  buttonStyle: 'square',
  buttonSize: 'md',
  cardStyle: 'border',
  cardRadius: 'sm',
  inputStyle: 'outlined',

  // Product Display
  productGridColumns: 2,
  productImageRatio: 'portrait',
  showQuickView: false,
  showWishlist: true,

  // Metadata
  tags: ['minimal', 'monochrome', 'clean', 'luxury', 'typography'],
};
