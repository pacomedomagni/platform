# Theme System Quick Start

Get started with the NoSlag theme system in 5 minutes.

## 1. Setup (Already Done!)

The theme system is already integrated in the storefront layout. No additional setup needed!

## 2. Use Theme in Your Components

### Method 1: CSS Variables (Recommended)

```tsx
// Your component
export function MyCard() {
  return <div className="my-card">Hello</div>;
}

// Your CSS/Tailwind
.my-card {
  background: hsl(var(--card));
  color: hsl(var(--card-foreground));
  border-radius: var(--radius);
  padding: var(--spacing);
  font-family: var(--font-family);
}
```

**Available CSS Variables:**
```css
/* Colors */
--primary, --secondary, --accent
--background, --foreground
--card, --card-foreground
--border, --input, --ring
--success, --warning, --error, --info
--muted, --muted-foreground

/* Typography */
--font-family, --font-heading
--font-size-base

/* Layout */
--spacing, --radius
--layout-max-width
--button-radius, --card-shadow
```

### Method 2: Theme Hooks

```tsx
'use client';

import { useTheme, useThemeColor } from '@/lib/theme';

export function MyCard() {
  const { theme } = useTheme();
  const primaryColor = useThemeColor('primary');

  return (
    <div style={{
      color: primaryColor,
      fontFamily: theme?.fontFamily
    }}>
      Hello
    </div>
  );
}
```

## 3. Common Use Cases

### Get Theme Colors

```tsx
import { useThemeColor } from '@/lib/theme';

const primary = useThemeColor('primary');
const background = useThemeColor('background');
```

### Get Theme Fonts

```tsx
import { useThemeFont } from '@/lib/theme';

const { body, heading } = useThemeFont();
```

### Get Layout Config

```tsx
import { useThemeLayout } from '@/lib/theme';

const { layoutStyle, spacing, borderRadius } = useThemeLayout();
```

### Check if Dark Theme

```tsx
import { useIsDarkTheme } from '@/lib/theme';

const isDark = useIsDarkTheme();
```

## 4. Theme Management

### Switch Theme

```tsx
'use client';

import { themesApi } from '@/lib/api/themes';
import { useRefreshTheme } from '@/lib/theme';

export function ThemeSwitcher() {
  const refreshTheme = useRefreshTheme();

  const switchTheme = async (themeId: string) => {
    await themesApi.activateTheme(themeId, 'tenant-id');
    await refreshTheme();
  };

  return <button onClick={() => switchTheme('theme-123')}>Switch</button>;
}
```

### Create Theme

```tsx
import { themesApi } from '@/lib/api/themes';

await themesApi.createTheme('tenant-id', {
  name: 'My Theme',
  colors: {
    primary: '#0070f3',
    // ... other colors
  },
});
```

### Update Theme

```tsx
import { themesApi } from '@/lib/api/themes';

await themesApi.updateTheme('theme-id', 'tenant-id', {
  colors: { primary: '#ff0000' },
});
```

## 5. API Reference

### Hooks

| Hook | Returns | Description |
|------|---------|-------------|
| `useTheme()` | `{ theme, loading, error, refreshTheme }` | Full theme context |
| `useThemeColor(key)` | `string` | Specific color value |
| `useThemeFont()` | `{ body, heading }` | Font configuration |
| `useThemeLayout()` | `LayoutConfig` | Layout settings |
| `useIsDarkTheme()` | `boolean` | Dark theme check |
| `usePrimaryColor()` | `string` | Primary color |
| `useSpacing()` | `string` | Spacing value |
| `useBorderRadius()` | `string` | Border radius |

### API Client

```tsx
import { themesApi } from '@/lib/api/themes';

// Get themes
await themesApi.getActiveTheme(tenantId);
await themesApi.getThemes(tenantId);

// Manage themes
await themesApi.createTheme(tenantId, data);
await themesApi.updateTheme(id, tenantId, data);
await themesApi.deleteTheme(id, tenantId);
await themesApi.activateTheme(id, tenantId);

// Presets
await themesApi.getPresets();
await themesApi.createFromPreset(tenantId, 'modern');
```

## 6. Examples

### Themed Button

```tsx
'use client';

import { useThemeColor, useBorderRadius } from '@/lib/theme';

export function Button({ children, onClick }) {
  const primary = useThemeColor('primary');
  const radius = useBorderRadius();

  return (
    <button
      onClick={onClick}
      style={{
        backgroundColor: primary,
        color: '#fff',
        padding: '0.5rem 1rem',
        borderRadius: radius,
        border: 'none',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}
```

### Themed Card

```tsx
'use client';

import { useThemeColor, useComponentStyles } from '@/lib/theme';

export function Card({ children }) {
  const card = useThemeColor('card');
  const { cardShadow } = useComponentStyles();

  return (
    <div
      style={{
        backgroundColor: card,
        boxShadow: cardShadow === 'md'
          ? '0 4px 6px -1px rgb(0 0 0 / 0.1)'
          : 'none',
        padding: '1rem',
        borderRadius: '0.5rem',
      }}
    >
      {children}
    </div>
  );
}
```

## 7. Tips

✅ **Do:**
- Use CSS variables for better performance
- Cache themes in production
- Handle loading states
- Test with multiple themes

❌ **Don't:**
- Access theme context outside ThemeProvider
- Update themes too frequently
- Forget to refresh after theme changes
- Ignore TypeScript types

## 8. Performance

The theme system is optimized for performance:
- ⚡ CSS variables for instant updates (<100ms)
- 💾 localStorage caching
- 🔄 Lazy font loading
- 🎨 Smooth transitions
- 📦 Small bundle size

## Need Help?

- 📖 [Full Documentation](./README.md)
- 🔧 [Integration Guide](./INTEGRATION.md)
- 💡 [Example Components](./examples/)
- 🧪 [Tests](./__tests__/)

## What's Next?

1. Explore the [full API reference](./README.md#api-reference)
2. Check out [example components](./examples/)
3. Read the [integration guide](./INTEGRATION.md)
4. Build your themed components!

---

**Ready to theme!** 🎨
