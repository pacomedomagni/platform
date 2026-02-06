import { ThemeColors } from '../interfaces/theme-colors.interface';

/**
 * Modern Theme - Default
 * Contemporary design with indigo primary, blue secondary, and amber accent
 * Features gradients and a spacious, wide layout
 */
export const modernPreset = {
  name: 'Modern',
  slug: 'modern',
  description: 'Contemporary design with vibrant colors and spacious layout. Perfect for tech and lifestyle brands.',
  isActive: false,
  isCustom: false,
  isPreset: true,

  // Color Scheme
  colors: {
    primary: '#4F46E5', // Indigo
    primaryForeground: '#FFFFFF',
    secondary: '#3B82F6', // Blue
    secondaryForeground: '#FFFFFF',
    accent: '#F59E0B', // Amber
    accentForeground: '#000000',
    background: '#FFFFFF',
    foreground: '#0F172A',
    muted: '#F1F5F9',
    mutedForeground: '#64748B',
    border: '#E2E8F0',
    input: '#E2E8F0',
    card: '#FFFFFF',
    cardForeground: '#0F172A',
    popover: '#FFFFFF',
    popoverForeground: '#0F172A',
    destructive: '#EF4444',
    destructiveForeground: '#FFFFFF',
    success: '#10B981',
    successForeground: '#FFFFFF',
    warning: '#F59E0B',
    warningForeground: '#000000',
    info: '#3B82F6',
    infoForeground: '#FFFFFF',
    ring: '#4F46E5',
    radius: '0.5rem',
  } as ThemeColors,

  // Typography
  fontFamily: 'Inter',
  headingFont: 'Inter',
  fontSize: 'base',
  fontWeightBody: 400,
  fontWeightHeading: 700,

  // Layout Settings
  layoutStyle: 'wide',
  headerStyle: 'classic',
  footerStyle: 'standard',
  spacing: 'spacious',
  containerMaxWidth: '1440px',

  // Component Styles
  buttonStyle: 'rounded',
  buttonSize: 'md',
  cardStyle: 'shadow',
  cardRadius: 'lg',
  inputStyle: 'outlined',

  // Product Display
  productGridColumns: 3,
  productImageRatio: 'square',
  showQuickView: true,
  showWishlist: true,

  // Metadata
  tags: ['modern', 'contemporary', 'vibrant', 'spacious'],
};
