# Full Theme System Implementation Plan

## Overview
Implement a comprehensive theme system allowing tenants to customize their storefront appearance with pre-built themes or custom configurations.

## Architecture

### 1. Database Schema

```prisma
model StoreTheme {
  id String @id @default(uuid())
  tenantId String
  tenant Tenant @relation(...)

  name String
  slug String // minimal, bold, classic, modern, custom
  isActive Boolean @default(false)
  isCustom Boolean @default(false)

  // Color Scheme
  colors Json // Full color palette

  // Typography
  fontFamily String @default("Inter")
  headingFont String?
  fontSize String @default("base") // sm, base, lg

  // Layout
  layoutStyle String @default("standard") // standard, wide, boxed
  headerStyle String @default("classic") // classic, minimal, centered
  spacing String @default("comfortable") // compact, comfortable, spacious

  // Components
  buttonStyle String @default("rounded") // rounded, square, pill
  cardStyle String @default("shadow") // shadow, border, flat

  // Advanced
  customCSS String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([tenantId, slug])
  @@index([tenantId, isActive])
}
```

### 2. Pre-built Themes

#### Theme 1: Modern (Default)
- **Colors**: Indigo/Blue/Amber gradients
- **Layout**: Wide, spacious
- **Style**: Contemporary with gradients
- **Best for**: Tech, SaaS products

#### Theme 2: Minimal
- **Colors**: Black/White/Gray
- **Layout**: Centered, clean
- **Style**: Ultra-minimal, typography-focused
- **Best for**: Fashion, luxury goods

#### Theme 3: Bold
- **Colors**: High contrast, vivid colors
- **Layout**: Full-width sections
- **Style**: Large typography, statement pieces
- **Best for**: Creative, lifestyle brands

#### Theme 4: Classic
- **Colors**: Navy/Gold/Cream
- **Layout**: Traditional grid
- **Style**: Serif fonts, elegant
- **Best for**: Professional, traditional businesses

### 3. Theme Customizer Features

#### Basic Customization
- Color scheme selector (primary, secondary, accent)
- Font family picker (Google Fonts integration)
- Font size adjustment (3 presets)
- Spacing controls (3 levels)

#### Layout Options
- Header style (3 variations)
- Footer style (2 variations)
- Product grid (2, 3, or 4 columns)
- Layout width (boxed, standard, wide)

#### Component Styling
- Button styles (rounded, square, pill)
- Card styles (shadow, border, flat)
- Badge styles
- Input styles

#### Advanced
- Custom CSS injection
- Logo upload
- Favicon upload
- Brand color picker

### 4. Implementation Phases

#### Phase 1: Backend (Days 1-2)
- Database schema and migrations
- Theme CRUD API
- Theme preset seeding
- Apply theme logic

#### Phase 2: Theme Engine (Days 3-4)
- CSS variable system
- Theme provider component
- Dynamic stylesheet generation
- Font loading system

#### Phase 3: Admin UI (Days 5-7)
- Theme selection page
- Theme customizer interface
- Live preview
- Save/reset functionality

#### Phase 4: Storefront Integration (Days 8-9)
- Apply theme to storefront
- Font loading
- CSS variables injection
- Theme-specific components

#### Phase 5: Advanced Features (Days 10-12)
- Custom CSS editor
- Logo/favicon upload
- Export/import themes
- Theme duplication

### 5. Technical Stack

**Backend:**
- NestJS services
- Prisma ORM
- JSON for flexible config

**Frontend:**
- Next.js with CSS variables
- Tailwind CSS (dynamic)
- Zustand for theme state
- React Context for theme provider

**Storage:**
- MinIO for logo/favicon
- Database for theme config
- CDN for Google Fonts

### 6. API Endpoints

```
GET    /api/v1/store/themes              - List all themes
GET    /api/v1/store/themes/active       - Get active theme
GET    /api/v1/store/themes/:id          - Get theme by ID
POST   /api/v1/store/themes              - Create custom theme
PUT    /api/v1/store/themes/:id          - Update theme
DELETE /api/v1/store/themes/:id          - Delete custom theme
POST   /api/v1/store/themes/:id/activate - Set as active theme
POST   /api/v1/store/themes/:id/preview  - Generate preview
GET    /api/v1/store/themes/presets      - Get preset themes
POST   /api/v1/store/themes/duplicate    - Duplicate theme
```

### 7. UI Components

**Admin:**
- Theme gallery (grid of theme cards)
- Theme customizer modal
- Color picker
- Font selector
- Preview iframe
- CSS editor (Monaco)

**Storefront:**
- Theme provider wrapper
- Dynamic CSS injection
- Font loader component

### 8. Success Metrics

- Theme switching < 1s
- Customizer updates real-time
- Preview accurate to production
- No layout shift on theme change
- Mobile responsive themes
- Accessible (WCAG AA)

### 9. Future Enhancements

- Theme marketplace
- Community themes
- Theme analytics
- A/B testing themes
- Seasonal themes
- Theme scheduling

## File Structure

```
/apps/api/src/app/storefront/themes/
  - themes.service.ts
  - themes.controller.ts
  - themes.module.ts
  - dto/
    - create-theme.dto.ts
    - update-theme.dto.ts
  - presets/
    - modern.preset.ts
    - minimal.preset.ts
    - bold.preset.ts
    - classic.preset.ts

/apps/web/src/
  - lib/theme/
    - theme-provider.tsx
    - theme-engine.ts
    - use-theme.hook.ts
  - app/app/themes/
    - page.tsx (theme gallery)
    - [id]/page.tsx (theme customizer)
  - components/themes/
    - theme-card.tsx
    - color-picker.tsx
    - font-selector.tsx
    - preview-frame.tsx
    - css-editor.tsx
```

## Implementation Start

Starting with Phase 1: Backend foundation...
