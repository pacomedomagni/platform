# Theme System Integration Guide

Complete guide for integrating the NoSlag theme system into your application.

## Table of Contents

1. [Initial Setup](#initial-setup)
2. [Layout Integration](#layout-integration)
3. [Component Integration](#component-integration)
4. [API Integration](#api-integration)
5. [Advanced Usage](#advanced-usage)
6. [Testing](#testing)

## Initial Setup

### 1. Install Dependencies

The theme system is already included in the platform. No additional dependencies needed.

### 2. Environment Variables

Add to your `.env.local`:

```env
NEXT_PUBLIC_TENANT_ID=your-tenant-id
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### 3. Wrap Your App

In your root layout or app provider:

```tsx
// apps/web/src/app/layout.tsx
import { ThemeProvider } from '@/lib/theme';

export default function RootLayout({ children }) {
  const tenantId = process.env.NEXT_PUBLIC_TENANT_ID || 'default';

  return (
    <html lang="en">
      <body>
        <ThemeProvider tenantId={tenantId}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

## Layout Integration

### Storefront Layout

Already integrated in `/apps/web/src/app/storefront/_components/store-providers.tsx`:

```tsx
import { ThemeProvider } from '../../../lib/theme';
import { FontLoader } from '../../../lib/theme/font-loader';

export function StoreProviders({ children }: { children: React.ReactNode }) {
  const tenantId = getTenantId();

  return (
    <ThemeProvider tenantId={tenantId}>
      <FontLoader fonts={['Inter', 'Poppins']} />
      {children}
    </ThemeProvider>
  );
}
```

### Admin Layout

For the admin dashboard:

```tsx
// apps/web/src/app/app/layout.tsx
import { ThemeProvider } from '@/lib/theme';

export default function AdminLayout({ children }) {
  return (
    <ThemeProvider tenantId={getUserTenantId()}>
      {children}
    </ThemeProvider>
  );
}
```

## Component Integration

### Basic Component with Theme

```tsx
'use client';

import { useTheme, useThemeColor } from '@/lib/theme';

export function ProductCard({ product }) {
  const { theme } = useTheme();
  const primaryColor = useThemeColor('primary');
  const cardColor = useThemeColor('card');

  return (
    <div
      style={{
        backgroundColor: cardColor,
        borderRadius: theme?.borderRadius === 'lg' ? '0.5rem' : '0.375rem',
        padding: '1rem',
      }}
    >
      <h3 style={{ color: primaryColor }}>{product.name}</h3>
      <p style={{ fontFamily: theme?.fontFamily }}>{product.description}</p>
    </div>
  );
}
```

### Using CSS Variables

```tsx
// Recommended approach: Use CSS variables
export function ProductCard({ product }) {
  return (
    <div className="product-card">
      <h3>{product.name}</h3>
      <p>{product.description}</p>
    </div>
  );
}

// styles.css
.product-card {
  background-color: hsl(var(--card));
  color: hsl(var(--card-foreground));
  border-radius: var(--radius);
  padding: var(--spacing);
  font-family: var(--font-family);
}

.product-card h3 {
  color: hsl(var(--primary));
  font-family: var(--font-heading);
}
```

### Conditional Rendering Based on Theme

```tsx
'use client';

import { useIsDarkTheme, useThemePreset } from '@/lib/theme';

export function AdaptiveComponent() {
  const isDark = useIsDarkTheme();
  const presetType = useThemePreset();

  return (
    <div>
      {isDark && <DarkModeIcon />}
      {presetType === 'elegant' && <ElegantDecoration />}
    </div>
  );
}
```

## API Integration

### Fetching Themes

```tsx
'use client';

import { useState, useEffect } from 'react';
import { themesApi } from '@/lib/api/themes';
import type { Theme } from '@/lib/theme';

export function ThemeList({ tenantId }: { tenantId: string }) {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    themesApi
      .getThemes(tenantId)
      .then(setThemes)
      .finally(() => setLoading(false));
  }, [tenantId]);

  if (loading) return <div>Loading themes...</div>;

  return (
    <ul>
      {themes.map((theme) => (
        <li key={theme.id}>{theme.name}</li>
      ))}
    </ul>
  );
}
```

### Creating a Theme

```tsx
'use client';

import { useState } from 'react';
import { themesApi } from '@/lib/api/themes';
import { useRefreshTheme } from '@/lib/theme';

export function ThemeCreator({ tenantId }: { tenantId: string }) {
  const [name, setName] = useState('');
  const refreshTheme = useRefreshTheme();

  const handleCreate = async () => {
    const newTheme = await themesApi.createTheme(tenantId, {
      name,
      colors: {
        primary: '#0070f3',
        // ... other colors
      },
    });

    // Optionally activate the new theme
    await themesApi.activateTheme(newTheme.id, tenantId);
    await refreshTheme();
  };

  return (
    <div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Theme name"
      />
      <button onClick={handleCreate}>Create Theme</button>
    </div>
  );
}
```

### Theme Switcher

```tsx
'use client';

import { useState, useEffect } from 'react';
import { themesApi } from '@/lib/api/themes';
import { useTheme } from '@/lib/theme';

export function ThemeSwitcher({ tenantId }: { tenantId: string }) {
  const { theme: activeTheme, refreshTheme } = useTheme();
  const [themes, setThemes] = useState([]);

  useEffect(() => {
    themesApi.getThemes(tenantId).then(setThemes);
  }, [tenantId]);

  const handleSwitch = async (themeId: string) => {
    await themesApi.activateTheme(themeId, tenantId);
    await refreshTheme();
  };

  return (
    <select
      value={activeTheme?.id}
      onChange={(e) => handleSwitch(e.target.value)}
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

## Advanced Usage

### Server-Side Theme Loading

For better performance, load theme on server:

```tsx
// app/page.tsx
import { themesApi } from '@/lib/api/themes';
import { ServerThemeProvider } from '@/lib/theme';

export default async function Page() {
  const theme = await themesApi.getActiveTheme('tenant-id');

  return (
    <ServerThemeProvider theme={theme}>
      <YourContent />
    </ServerThemeProvider>
  );
}
```

### Theme Preloading

Preload themes for instant switching:

```tsx
'use client';

import { useEffect } from 'react';
import { preloadTheme } from '@/lib/theme';
import { themesApi } from '@/lib/api/themes';

export function ThemePreloader({ tenantId }: { tenantId: string }) {
  useEffect(() => {
    // Preload all themes for instant switching
    themesApi.getThemes(tenantId).then((themes) => {
      themes.forEach((theme) => {
        preloadTheme(theme);
      });
    });
  }, [tenantId]);

  return null;
}
```

### Custom Theme Hook

Create a custom hook for your specific needs:

```tsx
import { useTheme, useThemeColor } from '@/lib/theme';

export function useProductCardTheme() {
  const { theme } = useTheme();
  const cardColor = useThemeColor('card');
  const primaryColor = useThemeColor('primary');
  const borderRadius = theme?.borderRadius || 'md';

  return {
    cardStyle: {
      backgroundColor: cardColor,
      borderRadius: borderRadius === 'lg' ? '0.5rem' : '0.375rem',
    },
    titleStyle: {
      color: primaryColor,
      fontFamily: theme?.headingFont || theme?.fontFamily,
    },
    bodyStyle: {
      fontFamily: theme?.fontFamily,
    },
  };
}

// Usage
export function ProductCard({ product }) {
  const { cardStyle, titleStyle, bodyStyle } = useProductCardTheme();

  return (
    <div style={cardStyle}>
      <h3 style={titleStyle}>{product.name}</h3>
      <p style={bodyStyle}>{product.description}</p>
    </div>
  );
}
```

### Theme Editor Component

Full-featured theme editor:

```tsx
'use client';

import { useState } from 'react';
import { useTheme } from '@/lib/theme';
import { themesApi } from '@/lib/api/themes';

export function ThemeEditor({ tenantId }: { tenantId: string }) {
  const { theme, refreshTheme } = useTheme();
  const [colors, setColors] = useState(theme?.colors);

  const handleColorChange = (key: string, value: string) => {
    setColors((prev) => ({ ...prev!, [key]: value }));
  };

  const handleSave = async () => {
    if (!theme) return;

    await themesApi.updateTheme(theme.id, tenantId, {
      colors,
    });

    await refreshTheme();
  };

  if (!theme || !colors) return null;

  return (
    <div className="theme-editor">
      <h2>Edit {theme.name}</h2>

      <div className="color-grid">
        {Object.entries(colors).map(([key, value]) => (
          <div key={key} className="color-input">
            <label>{key}</label>
            <input
              type="color"
              value={value}
              onChange={(e) => handleColorChange(key, e.target.value)}
            />
            <input
              type="text"
              value={value}
              onChange={(e) => handleColorChange(key, e.target.value)}
            />
          </div>
        ))}
      </div>

      <button onClick={handleSave}>Save Changes</button>
    </div>
  );
}
```

## Testing

### Testing Components with Theme

```tsx
import { render } from '@testing-library/react';
import { ThemeProvider } from '@/lib/theme';
import { MyComponent } from './my-component';

// Create a test wrapper
function ThemeWrapper({ children }) {
  return (
    <ThemeProvider tenantId="test-tenant">
      {children}
    </ThemeProvider>
  );
}

describe('MyComponent', () => {
  it('renders with theme', () => {
    const { getByText } = render(<MyComponent />, {
      wrapper: ThemeWrapper,
    });

    expect(getByText('Hello')).toBeInTheDocument();
  });
});
```

### Mocking Theme Context

```tsx
import { ThemeContext } from '@/lib/theme';

const mockTheme = {
  id: '123',
  name: 'Test Theme',
  // ... other properties
};

const mockContextValue = {
  theme: mockTheme,
  loading: false,
  error: null,
  refreshTheme: jest.fn(),
};

describe('MyComponent', () => {
  it('renders with mock theme', () => {
    render(
      <ThemeContext.Provider value={mockContextValue}>
        <MyComponent />
      </ThemeContext.Provider>
    );
  });
});
```

## Best Practices

1. **Use CSS Variables**: Prefer CSS variables over JS for better performance
2. **Cache Themes**: Enable caching in production for faster loads
3. **Preload Fonts**: Load fonts early to prevent layout shift
4. **Handle Loading States**: Always show feedback during theme loading
5. **Validate Before Applying**: Use `validateTheme()` before applying custom themes
6. **Use TypeScript**: Take advantage of full type safety
7. **Test with Multiple Themes**: Ensure components work with all theme variations
8. **Optimize Performance**: Use `useMemo` for expensive theme calculations

## Troubleshooting

### Common Issues

**Theme not applying:**
- Check ThemeProvider is wrapping your components
- Verify tenant ID is correct
- Check browser console for errors

**Fonts not loading:**
- Verify font names are correct
- Check network tab for font loading errors
- Ensure Google Fonts API is accessible

**Performance issues:**
- Enable theme caching
- Preload themes when possible
- Use CSS variables instead of inline styles
- Debounce theme updates

**Type errors:**
- Update TypeScript definitions
- Check theme object matches schema
- Use type guards for optional properties

## Support

For issues or questions:
- Check the [README](./README.md)
- Review [example components](./examples/)
- Contact the platform team
