# NoSlag Theme Engine

Complete frontend infrastructure for dynamic theming in the NoSlag platform.

## Features

- **Dynamic Theme Loading**: Load themes from API with caching
- **CSS Variable System**: Instant theme updates via CSS custom properties
- **Font Management**: Dynamic Google Fonts loading
- **Smooth Transitions**: Fade effects when switching themes
- **Performance Optimized**: localStorage caching, debouncing, lazy loading
- **TypeScript**: Fully typed for excellent DX
- **FOUC Prevention**: No flash of unstyled content
- **SSR Compatible**: Works with Next.js server rendering

## Quick Start

### 1. Wrap your app with ThemeProvider

```tsx
import { ThemeProvider } from '@/lib/theme';

function App() {
  return (
    <ThemeProvider tenantId="your-tenant-id">
      <YourApp />
    </ThemeProvider>
  );
}
```

### 2. Use theme hooks in components

```tsx
import { useTheme, useThemeColor } from '@/lib/theme';

function MyComponent() {
  const { theme, loading, error } = useTheme();
  const primaryColor = useThemeColor('primary');

  if (loading) return <div>Loading theme...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div style={{ color: primaryColor }}>
      <h1>{theme.name}</h1>
    </div>
  );
}
```

## API Reference

### Providers

#### ThemeProvider

Main theme provider that loads and applies themes.

```tsx
<ThemeProvider
  tenantId="tenant-123"
  enableTransitions={true}
  transitionDuration={300}
  cacheEnabled={true}
>
  {children}
</ThemeProvider>
```

**Props:**
- `tenantId` (required): Tenant identifier
- `enableTransitions`: Enable smooth theme switching (default: true)
- `transitionDuration`: Transition duration in ms (default: 300)
- `cacheEnabled`: Enable localStorage caching (default: true)

### Hooks

#### useTheme()

Access full theme context.

```tsx
const { theme, loading, error, refreshTheme } = useTheme();
```

#### useThemeColor(colorKey)

Get a specific color from the theme.

```tsx
const primaryColor = useThemeColor('primary');
const backgroundColor = useThemeColor('background');
```

#### useThemeFont()

Get font configuration.

```tsx
const { body, heading } = useThemeFont();
```

#### useThemeLayout()

Get layout configuration.

```tsx
const { layoutStyle, spacing, borderRadius } = useThemeLayout();
```

#### useComponentStyles()

Get component style preferences.

```tsx
const { buttonStyle, cardStyle, cardShadow } = useComponentStyles();
```

#### Utility Hooks

- `useThemeLoading()`: Check if theme is loading
- `useThemeError()`: Get theme error if any
- `useThemeReady()`: Check if theme is ready
- `useThemeId()`: Get current theme ID
- `useThemeName()`: Get current theme name
- `useIsDarkTheme()`: Check if theme is dark
- `usePrimaryColor()`: Get primary color
- `useBackgroundColor()`: Get background color
- `useForegroundColor()`: Get foreground color
- `useSpacing()`: Get spacing value
- `useBorderRadius()`: Get border radius value

### Components

#### FontLoader

Dynamically loads Google Fonts.

```tsx
<FontLoader fonts={['Inter', 'Poppins']} />
```

#### ThemeLoadingSkeleton

Shows loading state while theme loads.

```tsx
{loading && <ThemeLoadingSkeleton />}
```

#### PreventFOUC

Prevents flash of unstyled content.

```tsx
<PreventFOUC>
  <YourContent />
</PreventFOUC>
```

### Engine Functions

#### applyTheme(theme)

Manually apply a theme.

```tsx
import { applyTheme } from '@/lib/theme';

await applyTheme(myTheme);
```

#### removeTheme()

Remove all theme styles.

```tsx
import { removeTheme } from '@/lib/theme';

removeTheme();
```

### API Client

#### themesApi

Complete API client for theme management.

```tsx
import { themesApi } from '@/lib/api/themes';

// Get active theme
const theme = await themesApi.getActiveTheme(tenantId);

// Get all themes
const themes = await themesApi.getThemes(tenantId);

// Create theme
const newTheme = await themesApi.createTheme(tenantId, {
  name: 'My Theme',
  colors: { primary: '#ff0000' }
});

// Update theme
await themesApi.updateTheme(themeId, tenantId, {
  colors: { primary: '#00ff00' }
});

// Activate theme
await themesApi.activateTheme(themeId, tenantId);

// Delete theme
await themesApi.deleteTheme(themeId, tenantId);
```

## CSS Variables

The theme engine automatically creates CSS variables that you can use:

```css
/* Colors */
--primary: 220 100% 50%;
--secondary: 280 100% 50%;
--accent: 330 100% 50%;
--background: 0 0% 100%;
--foreground: 0 0% 0%;
--card: 0 0% 100%;
--card-foreground: 0 0% 0%;
--border: 0 0% 90%;
--muted: 0 0% 96%;
--success: 142 71% 45%;
--error: 0 84% 60%;

/* Typography */
--font-family: 'Inter', sans-serif;
--font-heading: 'Poppins', sans-serif;
--font-size-base: 16px;

/* Layout */
--layout-max-width: 1280px;
--spacing: 1rem;
--radius: 0.375rem;
--button-radius: 0.5rem;
--card-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
```

### Using CSS Variables

```css
.my-component {
  background: hsl(var(--primary));
  color: hsl(var(--foreground));
  font-family: var(--font-family);
  border-radius: var(--radius);
  padding: var(--spacing);
}
```

## Performance

### Caching

Themes are cached in localStorage for instant loading:

```tsx
import { getCachedTheme, cacheTheme, clearThemeCache } from '@/lib/theme';

// Get cached theme
const cached = getCachedTheme(tenantId);

// Cache theme
cacheTheme(tenantId, theme);

// Clear cache
clearThemeCache(tenantId);
```

### Preloading

Preload themes for instant switching:

```tsx
import { preloadTheme } from '@/lib/theme';

preloadTheme(nextTheme);
```

## Type Safety

All theme properties are fully typed:

```tsx
import type { Theme, ThemeColors, CreateThemeDto } from '@/lib/theme';

const colors: ThemeColors = {
  primary: '#0070f3',
  secondary: '#7928ca',
  // ... all 22 colors
};

const theme: Theme = {
  id: '123',
  name: 'My Theme',
  colors,
  // ... all properties with autocomplete
};
```

## Examples

### Basic Usage

```tsx
'use client';

import { useTheme, useThemeColor } from '@/lib/theme';

export function ThemedButton() {
  const { theme } = useTheme();
  const primaryColor = useThemeColor('primary');

  return (
    <button
      style={{
        backgroundColor: primaryColor,
        fontFamily: theme?.fontFamily,
        borderRadius: theme?.borderRadius === 'lg' ? '0.5rem' : '0.375rem',
      }}
    >
      Themed Button
    </button>
  );
}
```

### Theme Switcher

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/lib/theme';
import { themesApi } from '@/lib/api/themes';

export function ThemeSwitcher({ tenantId }: { tenantId: string }) {
  const { theme: activeTheme, refreshTheme } = useTheme();
  const [themes, setThemes] = useState([]);

  useEffect(() => {
    themesApi.getThemes(tenantId).then(setThemes);
  }, [tenantId]);

  const handleThemeChange = async (themeId: string) => {
    await themesApi.activateTheme(themeId, tenantId);
    await refreshTheme();
  };

  return (
    <select
      value={activeTheme?.id}
      onChange={(e) => handleThemeChange(e.target.value)}
    >
      {themes.map((theme) => (
        <option key={theme.id} value={theme.id}>
          {theme.name}
        </option>
      ))}
    </select>
  );
}
```

### Custom Theme Editor

```tsx
'use client';

import { useState } from 'react';
import { useTheme } from '@/lib/theme';
import { themesApi } from '@/lib/api/themes';

export function ThemeEditor({ tenantId }: { tenantId: string }) {
  const { theme, refreshTheme } = useTheme();
  const [primaryColor, setPrimaryColor] = useState(theme?.colors.primary);

  const handleSave = async () => {
    if (!theme) return;

    await themesApi.updateTheme(theme.id, tenantId, {
      colors: {
        ...theme.colors,
        primary: primaryColor,
      },
    });

    await refreshTheme();
  };

  return (
    <div>
      <label>
        Primary Color:
        <input
          type="color"
          value={primaryColor}
          onChange={(e) => setPrimaryColor(e.target.value)}
        />
      </label>
      <button onClick={handleSave}>Save Theme</button>
    </div>
  );
}
```

## Best Practices

1. **Always wrap with ThemeProvider** at the app root
2. **Use hooks instead of context directly** for better DX
3. **Enable caching** for production
4. **Handle loading states** for better UX
5. **Use CSS variables** for dynamic styling
6. **Preload themes** when showing theme picker
7. **Validate themes** before applying
8. **Test with multiple themes** during development

## Troubleshooting

### Theme not loading

- Check that tenant ID is correct
- Verify API endpoint is accessible
- Check browser console for errors
- Try clearing cache: `clearThemeCache(tenantId)`

### Fonts not loading

- Check font names are correct
- Verify Google Fonts API is accessible
- Check browser console for CORS errors

### Flash of unstyled content

- Use `PreventFOUC` component
- Enable caching for faster loads
- Consider SSR theme injection

### Theme changes not applying

- Call `refreshTheme()` after API updates
- Check that theme is valid
- Verify CSS variables are being set

## License

MIT
