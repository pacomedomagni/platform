import { ThemeColors } from '../interfaces/theme-colors.interface';

/**
 * Classic Theme
 * Traditional design with navy, gold, and cream
 * Serif fonts for headings, elegant and timeless
 */
export const classicPreset = {
  name: 'Classic',
  slug: 'classic',
  description: 'Traditional and elegant design with serif typography and refined colors. Perfect for heritage and professional brands.',
  isActive: false,
  isCustom: false,
  isPreset: true,

  // Color Scheme - Traditional and elegant
  colors: {
    primary: '#1E3A8A', // Navy Blue
    primaryForeground: '#FFFFFF',
    secondary: '#F59E0B', // Gold
    secondaryForeground: '#1A1A1A',
    accent: '#FEF3C7', // Cream
    accentForeground: '#1A1A1A',
    background: '#FEFEFE',
    foreground: '#1F2937',
    muted: '#F9FAFB',
    mutedForeground: '#6B7280',
    border: '#D1D5DB',
    input: '#F3F4F6',
    card: '#FFFFFF',
    cardForeground: '#1F2937',
    popover: '#FFFFFF',
    popoverForeground: '#1F2937',
    destructive: '#991B1B',
    destructiveForeground: '#FFFFFF',
    success: '#047857',
    successForeground: '#FFFFFF',
    warning: '#B45309',
    warningForeground: '#FFFFFF',
    info: '#1E40AF',
    infoForeground: '#FFFFFF',
    ring: '#1E3A8A',
    radius: '0.375rem',
  } as ThemeColors,

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
