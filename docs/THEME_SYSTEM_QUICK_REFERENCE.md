# Theme System - Quick Reference Guide

## 🚀 Quick Start

### For Administrators

1. **Access Theme Gallery**
   ```
   Navigate to: http://localhost:4200/app/themes
   ```

2. **Activate a Preset Theme**
   - Click on any preset theme card (Modern, Minimal, Bold, Classic)
   - Click "Activate" button
   - Storefront updates immediately

3. **Customize a Theme**
   - Click "Edit" on any theme
   - Customize in 7 sections:
     - Basic Info (name, description)
     - Colors (22 color pickers)
     - Typography (fonts, sizes)
     - Layout (styles, spacing)
     - Components (buttons, cards)
     - Product Display (layouts)
     - Advanced (custom CSS)
   - See live preview on right panel
   - Click "Save Changes"

4. **Create Custom Theme**
   - Click "Create Theme" button
   - Choose creation method:
     - **From Preset:** Start with a preset and customize
     - **Duplicate:** Clone existing theme
     - **From Scratch:** Start blank
   - Enter theme name
   - Click "Create"
   - Customize and save

---

## 🎨 Available Preset Themes

### 1. Modern (Professional) - Default
- **Colors:** Indigo primary, Blue secondary, Amber accent
- **Fonts:** Inter (body & headings)
- **Layout:** Wide, spacious
- **Best For:** Tech, SaaS, Professional services

### 2. Minimal
- **Colors:** Black primary, Gray secondary, Orange accent
- **Fonts:** Inter body, Playfair Display headings
- **Layout:** Centered, compact
- **Best For:** Fashion, luxury goods, art galleries

### 3. Bold (Creative)
- **Colors:** Violet primary, Pink secondary, Yellow accent
- **Fonts:** Poppins (body & headings)
- **Layout:** Wide, spacious
- **Best For:** Creative agencies, lifestyle brands

### 4. Classic
- **Colors:** Navy primary, Gold secondary, Cream accent
- **Fonts:** Inter body, Playfair Display headings
- **Layout:** Standard, comfortable
- **Best For:** Law firms, financial services, traditional businesses

---

## 🛠️ For Developers

### 1. Using Theme Colors in Components

```tsx
// Option 1: Use Tailwind CSS variables (recommended)
<div className="bg-primary text-primary-foreground">
  <h1 className="text-foreground">Welcome</h1>
  <p className="text-muted-foreground">Subtitle</p>
</div>

// Option 2: Use theme hooks
import { useThemeColor } from '@/lib/theme';

function MyComponent() {
  const primaryColor = useThemeColor('primary');

  return (
    <div style={{ backgroundColor: primaryColor }}>
      Custom styled content
    </div>
  );
}
```

### 2. Using Themed Components

```tsx
import { ThemedButton, ThemedCard } from '@/app/storefront/_components';

function ProductCard() {
  return (
    <ThemedCard>
      <h3>Product Name</h3>
      <p>Description</p>
      <ThemedButton>Add to Cart</ThemedButton>
    </ThemedCard>
  );
}
```

**ThemedButton** automatically applies:
- `rounded` style → `rounded-md`
- `square` style → `rounded-none`
- `pill` style → `rounded-full`

**ThemedCard** automatically applies:
- `shadow` style → `shadow-md`
- `border` style → `border-2`
- `flat` style → `border-0 shadow-none`

### 3. Using Theme Hooks

```tsx
import {
  useTheme,
  useThemeFont,
  useThemeLayout,
  useThemeColor
} from '@/lib/theme';

function MyComponent() {
  // Get full theme object
  const { theme, isLoading } = useTheme();

  // Get specific values
  const { fontFamily, headingFont, fontSize } = useThemeFont();
  const { buttonStyle, cardStyle, spacing } = useThemeLayout();
  const primaryColor = useThemeColor('primary');

  return (
    <div style={{ fontFamily }}>
      {isLoading ? 'Loading...' : `Current theme: ${theme?.name}`}
    </div>
  );
}
```

### 4. Available CSS Variables

Use these in className or style:

**Colors:**
```css
--background          /* Page background */
--foreground          /* Primary text */
--card                /* Card backgrounds */
--card-foreground     /* Card text */
--primary             /* Brand primary color */
--primary-foreground  /* Text on primary */
--secondary           /* Brand secondary color */
--secondary-foreground
--accent              /* Accent color */
--accent-foreground
--muted               /* Muted backgrounds */
--muted-foreground    /* Muted text */
--destructive         /* Error/danger color */
--destructive-foreground
--border              /* All borders */
--input               /* Input borders */
--ring                /* Focus ring color */
--popover             /* Popover backgrounds */
--popover-foreground
--chart1, --chart2, --chart3  /* Chart colors */
```

**Typography:**
```css
--font-body           /* Body font family */
--font-heading        /* Heading font family */
--font-size-base      /* Base font size (14px, 16px, 18px) */
```

**Spacing:**
```css
--spacing-base        /* Base spacing (0.75rem, 1rem, 1.5rem) */
```

**Border Radius:**
```css
--radius              /* Base border radius */
```

### 5. Color Mapping Guide

| Use Case | CSS Variable | Example |
|----------|-------------|---------|
| Page background | `bg-background` | Main app background |
| Card/Modal | `bg-card` | Cards, modals, panels |
| Primary text | `text-foreground` | Headlines, body text |
| Secondary text | `text-muted-foreground` | Captions, labels |
| Primary button | `bg-primary text-primary-foreground` | CTA buttons |
| Secondary button | `bg-secondary text-secondary-foreground` | Less important actions |
| Accent elements | `bg-accent text-accent-foreground` | Badges, highlights |
| Borders | `border-border` | Dividers, outlines |
| Input fields | `bg-input` or `bg-muted` | Form inputs |
| Focus ring | `ring-ring` | Keyboard focus |
| Error state | `text-destructive` or `bg-destructive` | Error messages |
| Disabled state | `text-muted-foreground` | Disabled text |

### 6. Migration from Hardcoded Colors

**Before:**
```tsx
<div className="bg-white border-gray-200">
  <h1 className="text-gray-900">Title</h1>
  <p className="text-gray-600">Description</p>
  <button className="bg-blue-600 text-white hover:bg-blue-700">
    Click me
  </button>
</div>
```

**After:**
```tsx
<div className="bg-card border-border">
  <h1 className="text-foreground">Title</h1>
  <p className="text-muted-foreground">Description</p>
  <button className="bg-primary text-primary-foreground hover:bg-primary/90">
    Click me
  </button>
</div>
```

### 7. Adding Custom Fonts

```tsx
// In StoreProviders or layout
import { FontLoader } from '@/lib/theme/font-loader';

<FontLoader fonts={['Inter', 'Poppins', 'Playfair Display']} />
```

**Available Google Fonts (pre-configured):**
- Inter, Roboto, Open Sans, Poppins (Sans-serif)
- Playfair Display, Merriweather, Lora (Serif)
- Fira Code, Source Code Pro (Monospace)
- Montserrat (Display)

---

## 🔌 API Reference

### Public Endpoints

```bash
# Get all themes
GET /api/v1/store/themes
Response: Array<StoreTheme>

# Get active theme
GET /api/v1/store/themes/active
Response: StoreTheme

# Get preset themes only
GET /api/v1/store/themes/presets
Response: Array<StoreTheme>
```

### Admin Endpoints (Requires Auth)

```bash
# Create custom theme
POST /api/v1/store/admin/themes
Body: CreateThemeDto
Response: StoreTheme

# Update theme
PUT /api/v1/store/admin/themes/:id
Body: UpdateThemeDto
Response: StoreTheme

# Delete theme (custom only)
DELETE /api/v1/store/admin/themes/:id
Response: { message: "Theme deleted" }

# Activate theme
POST /api/v1/store/admin/themes/:id/activate
Response: StoreTheme

# Duplicate theme
POST /api/v1/store/admin/themes/:id/duplicate
Body: { name: "New Theme Name" }
Response: StoreTheme
```

### Example: Create Theme via API

```typescript
const response = await fetch('/api/v1/store/admin/themes', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    name: 'My Custom Theme',
    slug: 'my-custom-theme',
    colors: {
      background: '#ffffff',
      foreground: '#0f172a',
      primary: '#4f46e5',
      primaryForeground: '#f8fafc',
      // ... 22 total colors
    },
    fontFamily: 'Inter',
    headingFont: 'Poppins',
    fontSize: 'base',
    layoutStyle: 'wide',
    buttonStyle: 'rounded',
    cardStyle: 'shadow',
  }),
});

const theme = await response.json();
```

---

## 📊 Theme Structure

```typescript
interface StoreTheme {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  isActive: boolean;
  isCustom: boolean;
  isPreset: boolean;

  // Colors (22 total)
  colors: {
    background: string;        // #ffffff
    foreground: string;        // #0f172a
    card: string;
    cardForeground: string;
    popover: string;
    popoverForeground: string;
    primary: string;           // #4f46e5
    primaryForeground: string;
    secondary: string;         // #3b82f6
    secondaryForeground: string;
    muted: string;
    mutedForeground: string;
    accent: string;            // #fbbf24
    accentForeground: string;
    destructive: string;
    destructiveForeground: string;
    border: string;
    input: string;
    ring: string;
    chart1: string;
    chart2: string;
    chart3: string;
  };

  // Typography
  fontFamily: string;          // "Inter"
  headingFont?: string;        // "Poppins"
  fontSize: 'sm' | 'base' | 'lg';

  // Layout
  layoutStyle: 'standard' | 'wide' | 'boxed';
  headerStyle: 'classic' | 'minimal' | 'centered';
  spacing: 'compact' | 'comfortable' | 'spacious';

  // Components
  buttonStyle: 'rounded' | 'square' | 'pill';
  cardStyle: 'shadow' | 'border' | 'flat';

  // Advanced
  customCSS?: string;
  logoUrl?: string;
  faviconUrl?: string;

  createdAt: Date;
  updatedAt: Date;
}
```

---

## 🐛 Troubleshooting

### Theme not updating on storefront

**Solution:**
1. Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)
2. Clear localStorage: `localStorage.removeItem('noslag-theme-{tenantId}')`
3. Check active theme: `GET /api/v1/store/themes/active`
4. Verify ThemeProvider is wrapped around app

### Colors not applying

**Solution:**
1. Check CSS variables are injected: Open DevTools > Elements > `:root`
2. Verify Tailwind config includes CSS variables
3. Ensure `bg-primary` instead of `bg-blue-600`
4. Check theme colors are valid hex codes

### Fonts not loading

**Solution:**
1. Check Google Fonts API is reachable
2. Verify FontLoader component is mounted
3. Check Network tab for font requests
4. Ensure font names match Google Fonts exactly (case-sensitive)

### Custom CSS not working

**Solution:**
1. Verify CSS syntax is valid
2. Check for `!important` conflicts
3. Ensure CSS is not sanitized/blocked
4. Use browser DevTools to inspect computed styles

### Performance issues

**Solution:**
1. Enable theme caching in ThemeProvider
2. Reduce font weights loaded (only regular + bold)
3. Minimize custom CSS (< 5KB)
4. Use CSS variables instead of inline styles
5. Check for CSS specificity wars

---

## 📝 Best Practices

### 1. Color Usage
✅ **DO:**
- Use semantic variables (`bg-primary`, not `bg-blue-600`)
- Test color contrast (WCAG AA: 4.5:1 minimum)
- Use muted colors for secondary content
- Maintain consistent color hierarchy

❌ **DON'T:**
- Hardcode hex colors in components
- Use too many accent colors (max 3)
- Ignore accessibility contrast ratios
- Override theme colors with inline styles

### 2. Typography
✅ **DO:**
- Limit to 2 font families (body + heading)
- Use font weights: 400 (regular), 600 (semibold), 700 (bold)
- Ensure fonts have good readability
- Test on mobile devices

❌ **DON'T:**
- Load 10+ font weights (slow)
- Use decorative fonts for body text
- Mix serif + sans-serif randomly
- Use fonts < 14px for body text

### 3. Custom CSS
✅ **DO:**
- Keep custom CSS minimal (< 5KB)
- Use CSS variables for colors
- Add comments for complex selectors
- Test across browsers

❌ **DON'T:**
- Override core framework styles
- Use `!important` excessively
- Include external CSS imports
- Write vendor-prefixed CSS (autoprefixer handles it)

### 4. Performance
✅ **DO:**
- Enable theme caching
- Preload critical fonts
- Use CSS variables for dynamic values
- Lazy load Monaco editor

❌ **DON'T:**
- Inline large CSS blocks
- Load unnecessary fonts
- Force re-renders on every change
- Disable caching in production

---

## 🎓 Advanced Usage

### 1. Dynamic Theme Switching

```typescript
import { useTheme } from '@/lib/theme';

function ThemeSwitcher() {
  const { theme, refreshTheme } = useTheme();

  const switchTheme = async (themeId: string) => {
    // Activate theme via API
    await fetch(`/api/v1/store/admin/themes/${themeId}/activate`, {
      method: 'POST',
    });

    // Refresh theme in UI
    await refreshTheme();
  };

  return (
    <select onChange={(e) => switchTheme(e.target.value)}>
      <option value="modern">Modern</option>
      <option value="minimal">Minimal</option>
      <option value="bold">Bold</option>
      <option value="classic">Classic</option>
    </select>
  );
}
```

### 2. Programmatic Color Updates

```typescript
import { applyThemeColors } from '@/lib/theme/theme-engine';

function updatePrimaryColor(newColor: string) {
  const updatedColors = {
    ...currentTheme.colors,
    primary: newColor,
  };

  // Apply immediately (preview)
  applyThemeColors(updatedColors);

  // Save to backend
  await updateTheme(themeId, { colors: updatedColors });
}
```

### 3. Theme Inheritance

```typescript
// Create theme based on existing theme
const modernTheme = await getTheme('modern');

const customTheme = {
  ...modernTheme,
  name: 'My Modern Variant',
  colors: {
    ...modernTheme.colors,
    primary: '#8b5cf6', // Override primary only
  },
};

await createTheme(customTheme);
```

### 4. Responsive Theme Values

```typescript
import { useThemeLayout } from '@/lib/theme';

function ResponsiveComponent() {
  const { spacing } = useThemeLayout();

  const spacingMap = {
    compact: 'space-y-2',
    comfortable: 'space-y-4',
    spacious: 'space-y-8',
  };

  return (
    <div className={spacingMap[spacing]}>
      <p>Item 1</p>
      <p>Item 2</p>
    </div>
  );
}
```

---

## 🔗 Resources

**Documentation:**
- [Full Architecture Guide](./ARCHITECTURE.md)
- [Integration Guide](./INTEGRATION.md)
- [API Reference](./API.md)
- [Audit Report](./THEME_SYSTEM_AUDIT_REPORT.md)

**External Resources:**
- [Tailwind CSS Variables](https://tailwindcss.com/docs/customizing-colors#using-css-variables)
- [Google Fonts](https://fonts.google.com/)
- [WCAG Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Shadcn UI Design System](https://ui.shadcn.com/docs/theming)

**Support:**
- Report bugs: https://github.com/noslag/platform/issues
- Feature requests: https://github.com/noslag/platform/discussions
- Documentation: https://docs.noslag.com/theming

---

**Last Updated:** 2026-02-06
**Version:** 1.0
**Status:** ✅ Production Ready
