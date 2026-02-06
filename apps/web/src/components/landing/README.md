# NoSlag Landing Page Components

This directory contains all the components for the high-converting marketing landing page.

## Components Overview

### Hero Section (`hero-section.tsx`)
- Compelling headline with gradient text effect
- Two prominent CTAs (Start Free Trial, Watch Demo)
- Animated gradient background with grid pattern
- Trust badges (SOC 2, WCAG AA, 99.9% Uptime)
- Dashboard preview mockup
- Video modal for demo playback

### Features Grid (`features-grid.tsx`)
- 8 key features in responsive grid layout (3 columns on desktop, 1 on mobile)
- Animated icon cards with hover effects
- Feature highlights:
  - Multi-Tenant Architecture
  - Inventory Management
  - Order Processing
  - Customer Portal
  - Payment Processing
  - Email Automation
  - Admin Dashboard
  - Accessibility First
- Additional stats callout section

### Testimonials (`testimonials.tsx`)
- 3 customer testimonial cards with 5-star ratings
- Quote styling with avatar initials
- Company logo showcase (6 placeholder brands)
- Stats counter (Products, Orders, Uptime, Rating)
- Staggered animation on scroll

### How It Works (`how-it-works.tsx`)
- 3-step process visualization
- Alternating left/right layout for visual interest
- Icon-based step indicators
- Feature lists for each step
- Arrow connectors between steps
- Steps: Sign Up → Configure → Launch

### Pricing Table (`pricing-table.tsx`)
- 3 pricing tiers: Starter ($49), Professional ($149), Enterprise (Custom)
- Featured tier with "Most Popular" badge
- Detailed feature comparison
- CTA buttons for each tier
- Additional info section (all plans include...)
- Full comparison table at bottom
- Money-back guarantee messaging

### FAQ Accordion (`faq-accordion.tsx`)
- 8 common questions with expandable answers
- Smooth accordion animation
- First question open by default
- Contact support CTA at bottom
- Questions cover: setup time, technical knowledge, data migration, payments, security, support, trial, plan changes

### CTA Section (`cta-section.tsx`)
- Final conversion section with bold headline
- Two CTAs: Start Free Trial + Schedule Demo
- Trust indicators (14-day trial, no credit card, cancel anytime)
- Gradient background matching hero section

### Footer (`footer.tsx`)
- Newsletter signup form with success state
- 4 column link sections (Product, Company, Resources, Legal)
- Social media links (Twitter, LinkedIn, GitHub, Facebook)
- Logo and copyright information
- Responsive layout (2 cols mobile, 4 cols desktop)

## Design Features

### Animations
- Powered by Framer Motion
- Fade in on scroll with staggered delays
- Smooth hover effects and transitions
- Respects `prefers-reduced-motion`

### Accessibility
- WCAG 2.1 AA compliant
- Semantic HTML structure
- High contrast ratios
- Keyboard navigation support
- Focus visible styles
- Screen reader friendly

### Responsive Design
- Mobile-first approach
- Breakpoints: sm (640px), md (768px), lg (1024px)
- Touch-friendly tap targets
- Optimized typography scales

### Color Palette
- Primary: Blue (#3b82f6)
- Secondary: Purple (#9333ea)
- Accent: Pink (#ec4899)
- Gradients: Blue → Purple → Pink
- Backgrounds: Slate shades
- Text: Slate-900 (headings), Slate-600 (body)

### Typography
- System font stack
- Bold headings (font-bold, font-semibold)
- Optimized line heights for readability
- Responsive text sizing

## SEO Implementation

The main landing page (`/app/landing/page.tsx`) includes:

### Meta Tags
- Title: "NoSlag - Enterprise E-Commerce Platform | Multi-Tenant SaaS"
- Description optimized for search engines
- Keywords array for relevant search terms
- Author and publisher metadata

### Open Graph
- Full OG tags for social media sharing
- Twitter Card configuration
- 1200x630 preview image support

### Structured Data (JSON-LD)
- SoftwareApplication schema
- Organization schema
- Pricing information
- Feature list
- Aggregate ratings

### Technical SEO
- Semantic HTML5 elements
- Proper heading hierarchy (h1 → h6)
- Alt text for images (where applicable)
- Canonical URL
- Robots meta directives

## Performance Optimizations

1. Lazy loading for animations (viewport triggers)
2. CSS-only effects where possible
3. Optimized component bundles
4. No unnecessary re-renders
5. Efficient scroll event handling

## Usage

Import the main page at `/landing` route:

```typescript
import LandingPage from '@/app/landing/page';
```

Or navigate to: `http://localhost:3000/landing`

## Customization

To customize the landing page:

1. Update content in each component file
2. Modify color gradients in Tailwind classes
3. Replace placeholder testimonials and logos
4. Add real demo video URL in hero section
5. Update pricing tiers and features
6. Customize FAQ questions and answers
7. Add real social media links in footer

## Dependencies

- `framer-motion`: ^11.x - Animation library
- `lucide-react`: Icons
- `@platform/ui`: Shared UI components
- `next`: App routing and metadata
- `tailwindcss`: Styling

## Browser Support

- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Mobile browsers (iOS Safari, Chrome Android)

## Conversion Optimization Features

1. Multiple CTAs throughout page
2. Social proof (testimonials, stats, logos)
3. Trust badges and security indicators
4. Clear value proposition
5. Risk reversal (free trial, money-back)
6. Urgency and scarcity elements
7. Feature/benefit clarity
8. Visual hierarchy
9. Mobile optimization
10. Fast loading times
