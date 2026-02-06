# Theme System Cheat Sheet

Quick reference for the NoSlag Theme Engine.

## 🚀 Quick Start

```tsx
// 1. Already integrated in storefront - just use the hooks!
import { useTheme, useThemeColor } from '@/lib/theme';

function MyComponent() {
  const { theme } = useTheme();
  const primary = useThemeColor('primary');

  return <div style={{ color: primary }}>Hello!</div>;
}
```

## 🎨 Most Common Hooks

```tsx
// Get full theme
const { theme, loading, error } = useTheme();

// Get specific color
const primary = useThemeColor('primary');
const background = useThemeColor('background');

// Get fonts
const { body, heading } = useThemeFont();

// Check if dark
const isDark = useIsDarkTheme();

// Get layout config
const { layoutStyle, spacing } = useThemeLayout();
```

## 💅 CSS Variables (Recommended)

```css
/* Colors */
background: hsl(var(--primary));
color: hsl(var(--foreground));
border: 1px solid hsl(var(--border));

/* Typography */
font-family: var(--font-family);
font-size: var(--font-size-base);

/* Layout */
padding: var(--spacing);
border-radius: var(--radius);
max-width: var(--layout-max-width);
```

## 🔧 API Client

```tsx
import { themesApi } from '@/lib/api/themes';

// Get themes
const themes = await themesApi.getThemes(tenantId);
const active = await themesApi.getActiveTheme(tenantId);

// Create theme
const theme = await themesApi.createTheme(tenantId, {
  name: 'My Theme',
  colors: { primary: '#0070f3' }
});

// Update theme
await themesApi.updateTheme(id, tenantId, {
  colors: { primary: '#ff0000' }
});

// Switch theme
await themesApi.activateTheme(id, tenantId);
await refreshTheme(); // Don't forget!
```

## 📦 All Available Colors

```
primary, secondary, accent
background, foreground
card, cardForeground
popover, popoverForeground
muted, mutedForeground
border, input, ring
success, warning, error, info
chart1, chart2, chart3, chart4, chart5
```

## 🎭 All 25+ Hooks

### Core
- `useTheme()` - Full context
- `useThemeColor(key)` - Get color
- `useThemeColors()` - All colors
- `useThemeFont()` - Font config
- `useThemeLayout()` - Layout config
- `useTypography()` - Typography config
- `useComponentStyles()` - Component styles

### Utilities
- `useThemeLoading()` - Is loading?
- `useThemeError()` - Error state
- `useThemeReady()` - Is ready?
- `useThemeId()` - Theme ID
- `useThemeName()` - Theme name
- `useIsDarkTheme()` - Dark mode?
- `useThemePreset()` - Preset type
- `useIsPresetTheme()` - Is preset?

### Specific Values
- `usePrimaryColor()` - Primary color
- `useBackgroundColor()` - Background
- `useForegroundColor()` - Text color
- `useSpacing()` - Spacing value
- `useBorderRadius()` - Radius value
- `useRefreshTheme()` - Refresh function
- `useCSSVariable(name)` - Get CSS var

## 🎬 Loading Components

```tsx
import {
  ThemeLoadingSkeleton,
  ThemeErrorFallback,
  PreventFOUC,
  ThemeReadyGuard
} from '@/lib/theme';

// Show loading
{loading && <ThemeLoadingSkeleton />}

// Prevent flash
<PreventFOUC>
  <YourContent />
</PreventFOUC>

// Guard render
<ThemeReadyGuard>
  <YourContent />
</ThemeReadyGuard>
```

## 🛠️ Utility Functions

```tsx
import {
  hexToHSL,
  getContrastColor,
  validateTheme,
  mergeThemes,
  getCachedTheme,
  cacheTheme
} from '@/lib/theme';

// Color conversion
const hsl = hexToHSL('#0070f3'); // { h: 220, s: 100, l: 50 }

// Contrast check
const contrast = getContrastColor('#000000'); // 'light'

// Theme validation
const valid = validateTheme(theme); // boolean

// Cache management
const cached = getCachedTheme(tenantId);
cacheTheme(tenantId, theme);
```

## 📱 Example Components

### Themed Button
```tsx
function Button({ children }) {
  const primary = useThemeColor('primary');
  const radius = useBorderRadius();

  return (
    <button style={{
      backgroundColor: primary,
      borderRadius: radius,
      padding: '0.5rem 1rem'
    }}>
      {children}
    </button>
  );
}
```

### Themed Card
```tsx
function Card({ children }) {
  const card = useThemeColor('card');
  const { cardShadow } = useComponentStyles();

  return (
    <div style={{
      backgroundColor: card,
      boxShadow: cardShadow,
      padding: '1rem'
    }}>
      {children}
    </div>
  );
}
```

## 🔄 Theme Switching Pattern

```tsx
function ThemeSwitcher({ tenantId }) {
  const { theme, refreshTheme } = useTheme();
  const [themes, setThemes] = useState([]);

  useEffect(() => {
    themesApi.getThemes(tenantId).then(setThemes);
  }, []);

  const switchTheme = async (id) => {
    await themesApi.activateTheme(id, tenantId);
    await refreshTheme();
  };

  return (
    <select value={theme?.id} onChange={(e) => switchTheme(e.target.value)}>
      {themes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
    </select>
  );
}
```

## ⚡ Performance Tips

1. **Use CSS Variables** - Faster than JS styling
2. **Enable Caching** - Instant loads
3. **Memoize Calculations** - Hooks already do this
4. **Preload Themes** - Use `preloadTheme()`
5. **Lazy Load Fonts** - FontLoader handles this

## 🐛 Common Issues

### Theme not loading?
```tsx
// Check provider wraps component
<ThemeProvider tenantId={id}>
  <YourApp />
</ThemeProvider>

// Check tenant ID is correct
console.log(tenantId);

// Check cache
import { clearThemeCache } from '@/lib/theme';
clearThemeCache(tenantId);
```

### Fonts not loading?
```tsx
// Check font names
<FontLoader fonts={['Inter', 'Roboto']} />

// Check browser console for errors
// Ensure Google Fonts API accessible
```

### Theme not updating?
```tsx
// Must call refreshTheme after API changes
await themesApi.updateTheme(id, tenantId, data);
await refreshTheme(); // ← Don't forget this!
```

## 📚 Full Documentation

- **Quick Start**: `/apps/web/src/lib/theme/QUICK_START.md`
- **API Reference**: `/apps/web/src/lib/theme/README.md`
- **Integration Guide**: `/apps/web/src/lib/theme/INTEGRATION.md`
- **Architecture**: `/apps/web/src/lib/theme/ARCHITECTURE.md`
- **Examples**: `/apps/web/src/lib/theme/examples/`

## 🧪 Testing

```tsx
import { ThemeProvider } from '@/lib/theme';

function TestWrapper({ children }) {
  return (
    <ThemeProvider tenantId="test">
      {children}
    </ThemeProvider>
  );
}

test('component with theme', () => {
  render(<MyComponent />, { wrapper: TestWrapper });
});
```

## 🎯 Best Practices

✅ **DO:**
- Use CSS variables for styling
- Enable caching in production
- Handle loading states
- Use TypeScript types
- Test with multiple themes

❌ **DON'T:**
- Access context outside provider
- Update themes too frequently
- Ignore error states
- Skip theme validation
- Forget to refresh after updates

---

**Need help?** Check the [full documentation](./apps/web/src/lib/theme/README.md) or [examples](./apps/web/src/lib/theme/examples/)!
