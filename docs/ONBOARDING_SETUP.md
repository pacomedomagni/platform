# Onboarding System Setup Guide

## Quick Start

### 1. Run Database Migration

```bash
# Generate migration
npx prisma migrate dev --name add_onboarding_to_store_customer

# Or apply in production
npx prisma migrate deploy
```

### 2. Verify Backend Integration

The following files have been added/updated:

**Backend (NestJS):**
- ✅ `/apps/api/src/app/storefront/onboarding/onboarding.service.ts`
- ✅ `/apps/api/src/app/storefront/onboarding/onboarding.controller.ts`
- ✅ `/apps/api/src/app/storefront/onboarding/index.ts`
- ✅ `/apps/api/src/app/storefront/storefront.module.ts` (updated)

**Database:**
- ✅ `/prisma/schema.prisma` (StoreCustomer model updated)

**Frontend (Next.js):**
- ✅ `/apps/web/src/lib/onboarding-store.ts`
- ✅ `/apps/web/src/components/onboarding/welcome-wizard.tsx`
- ✅ `/apps/web/src/components/onboarding/onboarding-checklist.tsx`
- ✅ `/apps/web/src/components/onboarding/product-tour.tsx`
- ✅ `/apps/web/src/components/onboarding/index.ts`
- ✅ `/apps/web/src/app/storefront/layout.tsx` (updated)
- ✅ `/apps/web/src/app/storefront/account/page.tsx` (updated)
- ✅ `/apps/web/src/app/storefront/_components/store-providers.tsx` (updated)
- ✅ `/apps/web/src/lib/auth-store.ts` (updated)

### 3. Environment Variables

No additional environment variables required. The system uses existing:
- `NEXT_PUBLIC_API_URL` - API endpoint (default: http://localhost:3333)

### 4. Test the System

1. **Create a new account:**
   ```bash
   # Register at: http://localhost:4200/storefront/account/register
   ```

2. **Verify wizard appears:**
   - Welcome screen should show automatically
   - Navigate through all 4 steps
   - Skip option should work

3. **Check account page:**
   - Go to: http://localhost:4200/storefront/account
   - Onboarding checklist should be visible
   - Progress bar should show completion

4. **Test product tour:**
   - Complete onboarding wizard
   - Tour should auto-start after 2 seconds
   - Or click "Start Tour" on account page

### 5. API Verification

Test endpoints with cURL:

```bash
# Get status
curl http://localhost:3333/api/v1/store/onboarding/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Complete a step
curl -X POST http://localhost:3333/api/v1/store/onboarding/complete-step \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"step": "profile"}'

# Check progress
curl http://localhost:3333/api/v1/store/onboarding/progress \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Configuration

### Customize Discount Code

Edit `/apps/web/src/components/onboarding/welcome-wizard.tsx`:

```tsx
// Line ~340
const discountCode = 'WELCOME10'; // Change to your code
```

### Modify Tour Steps

Edit `/apps/web/src/components/onboarding/product-tour.tsx`:

```tsx
// Lines 15-38
const TOUR_STEPS: TourStep[] = [
  {
    target: '#your-element',
    title: 'Your Feature',
    content: 'Feature description',
    placement: 'bottom',
  },
  // Add more steps
];
```

### Adjust Wizard Steps

Edit `/apps/web/src/components/onboarding/welcome-wizard.tsx`:

```tsx
// Lines 8-21
const STEPS = [
  {
    id: 'welcome',
    title: 'Your Custom Title',
    subtitle: 'Your subtitle',
  },
  // Modify or add steps
];
```

## Deployment Checklist

### Production Deployment

- [ ] Run database migration
- [ ] Restart API server
- [ ] Clear CDN cache for frontend assets
- [ ] Test onboarding flow end-to-end
- [ ] Monitor error logs for 24 hours
- [ ] Check analytics for completion rates

### Rollback Plan

If issues occur:

```bash
# Revert database migration
npx prisma migrate resolve --rolled-back <migration_name>

# Deploy previous version
git revert HEAD
git push
```

The system is backward compatible - existing customers will have default values.

## Monitoring

### Key Metrics to Track

1. **Wizard Metrics:**
   - Views per step
   - Completion rate
   - Skip rate by step
   - Time spent per step

2. **Checklist Metrics:**
   - Overall completion rate
   - Time to complete each item
   - Most skipped items
   - Dismissal rate

3. **Tour Metrics:**
   - Start rate
   - Completion rate
   - Skip rate by step
   - "Show again" usage

### Database Queries

```sql
-- Onboarding completion rate
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN "onboardingCompleted" = true THEN 1 ELSE 0 END) as completed,
  ROUND(100.0 * SUM(CASE WHEN "onboardingCompleted" = true THEN 1 ELSE 0 END) / COUNT(*), 2) as completion_rate
FROM store_customers
WHERE "createdAt" >= NOW() - INTERVAL '30 days';

-- Profile completion distribution
SELECT
  "profileCompletionScore",
  COUNT(*) as count
FROM store_customers
GROUP BY "profileCompletionScore"
ORDER BY "profileCompletionScore";

-- Checklist progress
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN "hasAddedToCart" = true THEN 1 ELSE 0 END) as added_to_cart,
  SUM(CASE WHEN "hasCompletedFirstPurchase" = true THEN 1 ELSE 0 END) as first_purchase,
  SUM(CASE WHEN "hasAddedShippingAddress" = true THEN 1 ELSE 0 END) as added_address
FROM store_customers
WHERE "createdAt" >= NOW() - INTERVAL '30 days';
```

## Troubleshooting

### Common Issues

**Issue: Wizard doesn't appear**
```bash
# Check onboarding status
SELECT "onboardingCompleted", "onboardingStep"
FROM store_customers
WHERE email = 'customer@example.com';

# Clear session storage
sessionStorage.clear();

# Verify API is running
curl http://localhost:3333/health
```

**Issue: Tour elements not found**
```javascript
// Check selectors exist
document.querySelector('#header-search');
document.querySelector('[href="/storefront/cart"]');
document.querySelector('[href="/storefront/account"]');
```

**Issue: API 401 errors**
```javascript
// Verify JWT token
const token = localStorage.getItem('customer_token');
console.log('Token:', token);

// Check token expiry
const decoded = JSON.parse(atob(token.split('.')[1]));
console.log('Expires:', new Date(decoded.exp * 1000));
```

## Support

For issues or questions:
1. Check `/docs/ONBOARDING_SYSTEM.md` for detailed documentation
2. Review browser console for errors
3. Check API logs: `docker-compose logs api`
4. Contact development team

## Success Criteria

The onboarding system is working correctly when:

✅ New customers see the wizard after registration
✅ Wizard can be completed without errors
✅ Checklist appears on account page
✅ Progress updates in real-time
✅ Tour highlights correct elements
✅ API endpoints return expected data
✅ State persists across page refreshes
✅ Mobile experience is functional

## Next Steps

After deployment:

1. **Week 1**: Monitor completion rates and error logs
2. **Week 2**: Gather user feedback via surveys
3. **Month 1**: Analyze A/B test results (if applicable)
4. **Month 2**: Implement improvements based on data
5. **Quarter 1**: Consider advanced features (gamification, videos)

## Version History

- **v1.0.0** (2026-02-06): Initial release
  - Welcome wizard with 4 steps
  - Onboarding checklist with 5 items
  - Custom product tour with 4 highlights
  - Full API integration
  - Mobile responsive design
