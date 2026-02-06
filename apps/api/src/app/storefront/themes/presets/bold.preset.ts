import { ThemeColors } from '../interfaces/theme-colors.interface';

/**
 * Bold Theme
 * High contrast design with vibrant orange and deep blue
 * Large typography, full-width sections, statement pieces
 */
export const boldPreset = {
  name: 'Bold',
  slug: 'bold',
  description: 'High-contrast design with vibrant colors and large typography. Perfect for energetic and creative brands.',
  isActive: false,
  isCustom: false,
  isPreset: true,

  // Color Scheme - High Contrast
  colors: {
    primary: '#FF6B35', // Vibrant Orange
    primaryForeground: '#FFFFFF',
    secondary: '#004E89', // Deep Blue
    secondaryForeground: '#FFFFFF',
    accent: '#F77F00', // Bright Orange
    accentForeground: '#FFFFFF',
    background: '#FFFFFF',
    foreground: '#1A1A1A',
    muted: '#F5F5F5',
    mutedForeground: '#666666',
    border: '#DDDDDD',
    input: '#F0F0F0',
    card: '#FFFFFF',
    cardForeground: '#1A1A1A',
    popover: '#FFFFFF',
    popoverForeground: '#1A1A1A',
    destructive: '#DC2626',
    destructiveForeground: '#FFFFFF',
    success: '#059669',
    successForeground: '#FFFFFF',
    warning: '#F77F00',
    warningForeground: '#FFFFFF',
    info: '#004E89',
    infoForeground: '#FFFFFF',
    ring: '#FF6B35',
    radius: '0.75rem',
  } as ThemeColors,

  // Typography - Bold and impactful
  fontFamily: '"Poppins", sans-serif',
  headingFont: '"Poppins", sans-serif',
  fontSize: 'lg',
  fontWeightBody: 500,
  fontWeightHeading: 800,

  // Layout Settings - Full-width and bold
  layoutStyle: 'wide',
  headerStyle: 'classic',
  footerStyle: 'standard',
  spacing: 'comfortable',
  containerMaxWidth: '1600px',

  // Component Styles - Bold and prominent
  buttonStyle: 'rounded',
  buttonSize: 'lg',
  cardStyle: 'shadow',
  cardRadius: 'lg',
  inputStyle: 'filled',

  // Product Display
  productGridColumns: 4,
  productImageRatio: 'square',
  showQuickView: true,
  showWishlist: true,

  // Metadata
  tags: ['bold', 'vibrant', 'high-contrast', 'energetic', 'creative'],
};
