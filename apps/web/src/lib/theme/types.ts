/**
 * Theme System Type Definitions
 * Matches backend schema for NoSlag theme engine
 */

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  input: string;
  ring: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
}

export interface TypographyConfig {
  fontFamily: string;
  headingFont?: string;
  fontSize: 'sm' | 'base' | 'lg';
  fontWeightNormal?: number;
  fontWeightBold?: number;
  lineHeight?: number;
  letterSpacing?: number;
}

export interface LayoutConfig {
  layoutStyle: 'standard' | 'wide' | 'boxed';
  spacing: 'compact' | 'normal' | 'relaxed';
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  maxWidth?: number;
  headerHeight?: number;
  footerHeight?: number;
}

export interface ComponentStyles {
  buttonStyle?: 'solid' | 'outline' | 'ghost' | 'gradient';
  buttonRounding?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  inputStyle?: 'outlined' | 'filled' | 'underlined';
  cardStyle?: 'flat' | 'elevated' | 'outlined';
  cardShadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  navStyle?: 'pills' | 'underline' | 'filled';
}

export interface Theme {
  id: string;
  name: string;
  slug: string;
  tenantId: string;
  isActive: boolean;
  colors: ThemeColors;
  fontFamily: string;
  headingFont?: string;
  fontSize: 'sm' | 'base' | 'lg';
  layoutStyle: 'standard' | 'wide' | 'boxed';
  spacing: 'compact' | 'normal' | 'relaxed';
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  buttonStyle?: 'solid' | 'outline' | 'ghost' | 'gradient';
  buttonRounding?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  inputStyle?: 'outlined' | 'filled' | 'underlined';
  cardStyle?: 'flat' | 'elevated' | 'outlined';
  cardShadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  navStyle?: 'pills' | 'underline' | 'filled';
  customCSS?: string;
  isPreset: boolean;
  presetType?: 'modern' | 'elegant' | 'bold' | 'minimal';
  createdAt: string;
  updatedAt: string;
}

export interface CreateThemeDto {
  name: string;
  slug?: string;
  colors?: Partial<ThemeColors>;
  fontFamily?: string;
  headingFont?: string;
  fontSize?: 'sm' | 'base' | 'lg';
  layoutStyle?: 'standard' | 'wide' | 'boxed';
  spacing?: 'compact' | 'normal' | 'relaxed';
  borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  buttonStyle?: 'solid' | 'outline' | 'ghost' | 'gradient';
  buttonRounding?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  inputStyle?: 'outlined' | 'filled' | 'underlined';
  cardStyle?: 'flat' | 'elevated' | 'outlined';
  cardShadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  navStyle?: 'pills' | 'underline' | 'filled';
  customCSS?: string;
}

export interface UpdateThemeDto extends Partial<CreateThemeDto> {}

export interface ThemePreset {
  id: string;
  name: string;
  slug: string;
  type: 'modern' | 'elegant' | 'bold' | 'minimal';
  description: string;
  preview?: string;
  theme: Omit<Theme, 'id' | 'tenantId' | 'isActive' | 'createdAt' | 'updatedAt'>;
}

export interface ThemeContextValue {
  theme: Theme | null;
  loading: boolean;
  error: string | null;
  refreshTheme: () => Promise<void>;
}

export interface FontLoadState {
  loading: boolean;
  loaded: boolean;
  error: string | null;
}

export type ColorFormat = 'hex' | 'rgb' | 'hsl';

export interface HSLColor {
  h: number;
  s: number;
  l: number;
}

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}
