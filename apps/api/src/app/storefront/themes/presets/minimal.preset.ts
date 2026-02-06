import { ThemeColors } from '../interfaces/theme-colors.interface';

/**
 * Minimal Theme
 * Ultra-minimal monochrome design with typography focus
 * Clean, centered layout with black, white, and gray palette
 */
export const minimalPreset = {
  name: 'Minimal',
  slug: 'minimal',
  description: 'Ultra-minimal monochrome design focused on typography and whitespace. Perfect for luxury and artistic brands.',
  isActive: false,
  isCustom: false,
  isPreset: true,

  // Color Scheme - Monochrome
  colors: {
    primary: '#000000', // Black
    primaryForeground: '#FFFFFF',
    secondary: '#4B5563', // Gray
    secondaryForeground: '#FFFFFF',
    accent: '#6B7280', // Medium Gray
    accentForeground: '#FFFFFF',
    background: '#FFFFFF',
    foreground: '#000000',
    muted: '#F9FAFB',
    mutedForeground: '#6B7280',
    border: '#E5E7EB',
    input: '#F3F4F6',
    card: '#FFFFFF',
    cardForeground: '#000000',
    popover: '#FFFFFF',
    popoverForeground: '#000000',
    destructive: '#1F2937',
    destructiveForeground: '#FFFFFF',
    success: '#374151',
    successForeground: '#FFFFFF',
    warning: '#6B7280',
    warningForeground: '#FFFFFF',
    info: '#4B5563',
    infoForeground: '#FFFFFF',
    ring: '#000000',
    radius: '0.25rem',
  } as ThemeColors,

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
