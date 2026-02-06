# Onboarding System Architecture

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER REGISTRATION                            │
│                              ↓                                       │
│                    POST /api/v1/store/auth/register                 │
│                              ↓                                       │
│                    [Customer Created in DB]                          │
│                              ↓                                       │
│           onboardingCompleted: false (default)                       │
│           onboardingStep: null                                       │
│           profileCompletionScore: 0                                  │
└─────────────────────────────────────────────────────────────────────┘

                              ↓

┌─────────────────────────────────────────────────────────────────────┐
│                    FRONTEND INITIALIZATION                           │
│                                                                      │
│  StoreProviders (on mount)                                           │
│    ├─ useAuthStore.loadProfile()                                     │
│    ├─ useCartStore.initCart()                                        │
│    └─ useOnboardingStore.fetchStatus()  ← Triggered on auth         │
│              ↓                                                       │
│       GET /api/v1/store/onboarding/status                            │
│              ↓                                                       │
│       {                                                              │
│         completed: false,                                            │
│         currentStep: null,                                           │
│         profileCompletionScore: 20,                                  │
│         checklist: {...},                                            │
│         hasViewedProductTour: false                                  │
│       }                                                              │
└─────────────────────────────────────────────────────────────────────┘

                              ↓

┌─────────────────────────────────────────────────────────────────────┐
│                      WELCOME WIZARD FLOW                             │
│                                                                      │
│  Step 1: Welcome                                                     │
│    ├─ Show value proposition                                         │
│    ├─ Display key features                                           │
│    └─ [Next] → POST /api/v1/store/onboarding/update-step            │
│                     {step: "profile"}                                │
│                              ↓                                       │
│  Step 2: Profile                                                     │
│    ├─ First Name input                                               │
│    ├─ Last Name input                                                │
│    ├─ Phone input                                                    │
│    └─ [Next] → POST /api/v1/store/onboarding/update-profile         │
│                     {firstName, lastName, phone}                     │
│                              ↓                                       │
│  Step 3: Tour Overview                                               │
│    ├─ Explain search, cart, account                                  │
│    ├─ "Start tour" option                                            │
│    └─ [Next] → POST /api/v1/store/onboarding/update-step            │
│                     {step: "incentive"}                              │
│                              ↓                                       │
│  Step 4: Incentive                                                   │
│    ├─ Display discount code: WELCOME10                               │
│    ├─ Explain how to use                                             │
│    └─ [Get Started] → POST /api/v1/store/onboarding/dismiss         │
│                              ↓                                       │
│                    [Wizard Hidden]                                   │
│              onboardingCompleted: true                               │
└─────────────────────────────────────────────────────────────────────┘

                              ↓

┌─────────────────────────────────────────────────────────────────────┐
│                      PRODUCT TOUR FLOW                               │
│                                                                      │
│  Auto-trigger after onboarding (if hasViewedProductTour: false)     │
│                              ↓                                       │
│  Delay 2 seconds                                                     │
│                              ↓                                       │
│  Show spotlight on elements:                                         │
│    1. Search Bar (#header-search)                                    │
│         ↓                                                            │
│    2. Cart Icon ([href="/storefront/cart"])                          │
│         ↓                                                            │
│    3. Account Menu ([href="/storefront/account"])                    │
│         ↓                                                            │
│    4. Products Link ([href="/storefront/products"])                  │
│         ↓                                                            │
│  [Finish] → POST /api/v1/store/onboarding/complete-step             │
│                 {step: "tour"}                                       │
│                              ↓                                       │
│            hasViewedProductTour: true                                │
└─────────────────────────────────────────────────────────────────────┘

                              ↓

┌─────────────────────────────────────────────────────────────────────┐
│                   ONBOARDING CHECKLIST                               │
│                   (Visible on Account Page)                          │
│                                                                      │
│  [✓] Email verified                                                  │
│      ← Updated by email verification flow                            │
│                                                                      │
│  [✓] Profile completed                                               │
│      ← profileCompletionScore === 100                                │
│                                                                      │
│  [ ] Add first item to cart                                          │
│      → Link to /storefront/products                                  │
│      ← POST /api/v1/store/onboarding/complete-step {step: "cart"}   │
│                                                                      │
│  [ ] Complete first purchase                                         │
│      → Link to /storefront/cart                                      │
│      ← Auto-updated on order creation                                │
│                                                                      │
│  [ ] Add shipping address                                            │
│      → Link to /storefront/account/addresses                         │
│      ← Auto-updated on address creation                              │
│                                                                      │
│  Progress: 40% ████████░░░░░░░░░                                     │
│                                                                      │
│  [Dismiss] → POST /api/v1/store/onboarding/dismiss                  │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Hierarchy

```
StorefrontLayout
├─ StoreProviders
│  ├─ Initialize Auth
│  ├─ Initialize Cart
│  └─ Initialize Onboarding ← Fetch status on mount
│
├─ Header
│  ├─ Search Bar (tour target)
│  ├─ Cart Icon (tour target)
│  └─ Account Menu (tour target)
│
├─ Main Content
│  └─ {children}
│
├─ Footer
│
└─ Onboarding Components
   ├─ WelcomeWizard
   │  └─ Controlled by useOnboardingStore.showWizard
   │
   └─ ProductTour
      └─ Controlled by useOnboardingStore.showTour
```

## State Management Flow

```
┌──────────────────────────────────────┐
│      useOnboardingStore              │
│                                      │
│  State:                              │
│  ├─ status: OnboardingStatus | null  │
│  ├─ showWizard: boolean              │
│  ├─ showTour: boolean                │
│  └─ isLoading: boolean               │
│                                      │
│  Actions:                            │
│  ├─ fetchStatus()                    │
│  ├─ completeStep(step)               │
│  ├─ updateStep(step)                 │
│  ├─ dismissOnboarding()              │
│  ├─ updateProfile(data)              │
│  └─ resetTour()                      │
└──────────────────────────────────────┘
         ↓              ↑
         ↓              ↑
    API Calls      State Updates
         ↓              ↑
         ↓              ↑
┌──────────────────────────────────────┐
│     OnboardingController              │
│                                      │
│  Endpoints:                          │
│  ├─ GET /status                      │
│  ├─ POST /complete-step              │
│  ├─ POST /update-step                │
│  ├─ POST /dismiss                    │
│  ├─ GET /progress                    │
│  ├─ POST /update-profile             │
│  └─ POST /reset-tour                 │
└──────────────────────────────────────┘
         ↓              ↑
         ↓              ↑
    Service Calls  Return Data
         ↓              ↑
         ↓              ↑
┌──────────────────────────────────────┐
│      OnboardingService               │
│                                      │
│  Methods:                            │
│  ├─ getOnboardingStatus()            │
│  ├─ updateOnboardingStep()           │
│  ├─ completeStep()                   │
│  ├─ dismissOnboarding()              │
│  ├─ getProgress()                    │
│  ├─ updateProfile()                  │
│  ├─ resetProductTour()               │
│  └─ calculateProfileScore()          │
└──────────────────────────────────────┘
         ↓              ↑
         ↓              ↑
    DB Queries     Query Results
         ↓              ↑
         ↓              ↑
┌──────────────────────────────────────┐
│         Database (Prisma)            │
│                                      │
│  StoreCustomer:                      │
│  ├─ onboardingCompleted              │
│  ├─ onboardingStep                   │
│  ├─ profileCompletionScore           │
│  ├─ lastOnboardingInteraction        │
│  ├─ hasViewedProductTour             │
│  ├─ hasAddedToCart                   │
│  ├─ hasCompletedFirstPurchase        │
│  └─ hasAddedShippingAddress          │
└──────────────────────────────────────┘
```

## Data Flow Examples

### Example 1: New User Registration

```
1. POST /api/v1/store/auth/register
   ↓
2. Create customer in DB (onboardingCompleted: false)
   ↓
3. Return JWT token
   ↓
4. Frontend sets token in localStorage
   ↓
5. useAuthStore triggers onboarding fetch
   ↓
6. GET /api/v1/store/onboarding/status
   ↓
7. Return {completed: false, currentStep: null, ...}
   ↓
8. useOnboardingStore.setStatus() triggers showWizard: true
   ↓
9. WelcomeWizard renders
```

### Example 2: Completing Wizard Profile Step

```
1. User fills in profile form
   ↓
2. User clicks "Next"
   ↓
3. POST /api/v1/store/onboarding/update-profile
   Body: {firstName: "John", lastName: "Doe", phone: "+1..."}
   ↓
4. OnboardingService.updateProfile()
   ↓
5. Update customer in DB
   ↓
6. Calculate new profileCompletionScore (0-100)
   ↓
7. Return updated status
   ↓
8. Frontend updates store state
   ↓
9. Checklist reflects new completion percentage
```

### Example 3: Starting Product Tour

```
1. User clicks "Start Tour" on account page
   ↓
2. useOnboardingStore.resetTour()
   ↓
3. POST /api/v1/store/onboarding/reset-tour
   ↓
4. Update hasViewedProductTour: false in DB
   ↓
5. Return success
   ↓
6. Frontend sets showTour: true
   ↓
7. ProductTour component renders
   ↓
8. Highlight first element (#header-search)
   ↓
9. User navigates through steps
   ↓
10. User clicks "Finish"
    ↓
11. POST /api/v1/store/onboarding/complete-step {step: "tour"}
    ↓
12. Update hasViewedProductTour: true in DB
    ↓
13. Return updated status
    ↓
14. Frontend hides tour
```

## Security Architecture

```
┌────────────────────────────────────────┐
│         Frontend (Next.js)             │
│                                        │
│  1. Get JWT from localStorage          │
│  2. Add to Authorization header        │
│     "Bearer eyJhbGc..."                │
└────────────────────────────────────────┘
                  ↓
┌────────────────────────────────────────┐
│      API Gateway / NestJS              │
│                                        │
│  3. JwtAuthGuard intercepts request    │
│  4. Verify JWT signature               │
│  5. Extract customerId and tenantId    │
│  6. Attach to request.user             │
└────────────────────────────────────────┘
                  ↓
┌────────────────────────────────────────┐
│       OnboardingController             │
│                                        │
│  7. Access req.user.customerId         │
│  8. Pass to service with tenantId      │
└────────────────────────────────────────┘
                  ↓
┌────────────────────────────────────────┐
│        OnboardingService               │
│                                        │
│  9. Query with WHERE clauses:          │
│     - customerId: req.user.customerId  │
│     - tenantId: req.user.tenantId      │
│  10. Ensures tenant isolation          │
└────────────────────────────────────────┘
                  ↓
┌────────────────────────────────────────┐
│           Database                     │
│                                        │
│  11. Return only customer's data       │
│  12. No cross-tenant leaks             │
└────────────────────────────────────────┘
```

## Persistence Strategy

```
┌─────────────────────────────────────────────┐
│              State Type                     │
├─────────────────────────────────────────────┤
│                                             │
│  Server State (Database):                   │
│  ├─ onboardingCompleted                     │
│  ├─ onboardingStep                          │
│  ├─ profileCompletionScore                  │
│  ├─ lastOnboardingInteraction               │
│  ├─ hasViewedProductTour                    │
│  ├─ hasAddedToCart                          │
│  ├─ hasCompletedFirstPurchase               │
│  └─ hasAddedShippingAddress                 │
│      ↓ Synced via API                       │
│                                             │
│  Client State (Zustand + localStorage):     │
│  ├─ status (persisted)                      │
│  ├─ showWizard (session)                    │
│  └─ showTour (session)                      │
│      ↓ UI-only state                        │
│                                             │
│  Session State (sessionStorage):            │
│  ├─ onboarding-wizard-dismissed             │
│  └─ product-tour-dismissed                  │
│      ↓ Reset on browser restart             │
└─────────────────────────────────────────────┘
```

## Event Flow Timeline

```
Time    Event
────────────────────────────────────────────────────────
T+0s    User registers account
T+0.5s  JWT token received
T+0.5s  Redirect to storefront
T+1s    StoreProviders mount
T+1s    fetchOnboardingStatus()
T+1.5s  API returns status
T+1.5s  setStatus() called
T+1.5s  showWizard: true
T+1.6s  WelcomeWizard renders (fade-in)
T+5s    User clicks "Next"
T+5s    POST /update-step
T+5.5s  Wizard shows step 2
T+10s   User fills profile
T+10s   User clicks "Next"
T+10s   POST /update-profile
T+11s   Profile saved, score updated
T+11s   Wizard shows step 3
T+15s   User clicks "Next"
T+15s   Wizard shows step 4
T+20s   User clicks "Get Started"
T+20s   POST /dismiss
T+21s   onboardingCompleted: true
T+21s   Wizard fades out
T+23s   Tour auto-starts (2s delay)
T+23s   Spotlight on search bar
T+25s   User clicks "Next"
T+25s   Spotlight on cart icon
T+27s   User clicks "Next"
T+27s   Spotlight on account menu
T+29s   User clicks "Next"
T+29s   Spotlight on products link
T+31s   User clicks "Finish"
T+31s   POST /complete-step {step: "tour"}
T+32s   hasViewedProductTour: true
T+32s   Tour fades out
T+32s   Onboarding complete!
```

## Scalability Considerations

```
┌─────────────────────────────────────────┐
│         Load Balancer                   │
└─────────────────────────────────────────┘
            ↓         ↓         ↓
┌───────────┐  ┌───────────┐  ┌───────────┐
│  API 1    │  │  API 2    │  │  API 3    │
└───────────┘  └───────────┘  └───────────┘
            ↓         ↓         ↓
┌─────────────────────────────────────────┐
│        Database (PostgreSQL)            │
│                                         │
│  - Single source of truth               │
│  - Indexed queries for performance      │
│  - Read replicas for scale              │
└─────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────┐
│         Redis Cache (Optional)          │
│                                         │
│  - Cache onboarding status              │
│  - TTL: 5 minutes                       │
│  - Invalidate on update                 │
└─────────────────────────────────────────┘
```

## Error Handling

```
Frontend Error Handling:
├─ API Call Fails
│  ├─ Retry up to 3 times
│  ├─ Show error toast
│  └─ Log to error tracking (Sentry)
│
├─ Network Timeout
│  ├─ Show "Check connection" message
│  └─ Allow manual retry
│
└─ Invalid Response
   ├─ Log unexpected format
   ├─ Use cached state
   └─ Notify user gracefully

Backend Error Handling:
├─ Validation Errors
│  └─ Return 400 with details
│
├─ Authentication Errors
│  └─ Return 401 with message
│
├─ Database Errors
│  ├─ Log to monitoring
│  ├─ Return 500
│  └─ Rollback transaction
│
└─ Business Logic Errors
   └─ Return 422 with reason
```

## Monitoring Points

```
Application Metrics:
├─ Wizard Views
├─ Wizard Completions
├─ Step Drop-off Rates
├─ Average Time per Step
├─ Skip Rate
├─ Tour Starts
├─ Tour Completions
└─ Checklist Progress

Technical Metrics:
├─ API Response Times
├─ Error Rates
├─ Database Query Performance
├─ Cache Hit Rates
└─ Frontend Bundle Size

Business Metrics:
├─ Customer Activation Rate
├─ Time to First Purchase
├─ Repeat Purchase Rate
└─ Customer Lifetime Value
```

---

**Architecture Version**: 1.0.0

**Last Updated**: February 6, 2026
