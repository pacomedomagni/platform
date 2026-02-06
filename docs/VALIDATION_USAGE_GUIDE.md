# Validation & Accessibility Usage Guide

## Quick Start: Form Validation

### 1. Basic Form with Validation

```typescript
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@platform/validation';
import { FormField } from '@/components/forms';
import { Input, Button } from '@platform/ui';

export default function MyForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur', // Validate on blur
  });

  const onSubmit = async (data: LoginInput) => {
    // Your submit logic
    console.log(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FormField
        label="Email"
        htmlFor="email"
        error={errors.email?.message}
        required
      >
        <Input
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          {...register('email')}
        />
      </FormField>

      <FormField
        label="Password"
        htmlFor="password"
        error={errors.password?.message}
        required
      >
        <Input
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          {...register('password')}
        />
      </FormField>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Submitting...' : 'Submit'}
      </Button>
    </form>
  );
}
```

### 2. Available Validation Schemas

#### Authentication
- `loginSchema` - Email + password
- `registerSchema` - Full registration with password confirmation
- `forgotPasswordSchema` - Email only
- `resetPasswordSchema` - Token + new password + confirmation
- `changePasswordSchema` - Current password + new password + confirmation

#### Checkout
- `checkoutSchema` - Complete checkout form
- `contactSchema` - Email, phone, name
- `addressSchema` - Full address fields
- `shippingAddressSchema` - Address with label and default flag
- `billingAddressSchema` - Address with same-as-shipping option

#### Products
- `reviewSchema` - Product review with rating
- `ratingSchema` - 0-5 rating (0.5 increments)
- `productFilterSchema` - Product search and filtering
- `wishlistItemSchema` - Add to wishlist

#### Customer
- `updateProfileSchema` - Customer profile updates
- `emailPreferencesSchema` - Email notification preferences

### 3. Custom Validation

Create custom schemas by extending existing ones:

```typescript
import { z } from 'zod';
import { addressSchema } from '@platform/validation';

// Extend existing schema
const customAddressSchema = addressSchema.extend({
  businessName: z.string().optional(),
  taxId: z.string().optional(),
});

// Create custom schema
const customSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  age: z.number().min(18, 'Must be 18 or older'),
  email: z.string().email('Invalid email'),
});
```

---

## Accessibility Guidelines

### 1. Form Accessibility Checklist

- [ ] All inputs have associated labels with `htmlFor`
- [ ] Required fields marked with `*` and `aria-label="required"`
- [ ] Error messages use `role="alert"` and `aria-live="assertive"`
- [ ] Inputs have `aria-invalid` when errors present
- [ ] Inputs have `aria-describedby` pointing to error messages
- [ ] Form has `noValidate` to prevent default browser validation
- [ ] Submit buttons have `aria-busy` during submission
- [ ] Loading spinners have `aria-hidden="true"`

### 2. Using FormField Component

The `FormField` component automatically handles accessibility:

```typescript
<FormField
  label="Email"          // Visible label
  htmlFor="email"        // Associates with input
  error={errors.email?.message}  // Error message
  required={true}        // Adds * and aria-label
  hint="We'll never share your email"  // Optional hint
>
  <Input {...register('email')} />
</FormField>
```

This generates:
- Proper label association
- Red border on error
- Error message with alert icon
- ARIA attributes automatically

### 3. Keyboard Navigation

All interactive elements should be keyboard accessible:

```typescript
// Good: Button
<button onClick={handleClick}>Click me</button>

// Good: Link
<Link href="/page">Go to page</Link>

// Bad: Div as button
<div onClick={handleClick}>Click me</div>

// Fix: Add proper attributes
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick();
    }
  }}
>
  Click me
</div>
```

### 4. Loading States

Always provide accessible loading states:

```typescript
<Button disabled={isLoading} aria-busy={isLoading}>
  {isLoading ? (
    <>
      <Spinner className="h-4 w-4 mr-2" aria-hidden="true" />
      <span>Loading...</span>
    </>
  ) : (
    'Submit'
  )}
</Button>
```

### 5. ARIA Roles

Common ARIA roles for pages:

```typescript
// Main content
<main id="main-content" tabIndex={-1}>
  {children}
</main>

// Navigation
<nav aria-label="Main navigation">
  {links}
</nav>

// Search
<div role="search">
  <Input type="search" aria-label="Search products" />
</div>

// Alert
<div role="alert" aria-live="assertive">
  Error message
</div>

// Status (non-critical)
<div role="status" aria-live="polite">
  Loading...
</div>

// List
<div role="list">
  <div role="listitem">Item 1</div>
  <div role="listitem">Item 2</div>
</div>
```

### 6. Focus Management

#### Skip to Content
Already implemented in layout:
```typescript
<a href="#main-content" className="sr-only focus:not-sr-only ...">
  Skip to content
</a>
```

#### Focus Styles
Global focus indicators are already set up in `/apps/web/src/app/global.css`:
```css
*:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}
```

### 7. Screen Reader Only Content

Use the `sr-only` class for content that should only be read by screen readers:

```typescript
<h1>
  Products
  <span className="sr-only">Available in stock</span>
</h1>
```

### 8. Color Contrast

Ensure text meets WCAG 2.1 AA standards:
- Normal text: 4.5:1 contrast ratio
- Large text (18pt+): 3:1 contrast ratio

Approved color combinations:
- `text-slate-900` on white backgrounds
- `text-slate-600` on white backgrounds
- `text-white` on `bg-blue-600` or darker
- `text-red-600` on `bg-red-50`
- `text-green-600` on `bg-green-50`

---

## Backend Integration

### Using Zod DTOs in NestJS

```typescript
import { Body, Controller, Post } from '@nestjs/common';
import { RegisterCustomerZodDto } from './zod-dto';

@Controller('auth')
export class AuthController {
  @Post('register')
  async register(@Body() dto: RegisterCustomerZodDto) {
    // dto is already validated
    return this.authService.register(dto);
  }
}
```

### Creating Custom Zod DTOs

```typescript
import { createZodDto } from 'nestjs-zod';
import { myCustomSchema } from '@platform/validation';

export class MyCustomDto extends createZodDto(myCustomSchema) {}
```

---

## Testing

### Form Validation Testing

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MyForm from './MyForm';

test('shows validation errors', async () => {
  render(<MyForm />);

  const submitButton = screen.getByRole('button', { name: /submit/i });
  await userEvent.click(submitButton);

  await waitFor(() => {
    expect(screen.getByText(/email is required/i)).toBeInTheDocument();
  });
});
```

### Accessibility Testing

```typescript
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import MyPage from './MyPage';

expect.extend(toHaveNoViolations);

test('should not have accessibility violations', async () => {
  const { container } = render(<MyPage />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

---

## Common Patterns

### Password Strength Indicator

```typescript
const password = watch('password');

{password && (
  <div role="status" aria-live="polite" className="rounded-lg bg-blue-50 p-3">
    <p className="font-medium text-blue-900">Password strength:</p>
    <ul className="space-y-1 text-blue-700">
      <li className={password.length >= 8 ? 'text-green-700' : ''}>
        {password.length >= 8 ? '✓' : '○'} At least 8 characters
      </li>
      <li className={/[A-Z]/.test(password) ? 'text-green-700' : ''}>
        {/[A-Z]/.test(password) ? '✓' : '○'} One uppercase letter
      </li>
    </ul>
  </div>
)}
```

### Async Validation

```typescript
const {
  register,
  handleSubmit,
  setError,
  formState: { errors },
} = useForm<RegisterInput>({
  resolver: zodResolver(registerSchema),
});

const onSubmit = async (data: RegisterInput) => {
  try {
    await registerUser(data);
  } catch (error) {
    if (error.message.includes('email')) {
      setError('email', {
        type: 'server',
        message: 'This email is already registered',
      });
    }
  }
};
```

### Conditional Validation

```typescript
const schema = z.object({
  hasCompany: z.boolean(),
  companyName: z.string().optional(),
}).refine((data) => {
  if (data.hasCompany) {
    return data.companyName && data.companyName.length > 0;
  }
  return true;
}, {
  message: 'Company name is required when you have a company',
  path: ['companyName'],
});
```

---

## Resources

### Documentation
- [Zod Documentation](https://zod.dev/)
- [React Hook Form](https://react-hook-form.com/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)

### Testing Tools
- [axe DevTools](https://www.deque.com/axe/devtools/) - Browser extension
- [WAVE](https://wave.webaim.org/) - Web accessibility evaluation tool
- [Lighthouse](https://developers.google.com/web/tools/lighthouse) - Built into Chrome DevTools

### Screen Readers
- [NVDA](https://www.nvaccess.org/) - Free (Windows)
- [JAWS](https://www.freedomscientific.com/products/software/jaws/) - Commercial (Windows)
- VoiceOver - Built-in (macOS/iOS)
- TalkBack - Built-in (Android)

---

## Support

For questions or issues:
1. Check this guide first
2. Review the implementation examples in the codebase
3. Consult the WCAG 2.1 guidelines
4. Ask the development team
