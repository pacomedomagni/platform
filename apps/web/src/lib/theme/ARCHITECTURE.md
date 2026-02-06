# Theme System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     NoSlag Theme System                          │
│                  Frontend Infrastructure Layer                    │
└─────────────────────────────────────────────────────────────────┘

                              ▼

┌─────────────────────────────────────────────────────────────────┐
│                        Application Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  Storefront  │  │    Admin     │  │   Customer   │         │
│  │    Layout    │  │  Dashboard   │  │    Portal    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Provider Layer                           │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              ThemeProvider (Context)                    │    │
│  │  • Theme state management                              │    │
│  │  • API integration                                      │    │
│  │  • Caching layer                                        │    │
│  │  • Error handling                                       │    │
│  └────────────────────────────────────────────────────────┘    │
│                              ▼                                   │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              FontLoader (Component)                     │    │
│  │  • Dynamic font loading                                │    │
│  │  • Google Fonts API                                     │    │
│  │  • Loading states                                       │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          Hook Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  useTheme()  │  │useThemeColor │  │useThemeFont  │         │
│  │              │  │     ()       │  │     ()       │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │useThemeLayout│  │useComponent  │  │ useIsDark    │         │
│  │     ()       │  │  Styles()    │  │  Theme()     │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                    + 19 more hooks                               │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Engine Layer                             │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              theme-engine.ts                            │    │
│  │  ┌──────────────────────────────────────────────┐     │    │
│  │  │ applyTheme()                                  │     │    │
│  │  │  ├─ applyThemeColors()    → CSS Variables    │     │    │
│  │  │  ├─ applyTypographyStyles() → Font Props     │     │    │
│  │  │  ├─ applyLayoutStyles()    → Layout Props    │     │    │
│  │  │  ├─ applyComponentStyles() → Component Props │     │    │
│  │  │  ├─ loadThemeFonts()       → Google Fonts    │     │    │
│  │  │  └─ injectThemeCSS()       → <style> tag     │     │    │
│  │  └──────────────────────────────────────────────┘     │    │
│  └────────────────────────────────────────────────────────┘    │
│                              ▼                                   │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              theme-utils.ts                             │    │
│  │  • Color conversion (hex ↔ HSL ↔ RGB)                 │    │
│  │  • Theme validation                                     │    │
│  │  • Theme merging                                        │    │
│  │  • Font utilities                                       │    │
│  │  • Cache management                                     │    │
│  │  • Debouncing                                           │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          API Layer                               │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              themes.ts (API Client)                     │    │
│  │  GET    /api/v1/store/themes/active                    │    │
│  │  GET    /api/v1/store/themes                           │    │
│  │  POST   /api/v1/store/themes                           │    │
│  │  PATCH  /api/v1/store/themes/:id                       │    │
│  │  DELETE /api/v1/store/themes/:id                       │    │
│  │  POST   /api/v1/store/themes/:id/activate              │    │
│  │  POST   /api/v1/store/themes/:id/duplicate             │    │
│  │  GET    /api/v1/store/themes/presets                   │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         DOM Layer                                │
│  ┌────────────────────────────────────────────────────────┐    │
│  │           document.documentElement (:root)              │    │
│  │  ┌──────────────────────────────────────────────┐     │    │
│  │  │  CSS Custom Properties                        │     │    │
│  │  │  --primary: 220 100% 50%                      │     │    │
│  │  │  --secondary: 280 100% 50%                    │     │    │
│  │  │  --font-family: 'Inter', sans-serif           │     │    │
│  │  │  --spacing: 1rem                              │     │    │
│  │  │  --radius: 0.375rem                           │     │    │
│  │  │  ... 22+ variables                            │     │    │
│  │  └──────────────────────────────────────────────┘     │    │
│  │  ┌──────────────────────────────────────────────┐     │    │
│  │  │  CSS Classes                                  │     │    │
│  │  │  .layout-standard / .layout-wide              │     │    │
│  │  │  .spacing-normal / .spacing-relaxed           │     │    │
│  │  │  .text-base / .text-lg                        │     │    │
│  │  └──────────────────────────────────────────────┘     │    │
│  │  ┌──────────────────────────────────────────────┐     │    │
│  │  │  <style id="noslag-theme-dynamic">            │     │    │
│  │  │    Generated CSS from theme                   │     │    │
│  │  │  </style>                                     │     │    │
│  │  └──────────────────────────────────────────────┘     │    │
│  │  ┌──────────────────────────────────────────────┐     │    │
│  │  │  <link id="noslag-theme-fonts">               │     │    │
│  │  │    Google Fonts stylesheet                    │     │    │
│  │  │  </link>                                      │     │    │
│  │  └──────────────────────────────────────────────┘     │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Theme Loading Flow

```
User Request
     ↓
ThemeProvider.loadTheme()
     ↓
Check localStorage cache ─────→ Cache hit? → Apply cached theme
     ↓ (miss or stale)                              ↓
Fetch from API                                      │
     ↓                                              │
/api/v1/store/themes/active                         │
     ↓                                              │
Validate theme data                                 │
     ↓                                              │
Cache in localStorage ←─────────────────────────────┘
     ↓
applyTheme(theme)
     ↓
     ├─→ applyThemeColors() → CSS variables
     ├─→ applyTypographyStyles() → Font properties
     ├─→ applyLayoutStyles() → Layout classes
     ├─→ applyComponentStyles() → Component props
     ├─→ loadThemeFonts() → Google Fonts
     └─→ injectThemeCSS() → Dynamic styles
     ↓
Theme Ready ✓
     ↓
Components Re-render with new theme
```

### Theme Update Flow

```
Admin Updates Theme
     ↓
themesApi.updateTheme(id, tenantId, data)
     ↓
PATCH /api/v1/store/themes/:id
     ↓
Backend validates & saves
     ↓
Response with updated theme
     ↓
themesApi.activateTheme(id, tenantId)
     ↓
POST /api/v1/store/themes/:id/activate
     ↓
Backend activates theme
     ↓
refreshTheme() called
     ↓
ThemeProvider fetches new theme
     ↓
Cache invalidated
     ↓
applyTheme() with transition
     ↓
Smooth fade animation (300ms)
     ↓
Theme Applied ✓
```

## Component Structure

```
src/lib/theme/
│
├── Core Files
│   ├── types.ts                  (Type definitions)
│   ├── theme-provider.tsx        (React context & provider)
│   ├── use-theme.ts              (25+ hooks)
│   ├── theme-engine.ts           (DOM manipulation)
│   ├── theme-utils.ts            (Utility functions)
│   └── index.ts                  (Exports)
│
├── Components
│   ├── font-loader.tsx           (Font loading)
│   └── theme-loading.tsx         (Loading UI)
│
├── Examples
│   └── examples/
│       └── themed-card.tsx       (Example components)
│
├── Tests
│   └── __tests__/
│       └── theme-utils.test.ts   (Unit tests)
│
└── Documentation
    ├── README.md                 (Complete docs)
    ├── QUICK_START.md            (Quick reference)
    ├── INTEGRATION.md            (Integration guide)
    └── ARCHITECTURE.md           (This file)
```

## State Management

```
ThemeContext Value
├── theme: Theme | null
│   ├── id: string
│   ├── name: string
│   ├── colors: ThemeColors (22 colors)
│   ├── typography: TypographyConfig
│   ├── layout: LayoutConfig
│   └── components: ComponentStyles
│
├── loading: boolean
├── error: string | null
└── refreshTheme: () => Promise<void>
```

## Caching Strategy

```
Cache Layers:

1. Memory (React State)
   └─ Immediate access
   └─ Lost on unmount

2. localStorage
   └─ Key: noslag-theme-{tenantId}
   └─ Persistent across sessions
   └─ Validated on load
   └─ Fallback if API fails

3. API (Source of Truth)
   └─ Always fresh data
   └─ Fetched on mount
   └─ Fetched on refresh
   └─ Background refresh possible
```

## Performance Optimization

```
Optimization Techniques:

1. CSS Variables
   └─ Instant updates without re-render
   └─ Native browser performance
   └─ Hardware accelerated

2. Memoization
   └─ All hooks use useMemo
   └─ Prevent unnecessary recalculations
   └─ Reference equality checks

3. Lazy Loading
   └─ Fonts loaded async
   └─ Non-blocking
   └─ Progressive enhancement

4. Debouncing
   └─ Theme updates debounced
   └─ Prevent thrashing
   └─ Smooth user experience

5. Code Splitting
   └─ Tree-shakeable exports
   └─ Import only what you need
   └─ Smaller bundles

6. Preloading
   └─ Preload next theme
   └─ Instant switching
   └─ Better UX
```

## Error Handling

```
Error Handling Strategy:

API Error
    ↓
Try cache ──→ Cache valid? → Use cached theme
    ↓ (no cache)
Use default theme
    ↓
Show error message
    ↓
Provide retry option
    ↓
Log error for monitoring
```

## Security Considerations

```
Security Measures:

1. Input Validation
   └─ Validate theme data before applying
   └─ Sanitize custom CSS
   └─ Check color formats

2. Tenant Isolation
   └─ Themes scoped to tenant
   └─ x-tenant-id header required
   └─ No cross-tenant access

3. XSS Prevention
   └─ No inline event handlers
   └─ CSS sanitization
   └─ Content Security Policy compliant

4. CORS
   └─ Proper CORS headers
   └─ Same-origin font loading
   └─ Secure API endpoints
```

## Browser Compatibility

```
Feature Support:

CSS Variables        ✓ Chrome 49+, Firefox 31+, Safari 9.1+
localStorage         ✓ All modern browsers
Google Fonts API     ✓ All modern browsers
Fetch API           ✓ All modern browsers
React 18            ✓ Latest versions

Fallbacks:
• System fonts if Google Fonts fail
• Default theme if load fails
• Graceful degradation
```

## Scalability

```
System Scalability:

1. Theme Count
   └─ Handles unlimited themes
   └─ Pagination in API
   └─ Lazy loading

2. Color Variations
   └─ 22 colors per theme
   └─ Extensible color system
   └─ CSS variable based

3. Component Support
   └─ Universal theming
   └─ Works with any component
   └─ No framework lock-in

4. Performance
   └─ <100ms theme switch
   └─ Minimal re-renders
   └─ Efficient updates
```

## Integration Points

```
Integration Layers:

1. React Components
   └─ Use hooks for theme access
   └─ CSS variables for styling
   └─ Type-safe operations

2. API Backend
   └─ RESTful endpoints
   └─ JSON payloads
   └─ Standard HTTP methods

3. Database
   └─ Theme persistence
   └─ Tenant isolation
   └─ Relational schema

4. CDN (Future)
   └─ Theme asset caching
   └─ Font optimization
   └─ Global distribution
```

## Monitoring & Debugging

```
Debug Tools:

1. React DevTools
   └─ Inspect theme context
   └─ Track state changes
   └─ Profile performance

2. Browser DevTools
   └─ Inspect CSS variables
   └─ Network requests
   └─ Console logging

3. Error Logging
   └─ Theme load failures
   └─ API errors
   └─ Validation errors

4. Performance Metrics
   └─ Theme switch time
   └─ Font load time
   └─ Cache hit rate
```

## Future Architecture

```
Planned Enhancements:

1. Edge Caching
   └─ CDN-based theme delivery
   └─ Instant global access
   └─ Reduced server load

2. Real-time Updates
   └─ WebSocket for theme changes
   └─ Instant preview
   └─ Collaborative editing

3. Advanced Customization
   └─ Custom CSS editor
   └─ Theme inheritance
   └─ A/B testing

4. Analytics
   └─ Theme usage tracking
   └─ Popular colors
   └─ Performance metrics
```

## Conclusion

The theme system is architected for:
- **Performance**: <100ms theme application
- **Reliability**: Multiple fallback layers
- **Scalability**: Handles unlimited themes
- **Maintainability**: Clear separation of concerns
- **Extensibility**: Easy to add features
- **Security**: Input validation & tenant isolation

**Production-ready architecture for enterprise-grade theming!** 🎨
