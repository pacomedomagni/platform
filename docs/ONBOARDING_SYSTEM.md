# Interactive Onboarding System

## Overview

The NoSlag Storefront features a comprehensive, non-intrusive onboarding system designed to guide new customers through their first experience. The system includes a welcome wizard, progress tracking, and contextual product tours.

## Components

### 1. Welcome Wizard (`welcome-wizard.tsx`)

A multi-step modal wizard shown after first login with:

#### Steps:
1. **Welcome Screen**: Value proposition and key features
2. **Profile Completion**: Optional fields (phone, preferences)
3. **Quick Tour**: Overview of key features
4. **First Purchase Incentive**: 10% discount code (WELCOME10)

#### Features:
- Skip option on each step
- Progress dots showing current step
- Back/Next navigation
- Persistent state in localStorage
- Mobile responsive design
- Keyboard accessible

#### Usage:
```tsx
import { WelcomeWizard } from '@/components/onboarding';

// Automatically shown after first login
// Controlled by onboarding store
<WelcomeWizard />
```

### 2. Onboarding Checklist (`onboarding-checklist.tsx`)

Dashboard widget showing completion percentage with checklist items:

#### Checklist Items:
- ✓ Email verified (auto-check)
- ✓ Profile completed (name, phone)
- Add first item to cart
- Complete first purchase
- Add shipping address

#### Features:
- Progress bar with percentage
- Each item links to relevant page
- Dismiss option when 100% complete
- Real-time updates
- Collapsible design

#### Usage:
```tsx
import { OnboardingChecklist } from '@/components/onboarding';

// Shows on account page for incomplete onboarding
<OnboardingChecklist />
```

### 3. Product Tour (`product-tour.tsx`)

Custom-built interactive tour highlighting key UI elements:

#### Tour Steps:
1. Search bar
2. Cart icon
3. Account menu
4. Product filters

#### Features:
- Spotlight effect on current element
- Contextual tooltips with positioning
- Progress indicators
- Skip/Back/Next navigation
- "Show tour again" option in settings
- Animated transitions

#### Usage:
```tsx
import { ProductTour } from '@/components/onboarding';

// Automatically triggered after onboarding completion
<ProductTour />
```

### 4. Onboarding Store (`onboarding-store.ts`)

Zustand store managing onboarding state:

#### State:
```typescript
interface OnboardingStatus {
  completed: boolean;
  currentStep: string | null;
  profileCompletionScore: number; // 0-100
  checklist: {
    emailVerified: boolean;
    profileCompleted: boolean;
    addedToCart: boolean;
    completedFirstPurchase: boolean;
    addedShippingAddress: boolean;
  };
  hasViewedProductTour: boolean;
}
```

#### Actions:
- `fetchStatus()`: Load onboarding status from API
- `completeStep(step)`: Mark step as completed
- `updateStep(step)`: Update current step
- `dismissOnboarding()`: Complete and hide onboarding
- `updateProfile(data)`: Update profile and recalculate score
- `resetTour()`: Show product tour again

#### Usage:
```tsx
import { useOnboardingStore } from '@/lib/onboarding-store';

function MyComponent() {
  const { status, fetchStatus, completeStep } = useOnboardingStore();

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleComplete = async () => {
    await completeStep('cart');
  };
}
```

## Backend API

### Database Schema

Added to `StoreCustomer` model:

```prisma
model StoreCustomer {
  // ... existing fields

  // Onboarding tracking
  onboardingCompleted Boolean @default(false)
  onboardingStep String? // welcome, profile, tour, incentive, completed
  profileCompletionScore Int @default(0) // 0-100
  lastOnboardingInteraction DateTime?
  hasViewedProductTour Boolean @default(false)
  hasAddedToCart Boolean @default(false)
  hasCompletedFirstPurchase Boolean @default(false)
  hasAddedShippingAddress Boolean @default(false)
}
```

### API Endpoints

#### GET `/api/v1/store/onboarding/status`
Get current onboarding status for authenticated customer.

**Response:**
```json
{
  "completed": false,
  "currentStep": "profile",
  "profileCompletionScore": 60,
  "checklist": {
    "emailVerified": true,
    "profileCompleted": false,
    "addedToCart": false,
    "completedFirstPurchase": false,
    "addedShippingAddress": false
  },
  "hasViewedProductTour": false
}
```

#### POST `/api/v1/store/onboarding/complete-step`
Mark a specific onboarding step as completed.

**Request Body:**
```json
{
  "step": "profile"
}
```

**Response:**
```json
{
  "completed": false,
  "currentStep": "tour",
  "profileCompletionScore": 100,
  "checklist": { ... },
  "hasViewedProductTour": false
}
```

#### POST `/api/v1/store/onboarding/update-step`
Update current onboarding step (wizard navigation).

**Request Body:**
```json
{
  "step": "tour"
}
```

#### POST `/api/v1/store/onboarding/dismiss`
Mark onboarding as completed and dismiss all prompts.

#### GET `/api/v1/store/onboarding/progress`
Get onboarding completion percentage.

**Response:**
```json
{
  "progress": 60
}
```

#### POST `/api/v1/store/onboarding/update-profile`
Update customer profile and recalculate completion score.

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1 (555) 000-0000"
}
```

#### POST `/api/v1/store/onboarding/reset-tour`
Reset product tour to allow viewing again.

### Services

#### `OnboardingService`

Located at: `/apps/api/src/app/storefront/onboarding/onboarding.service.ts`

**Methods:**
- `getOnboardingStatus(tenantId, customerId)`: Get complete onboarding status
- `updateOnboardingStep(tenantId, customerId, step)`: Update current step
- `completeStep(tenantId, customerId, step)`: Complete specific step
- `dismissOnboarding(tenantId, customerId)`: Mark as completed
- `getProgress(tenantId, customerId)`: Calculate progress percentage
- `updateProfile(tenantId, customerId, data)`: Update profile
- `resetProductTour(tenantId, customerId)`: Reset tour flag
- `calculateProfileScore(customer)`: Calculate completion score (0-100)

#### `OnboardingController`

Located at: `/apps/api/src/app/storefront/onboarding/onboarding.controller.ts`

All endpoints require JWT authentication via `JwtAuthGuard`.

## Integration

### 1. After Registration

When a customer registers, onboarding is automatically initialized:

```typescript
// In auth-store.ts
register: async (data) => {
  const response = await authApi.register(data);
  // ... set auth state

  // Initialize onboarding
  setTimeout(() => {
    useOnboardingStore.getState().fetchStatus();
  }, 500);
}
```

### 2. Layout Integration

The wizard and tour are included in the storefront layout:

```tsx
// In /app/storefront/layout.tsx
export default function StorefrontLayout({ children }) {
  return (
    <StoreProviders>
      {/* ... header */}
      <main>{children}</main>

      {/* Onboarding Components */}
      <WelcomeWizard />
      <ProductTour />
    </StoreProviders>
  );
}
```

### 3. Account Page

The checklist is shown on the account page:

```tsx
// In /app/storefront/account/page.tsx
export default function AccountPage() {
  return (
    <div>
      {/* Email Verification Banner */}
      <EmailVerificationBanner />

      {/* Onboarding Checklist */}
      <OnboardingChecklist />

      {/* ... profile, menu items */}

      {/* Show Tour Again Option */}
      <Card>
        <button onClick={() => resetTour()}>
          Start Tour
        </button>
      </Card>
    </div>
  );
}
```

### 4. Store Providers

Onboarding status is fetched automatically for authenticated users:

```tsx
// In store-providers.tsx
export function StoreProviders({ children }) {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const fetchOnboardingStatus = useOnboardingStore(state => state.fetchStatus);

  useEffect(() => {
    if (isAuthenticated) {
      fetchOnboardingStatus();
    }
  }, [isAuthenticated]);

  return <>{children}</>;
}
```

## Trigger Logic

### Welcome Wizard

Shown when:
- Customer is authenticated
- `onboardingCompleted` is `false`
- Current step is not `'completed'`
- Not dismissed in current session (sessionStorage check)

### Product Tour

Shown when:
- Customer is authenticated
- Onboarding is completed
- `hasViewedProductTour` is `false`
- Not dismissed in current session
- Delayed by 2 seconds after page load

### Checklist

Shown when:
- Customer is authenticated
- `onboardingCompleted` is `false`
- On account page or dashboard

## Analytics Events

Track these events for insights:

```typescript
// Wizard
analytics.track('onboarding_wizard_viewed', { step: 'welcome' });
analytics.track('onboarding_wizard_completed');
analytics.track('onboarding_wizard_skipped', { step: 'profile' });

// Checklist
analytics.track('onboarding_checklist_item_completed', { item: 'emailVerified' });
analytics.track('onboarding_progress_updated', { progress: 60 });

// Tour
analytics.track('product_tour_started');
analytics.track('product_tour_step_viewed', { step: 1 });
analytics.track('product_tour_completed');
analytics.track('product_tour_skipped', { step: 2 });
```

## Customization

### Change Discount Code

Edit in `welcome-wizard.tsx`:

```tsx
const discountCode = 'WELCOME10'; // Change here
```

### Modify Tour Steps

Edit in `product-tour.tsx`:

```tsx
const TOUR_STEPS: TourStep[] = [
  {
    target: '#element-id', // CSS selector
    title: 'Feature Title',
    content: 'Description of the feature',
    placement: 'bottom', // top, bottom, left, right
  },
  // Add more steps
];
```

### Adjust Checklist Items

Edit in `onboarding-checklist.tsx`:

```tsx
const checklistItems = [
  {
    id: 'emailVerified',
    label: 'Verify your email',
    completed: checklist.emailVerified,
    href: '/storefront/account',
    description: 'Check your inbox',
  },
  // Add/modify items
];
```

## Testing

### Manual Testing Checklist

1. **Registration Flow**
   - [ ] Register new account
   - [ ] Wizard appears automatically
   - [ ] Can navigate through all steps
   - [ ] Can skip wizard
   - [ ] Profile updates save correctly
   - [ ] Discount code is displayed

2. **Onboarding Checklist**
   - [ ] Appears on account page
   - [ ] Items update in real-time
   - [ ] Progress bar animates correctly
   - [ ] Dismiss button works
   - [ ] Links navigate to correct pages

3. **Product Tour**
   - [ ] Tour starts automatically (if applicable)
   - [ ] Spotlight highlights correct elements
   - [ ] Tooltips position correctly
   - [ ] Can navigate back/forward
   - [ ] Can skip tour
   - [ ] "Show tour again" works

4. **State Persistence**
   - [ ] Wizard step persists on refresh
   - [ ] Dismissal persists in session
   - [ ] Onboarding status syncs across tabs
   - [ ] Tour completion is remembered

### API Testing

```bash
# Get onboarding status
curl -X GET http://localhost:3333/api/v1/store/onboarding/status \
  -H "Authorization: Bearer YOUR_TOKEN"

# Complete a step
curl -X POST http://localhost:3333/api/v1/store/onboarding/complete-step \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"step": "profile"}'

# Dismiss onboarding
curl -X POST http://localhost:3333/api/v1/store/onboarding/dismiss \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Migration

To add onboarding to existing customers:

```bash
# Run Prisma migration
npx prisma migrate dev --name add_onboarding_fields

# Or in production
npx prisma migrate deploy
```

The new fields have sensible defaults, so existing customers will have:
- `onboardingCompleted: false`
- `profileCompletionScore: 0`
- All checklist flags: `false`

## Troubleshooting

### Wizard doesn't appear

1. Check authentication status
2. Verify `onboardingCompleted` is `false` in database
3. Clear sessionStorage: `sessionStorage.removeItem('onboarding-wizard-dismissed')`
4. Check browser console for errors

### Tour elements not highlighting

1. Verify target selectors exist in DOM
2. Check z-index conflicts
3. Ensure elements are visible when tour starts
4. Review browser console for warnings

### API requests failing

1. Verify JWT token is valid
2. Check CORS configuration
3. Ensure onboarding module is imported in `storefront.module.ts`
4. Review API logs for errors

### State not persisting

1. Check localStorage is enabled
2. Verify Zustand persist middleware is configured
3. Clear localStorage and test fresh: `localStorage.clear()`
4. Check for serialization errors in console

## Performance Considerations

- Wizard uses dynamic imports to reduce initial bundle size
- Tour positioning recalculates only on resize/scroll
- Checklist fetches status once on mount, updates via store
- Local state persists to minimize API calls
- Session storage prevents repeated prompts

## Accessibility

- Keyboard navigation supported (Tab, Enter, Esc)
- ARIA labels on all interactive elements
- Focus management in modal dialogs
- Screen reader announcements for progress
- High contrast mode compatible
- Reduced motion respects user preferences

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Future Enhancements

1. **A/B Testing**: Test different wizard flows and messaging
2. **Personalization**: Customize based on user segment
3. **Video Walkthroughs**: Embed tutorial videos
4. **Gamification**: Add badges and rewards for completion
5. **Smart Timing**: Show tour based on user behavior
6. **Multi-language**: Translate onboarding content
7. **Admin Dashboard**: View onboarding completion metrics
8. **Email Sequences**: Send follow-up emails for incomplete steps

## License

Copyright © 2026 NoSlag. All rights reserved.
