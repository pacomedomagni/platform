# Onboarding System - Quick Reference

## 🚀 Quick Commands

```bash
# Run database migration
npx prisma migrate dev --name add_onboarding_to_store_customer

# Start development servers
npm run dev:api    # API on :3333
npm run dev:web    # Web on :4200

# Test API endpoints
curl http://localhost:3333/api/v1/store/onboarding/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📁 Key Files

| Type | Path | Purpose |
|------|------|---------|
| Backend Service | `/apps/api/src/app/storefront/onboarding/onboarding.service.ts` | Business logic |
| Backend Controller | `/apps/api/src/app/storefront/onboarding/onboarding.controller.ts` | API endpoints |
| Frontend Store | `/apps/web/src/lib/onboarding-store.ts` | State management |
| Wizard Component | `/apps/web/src/components/onboarding/welcome-wizard.tsx` | Multi-step wizard |
| Checklist Component | `/apps/web/src/components/onboarding/onboarding-checklist.tsx` | Progress tracker |
| Tour Component | `/apps/web/src/components/onboarding/product-tour.tsx` | Interactive tour |
| Database Schema | `/prisma/schema.prisma` | StoreCustomer model |

## 🎯 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/store/onboarding/status` | Get onboarding status |
| POST | `/api/v1/store/onboarding/complete-step` | Complete a step |
| POST | `/api/v1/store/onboarding/update-step` | Update current step |
| POST | `/api/v1/store/onboarding/dismiss` | Dismiss onboarding |
| GET | `/api/v1/store/onboarding/progress` | Get progress % |
| POST | `/api/v1/store/onboarding/update-profile` | Update profile |
| POST | `/api/v1/store/onboarding/reset-tour` | Reset tour flag |

## 💾 Database Fields

```prisma
model StoreCustomer {
  // Onboarding fields
  onboardingCompleted Boolean @default(false)
  onboardingStep String? // welcome, profile, tour, incentive
  profileCompletionScore Int @default(0) // 0-100
  lastOnboardingInteraction DateTime?
  hasViewedProductTour Boolean @default(false)
  hasAddedToCart Boolean @default(false)
  hasCompletedFirstPurchase Boolean @default(false)
  hasAddedShippingAddress Boolean @default(false)
}
```

## 🔧 Store Usage

```typescript
import { useOnboardingStore } from '@/lib/onboarding-store';

// Get state
const { status, showWizard, showTour } = useOnboardingStore();

// Fetch status
const { fetchStatus } = useOnboardingStore();
useEffect(() => {
  fetchStatus();
}, []);

// Complete a step
const { completeStep } = useOnboardingStore();
await completeStep('profile');

// Dismiss onboarding
const { dismissOnboarding } = useOnboardingStore();
await dismissOnboarding();

// Reset tour
const { resetTour } = useOnboardingStore();
await resetTour();
```

## 🎨 Component Usage

```tsx
// Import components
import {
  WelcomeWizard,
  OnboardingChecklist,
  ProductTour
} from '@/components/onboarding';

// Use in layout (auto-managed)
<WelcomeWizard />
<ProductTour />

// Use checklist on account page
<OnboardingChecklist />
```

## 📊 Onboarding Status Structure

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

## 🔄 Wizard Steps

1. **welcome** - Value proposition
2. **profile** - Complete profile form
3. **tour** - Feature overview
4. **incentive** - Discount code

## ✅ Checklist Items

1. Email verified (auto)
2. Profile completed (form)
3. Add to cart (product interaction)
4. First purchase (checkout)
5. Shipping address (account settings)

## 🎯 Tour Targets

1. `#header-search` - Search bar
2. `[href="/storefront/cart"]` - Cart icon
3. `[href="/storefront/account"]` - Account menu
4. `[href="/storefront/products"]` - Products link

## ⚙️ Customization

### Change Discount Code
```tsx
// welcome-wizard.tsx line ~340
const discountCode = 'WELCOME10'; // Change here
```

### Add Tour Step
```tsx
// product-tour.tsx
const TOUR_STEPS: TourStep[] = [
  // ... existing steps
  {
    target: '#my-element',
    title: 'My Feature',
    content: 'Description',
    placement: 'bottom', // top|bottom|left|right
  },
];
```

### Modify Wizard Steps
```tsx
// welcome-wizard.tsx
const STEPS = [
  // Add/modify steps
  {
    id: 'my-step',
    title: 'My Title',
    subtitle: 'My subtitle',
  },
];
```

## 🐛 Debug Commands

```javascript
// Check onboarding state
console.log(useOnboardingStore.getState());

// Check auth state
console.log(useAuthStore.getState());

// Check token
console.log(localStorage.getItem('customer_token'));

// Check session flags
console.log(sessionStorage.getItem('onboarding-wizard-dismissed'));
console.log(sessionStorage.getItem('product-tour-dismissed'));

// Clear all state
localStorage.clear();
sessionStorage.clear();
```

## 🔍 SQL Queries

```sql
-- Check customer onboarding status
SELECT
  email,
  "onboardingCompleted",
  "onboardingStep",
  "profileCompletionScore",
  "hasViewedProductTour"
FROM store_customers
WHERE email = 'customer@example.com';

-- Onboarding completion rate (last 30 days)
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN "onboardingCompleted" THEN 1 ELSE 0 END) as completed,
  ROUND(100.0 * SUM(CASE WHEN "onboardingCompleted" THEN 1 ELSE 0 END) / COUNT(*), 2) as rate
FROM store_customers
WHERE "createdAt" >= NOW() - INTERVAL '30 days';

-- Profile completion distribution
SELECT
  "profileCompletionScore",
  COUNT(*) as count
FROM store_customers
GROUP BY "profileCompletionScore"
ORDER BY "profileCompletionScore";

-- Reset customer onboarding (testing)
UPDATE store_customers
SET
  "onboardingCompleted" = false,
  "onboardingStep" = null,
  "hasViewedProductTour" = false
WHERE email = 'test@example.com';
```

## 🧪 Testing

```bash
# Create test account
curl -X POST http://localhost:3333/api/v1/store/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test1234!",
    "firstName": "Test",
    "lastName": "User"
  }'

# Get status (use token from registration)
curl http://localhost:3333/api/v1/store/onboarding/status \
  -H "Authorization: Bearer YOUR_TOKEN"

# Complete profile step
curl -X POST http://localhost:3333/api/v1/store/onboarding/complete-step \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"step": "profile"}'

# Dismiss onboarding
curl -X POST http://localhost:3333/api/v1/store/onboarding/dismiss \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🚨 Troubleshooting

| Issue | Solution |
|-------|----------|
| Wizard not showing | Check `onboardingCompleted` in DB, clear sessionStorage |
| API 401 errors | Verify JWT token, check expiry |
| Tour not highlighting | Check element selectors exist in DOM |
| State not persisting | Check localStorage enabled, review console errors |
| Profile score wrong | Recalculate: `email + firstName + lastName + phone + emailVerified` |

## 📈 Success Metrics

| Metric | Target | Formula |
|--------|--------|---------|
| Wizard Completion | 70%+ | (completed / started) × 100 |
| Checklist Completion | 60%+ | (all items done / total) × 100 |
| Tour Completion | 50%+ | (finished / started) × 100 |
| Time to First Purchase | -20% | avg(firstPurchaseDate - registrationDate) |

## 🔐 Security Checklist

- [x] JWT auth on all endpoints
- [x] Tenant isolation in queries
- [x] Input validation
- [x] XSS prevention (React)
- [x] CSRF protection
- [x] Rate limiting

## 📚 Related Documentation

- [Full Documentation](./ONBOARDING_SYSTEM.md)
- [Setup Guide](./ONBOARDING_SETUP.md)
- [Implementation Summary](./ONBOARDING_IMPLEMENTATION_SUMMARY.md)
- [Architecture Diagram](./ONBOARDING_ARCHITECTURE.md)

## 💡 Common Tasks

### Add New Wizard Step

1. Add to STEPS array in `welcome-wizard.tsx`
2. Create step component (e.g., `MyStep()`)
3. Add case in switch statement
4. Update step navigation logic

### Add Checklist Item

1. Add field to `StoreCustomer` in schema
2. Run migration
3. Update `OnboardingService.getOnboardingStatus()`
4. Add item to checklist in `onboarding-checklist.tsx`

### Trigger Tour Manually

```typescript
const { setShowTour } = useOnboardingStore();
setShowTour(true);
```

### Skip Wizard Programmatically

```typescript
const { dismissOnboarding } = useOnboardingStore();
await dismissOnboarding();
```

### Check if User Completed Onboarding

```typescript
const { status } = useOnboardingStore();
if (status?.completed) {
  // User finished onboarding
}
```

## 🎨 Styling

### Wizard Colors
- Primary: `from-indigo-600 to-blue-600`
- Accent: `to-amber-400`
- Background: `bg-white`

### Tour Colors
- Spotlight: `rgba(59, 130, 246, 0.5)` (blue)
- Backdrop: `rgba(0, 0, 0, 0.4)`
- Button: `bg-blue-600`

### Checklist Colors
- Complete: `text-green-600`
- Incomplete: `text-slate-300`
- Progress: `from-indigo-600 to-blue-600`

## 🌐 Environment

```bash
# Development
NODE_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:3333

# Production
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://api.yourcompany.com
```

## 📞 Support

- Backend issues: Development Team
- Frontend issues: UI/UX Team
- Database issues: DevOps Team
- Product questions: Product Management

---

**Version**: 1.0.0 | **Last Updated**: 2026-02-06
