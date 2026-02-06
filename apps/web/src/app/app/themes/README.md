# Phase 3: Admin UI - Theme Management Interface

Complete implementation of the theme management interface for NoSlag platform.

## 📁 File Structure

```
apps/web/src/
├── app/app/themes/
│   ├── page.tsx                          # Theme gallery page
│   ├── [id]/page.tsx                     # Theme customizer page
│   └── _components/
│       ├── theme-card.tsx                # Theme card component
│       ├── theme-filters.tsx             # Filter controls
│       └── create-theme-dialog.tsx       # Create theme dialog
├── components/
│   ├── themes/
│   │   ├── color-picker.tsx              # Color picker with presets
│   │   ├── font-selector.tsx             # Google Fonts selector
│   │   ├── preview-frame.tsx             # Live preview iframe
│   │   ├── css-editor.tsx                # Monaco CSS editor
│   │   └── theme-section.tsx             # Collapsible section
│   └── ui/                               # Shadcn UI components
│       ├── button.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── textarea.tsx
│       ├── card.tsx
│       ├── slider.tsx
│       ├── switch.tsx
│       ├── radio-group.tsx
│       ├── tabs.tsx
│       ├── badge.tsx
│       ├── dialog.tsx
│       ├── alert-dialog.tsx
│       ├── popover.tsx
│       ├── dropdown-menu.tsx
│       ├── command.tsx
│       └── select.tsx
├── lib/
│   ├── stores/
│   │   └── theme-editor-store.ts         # Zustand store for theme editor
│   ├── services/
│   │   └── theme-service.ts              # Theme service layer
│   └── utils.ts                          # Utility functions
└── hooks/
    └── use-toast.ts                      # Toast notifications hook
```

## 🎨 Features Implemented

### 1. Theme Gallery (`/app/themes`)

**Features:**
- Grid layout displaying all themes (preset + custom)
- Theme cards with color palette preview
- Active theme indicator badge
- Preset theme badge
- Filter by: All / Presets / Custom
- Search themes by name
- Theme statistics display
- Actions: Activate, Edit, Duplicate, Delete

**Components:**
- `ThemeCard` - Individual theme display card
- `ThemeFilters` - Filter and search controls
- `CreateThemeDialog` - Theme creation modal

### 2. Theme Customizer (`/app/themes/[id]`)

**Features:**
- Full-screen modal with split-panel design
- Real-time preview updates
- Keyboard shortcuts (Cmd+S to save, Esc to close)
- Unsaved changes detection
- Auto-save draft to localStorage

**Left Panel Sections:**

1. **Basic Information**
   - Theme name and description

2. **Colors**
   - Primary, Secondary, Accent color pickers
   - Background and Foreground colors
   - Advanced colors (expandable)
   - Contrast checker
   - Recent colors history

3. **Typography**
   - Body font selector (Google Fonts)
   - Heading font selector
   - Font weight controls
   - Base font size (sm/base/lg)
   - Live font preview

4. **Layout**
   - Layout style (Standard/Wide/Boxed)
   - Header style (Classic/Minimal/Centered)
   - Footer style (Default/Minimal/Detailed)
   - Spacing (Compact/Comfortable/Spacious)
   - Container max width

5. **Components**
   - Button style (Rounded/Square/Pill)
   - Button size (sm/md/lg)
   - Card style (Shadow/Border/Flat)
   - Card border radius slider
   - Input style (Outlined/Filled)

6. **Product Display**
   - Grid columns (2/3/4)
   - Image ratio (Square/Portrait/Landscape)
   - Quick view toggle
   - Wishlist button toggle

7. **Advanced**
   - Custom CSS editor (Monaco Editor)
   - Syntax highlighting
   - Auto-completion
   - Full-screen mode

**Right Panel:**
- Live storefront preview in iframe
- Responsive preview modes (Desktop/Tablet/Mobile)
- Preview refresh control
- Open in new tab

### 3. Color Picker Component

**Features:**
- Visual color picker (react-colorful)
- Hex input field
- Preset color swatches (8 colors)
- Recent colors (8 most recent)
- Contrast checker
- Accessibility recommendations

### 4. Font Selector Component

**Features:**
- Searchable dropdown with 30+ Google Fonts
- Font preview in actual font
- Categorized fonts (Sans-serif, Serif, Display, Monospace)
- Popular fonts highlighted
- Font weight selection
- Preview sentence display

### 5. Preview Frame Component

**Features:**
- Real-time theme preview
- Responsive mode toggle (Desktop/Tablet/Mobile)
- Debounced updates (300ms)
- Loading states
- Refresh button
- Open in new tab

### 6. CSS Editor Component

**Features:**
- Monaco Editor integration
- Syntax highlighting
- Dark mode theme
- Auto-completion
- Error detection
- Full-screen mode

### 7. Create Theme Flow

**Options:**

1. **Start from Preset**
   - Select from 4 preset themes
   - Customize after duplication

2. **Start from Scratch**
   - Opens customizer with defaults
   - All settings customizable

3. **Import Theme**
   - Upload JSON file
   - Validates and imports

### 8. State Management (Zustand)

**Store Features:**
- Current theme state
- Original theme (for comparison)
- Dirty state tracking
- Saving state
- Preview mode
- Actions for updating all theme properties
- Change detection
- Discard changes

### 9. Confirmation Dialogs

- **Delete Theme**: "Are you sure? This cannot be undone."
- **Activate Theme**: "Activate [Theme Name]?"
- **Unsaved Changes**: "You have unsaved changes. Discard?"
- **Reset to Defaults**: "Reset all settings to default values?"

## 🎯 Usage

### View Themes Gallery

```typescript
// Navigate to /app/themes
// Automatically loads all themes for tenant
```

### Create New Theme

```typescript
// Click "Create New Theme" button
// Choose: Preset / Scratch / Import
// Fill in name and description
// Opens customizer automatically
```

### Edit Theme

```typescript
// Click on theme card OR click Edit action
// Customizer opens with theme loaded
// Make changes in left panel
// Preview updates in real-time
// Click Save to persist changes
```

### Activate Theme

```typescript
// Click Activate button on theme card
// Confirmation dialog appears
// Theme activates and updates storefront
```

### Duplicate Theme

```typescript
// Click dropdown menu on theme card
// Select "Duplicate"
// New theme created with "(Copy)" suffix
// Opens in customizer for editing
```

## 🔧 Technical Details

### Dependencies

```json
{
  "react-colorful": "^5.6.1",
  "@monaco-editor/react": "^4.6.0",
  "zustand": "^4.5.0",
  "@radix-ui/react-*": "Various UI primitives",
  "class-variance-authority": "^0.7.0",
  "clsx": "^2.1.0",
  "tailwind-merge": "^2.2.1",
  "cmdk": "^0.2.0"
}
```

### State Management

**Zustand Store:**
```typescript
interface ThemeEditorState {
  currentTheme: Theme | null;
  originalTheme: Theme | null;
  isDirty: boolean;
  isSaving: boolean;
  previewMode: 'desktop' | 'tablet' | 'mobile';

  setTheme: (theme: Theme) => void;
  updateColors: (colors: Partial<ThemeColors>) => void;
  updateTypography: (typography: Partial<ThemeTypography>) => void;
  updateLayout: (layout: Partial<ThemeLayout>) => void;
  updateComponents: (components: Partial<ThemeComponents>) => void;
  updateCustomCSS: (css: string) => void;
  setPreviewMode: (mode) => void;
  setSaving: (saving: boolean) => void;
  reset: () => void;
  hasChanges: () => boolean;
  discardChanges: () => void;
}
```

### API Integration

**Theme Service:**
```typescript
themeService.getAllThemes()          // Get all themes
themeService.getActiveTheme()        // Get active theme
themeService.getTheme(id)            // Get specific theme
themeService.createTheme(data)       // Create new theme
themeService.updateTheme(id, data)   // Update theme
themeService.deleteTheme(id)         // Delete theme
themeService.activateTheme(id)       // Activate theme
themeService.duplicateTheme(id, opts)// Duplicate theme
```

### Real-time Preview

**How it works:**
1. User changes setting in left panel
2. Zustand store updates `currentTheme`
3. React re-renders preview frame
4. Theme CSS generated on-the-fly
5. CSS injected into iframe
6. Preview updates (debounced 300ms)

### CSS Generation

```typescript
generateThemeCSS(theme: Theme): string
// Converts theme object to CSS variables
// Includes base styles
// Adds custom CSS
// Returns complete CSS string
```

## 🎨 Design System

### Colors

All colors use CSS variables:
- `--primary`: Primary brand color
- `--secondary`: Secondary brand color
- `--accent`: Accent/highlight color
- `--background`: Main background
- `--foreground`: Main text color
- `--muted`: Muted/subtle elements
- `--border`: Border colors
- `--destructive`: Error/danger states

### Typography

Font system with Google Fonts:
- Body font with configurable weight
- Heading font with configurable weight
- Base font size (sm: 14px, base: 16px, lg: 18px)

### Spacing

Consistent spacing system:
- Compact: 0.5rem
- Comfortable: 1rem
- Spacious: 1.5rem

## 🚀 Performance

### Optimizations

1. **Lazy Loading**
   - Color picker loaded on demand
   - Monaco editor loaded on demand
   - Virtual scrolling for font lists

2. **Debouncing**
   - Preview updates debounced (300ms)
   - Search input debounced

3. **Memoization**
   - Font list memoized
   - Filtered themes memoized
   - Preview CSS memoized

4. **Code Splitting**
   - Theme customizer loaded separately
   - Preview frame isolated

## 📱 Responsive Design

**Breakpoints:**
- Desktop: Main use case, full functionality
- Tablet: Side-by-side becomes stacked
- Mobile: Single panel with tabs

**Mobile Adaptations:**
- Collapsible sections
- Touch-friendly controls
- Optimized font selector
- Simplified preview

## ♿ Accessibility

- Keyboard navigation support
- ARIA labels on all interactive elements
- Focus management
- Screen reader friendly
- Color contrast checker
- Semantic HTML

## 🔐 Security

- XSS protection in custom CSS
- Sanitized inputs
- Tenant isolation
- CSRF protection
- Rate limiting on API calls

## 🧪 Testing

### Manual Testing Checklist

- [ ] Can view all themes in gallery
- [ ] Can activate any theme
- [ ] Can create custom theme
- [ ] Can edit theme in customizer
- [ ] Can duplicate theme
- [ ] Can delete custom theme (not presets)
- [ ] Color picker works smoothly
- [ ] Font selector loads Google Fonts
- [ ] Preview updates in real-time
- [ ] Changes save successfully
- [ ] Responsive on all devices
- [ ] Proper error handling
- [ ] Smooth animations
- [ ] Keyboard shortcuts work

## 🐛 Known Issues

None currently - this is a complete implementation!

## 🔮 Future Enhancements

1. **Advanced Features**
   - Theme versioning
   - A/B testing
   - Theme marketplace
   - Import from URL
   - Export theme package

2. **UI Improvements**
   - Undo/redo history
   - Theme comparison view
   - Color scheme generator
   - AI-powered suggestions
   - Theme templates library

3. **Developer Tools**
   - Theme CLI
   - VS Code extension
   - Theme playground
   - Documentation generator
   - Component preview

## 📚 Related Documentation

- [Phase 1: Core Types & Database](../../../lib/theme/README.md)
- [Phase 2: Theme Engine](../../../lib/theme/theme-engine.ts)
- [API Documentation](../../../lib/api/themes.ts)
- [Integration Guide](../../../lib/theme/INTEGRATION.md)

## 🤝 Contributing

When adding new theme options:

1. Update types in `lib/theme/types.ts`
2. Add UI controls in customizer
3. Update theme-engine CSS generation
4. Add to preview frame
5. Update documentation
6. Test thoroughly

## 📝 License

Part of the NoSlag platform. All rights reserved.
