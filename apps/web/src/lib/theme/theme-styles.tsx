/**
 * ThemeStyles - Dynamic style injection for theme customization
 * Injects font families, sizes, and spacing values into CSS custom properties
 */
'use client';

import { useTheme, useThemeFont, useThemeLayout } from '@/lib/theme';

export function ThemeStyles() {
  const { theme } = useTheme();
  const { body: fontFamily, heading: headingFont } = useThemeFont();
  const { spacing } = useThemeLayout();

  if (!theme) return null;

  const fontSize = theme.fontSize;

  const spacingMap = {
    compact: '0.75rem',
    comfortable: '1rem',
    spacious: '1.5rem',
  };

  const fontSizeMap = {
    sm: '14px',
    base: '16px',
    lg: '18px',
  };

  return (
    <style jsx global>{`
      :root {
        --font-body: ${fontFamily}, sans-serif;
        --font-heading: ${headingFont || fontFamily}, sans-serif;
        --font-size-base: ${fontSizeMap[fontSize as keyof typeof fontSizeMap] || '16px'};
        --spacing-base: ${spacingMap[spacing as keyof typeof spacingMap] || '1rem'};
      }

      body {
        font-family: var(--font-body);
        font-size: var(--font-size-base);
      }

      h1, h2, h3, h4, h5, h6 {
        font-family: var(--font-heading);
      }
    `}</style>
  );
}
