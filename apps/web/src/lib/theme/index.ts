/**
 * Theme System - Main Export
 * Centralized exports for the NoSlag theme engine
 */

// Provider and Context
export { ThemeProvider, ServerThemeProvider, ThemeContext } from './theme-provider';

// Hooks
export {
  useTheme,
  useThemeColor,
  useThemeColors,
  useThemeFont,
  useThemeLayout,
  useTypography,
  useComponentStyles,
  useThemeLoading,
  useThemeError,
  useThemeReady,
  useCSSVariable,
  useThemePreset,
  useIsPresetTheme,
  useThemeId,
  useThemeName,
  usePrimaryColor,
  useBackgroundColor,
  useForegroundColor,
  useRefreshTheme,
  useSpacing,
  useBorderRadius,
  useIsDarkTheme,
} from './use-theme';

// Components
export { FontLoader, FontPreloader, useFontLoader } from './font-loader';
export { ThemeStyles } from './theme-styles';

// Loading Components
export {
  ThemeLoadingSkeleton,
  ThemeErrorFallback,
  ThemeTransitionOverlay,
  ThemeReadyGuard,
  PreventFOUC,
  ThemeSwitchAnimation,
  ThemeLoadingProgress,
  MinimalThemeLoader,
} from './theme-loading';

// Engine Functions
export {
  applyTheme,
  removeTheme,
  applyThemeColors,
  loadThemeFonts,
  applyLayoutStyles,
  applyTypographyStyles,
  applyComponentStyles,
  generateThemeCSS,
  injectThemeCSS,
  applyCustomCSS,
  createThemeTransition,
  preloadTheme,
} from './theme-engine';

// Utility Functions
export {
  hexToHSL,
  hexToRGB,
  hslToString,
  getLuminance,
  getContrastColor,
  validateTheme,
  mergeThemes,
  getDefaultColors,
  themeToCSS,
  generateThemePreview,
  extractFontFamilies,
  formatGoogleFontUrl,
  debounce,
  isBrowser,
  storage,
  getThemeCacheKey,
  getCachedTheme,
  cacheTheme,
  clearThemeCache,
} from './theme-utils';

// Types
export type {
  Theme,
  ThemeColors,
  TypographyConfig,
  LayoutConfig,
  ComponentStyles,
  CreateThemeDto,
  UpdateThemeDto,
  ThemePreset,
  ThemeContextValue,
  FontLoadState,
  ColorFormat,
  HSLColor,
  RGBColor,
} from './types';
