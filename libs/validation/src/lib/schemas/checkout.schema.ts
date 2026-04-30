import { z } from 'zod';

/**
 * Phone number validation (optional but must be valid if provided)
 */
const phoneSchema = z
  .string()
  .regex(
    /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/,
    'Please enter a valid phone number'
  )
  .optional()
  .or(z.literal(''));

/**
 * Contact information schema
 */
export const contactSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  phone: phoneSchema,
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
});

/**
 * Countries where state/province is required by postal authorities and most
 * carriers. Keep this list explicit so we never silently accept missing state
 * for buyers who actually need one. Backend tax/rate calc relies on this too.
 */
export const COUNTRIES_REQUIRING_STATE: readonly string[] = [
  'US', 'CA', 'AU', 'BR', 'IN', 'MX', 'IT', 'ES',
];

/**
 * superRefine validator shared across address and checkout schemas to
 * enforce state-required-for-some-countries at the schema layer instead
 * of in form code where it would drift.
 */
function requireStateForKnownCountries(
  data: { country?: string; state?: string },
  ctx: z.RefinementCtx,
) {
  const country = data.country?.toUpperCase();
  if (!country) return;
  if (COUNTRIES_REQUIRING_STATE.includes(country) && !data.state?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'State / province is required for this country',
      path: ['state'],
    });
  }
}

/**
 * Base address fields, kept as a plain ZodObject so it can be `.extend`-ed.
 * The `.superRefine` for state-required-by-country is applied to each public
 * export below; refinements don't survive `.extend`, so we re-apply them.
 */
const addressBase = z.object({
  firstName: z.string().min(1, 'First name is required').optional(),
  lastName: z.string().min(1, 'Last name is required').optional(),
  company: z.string().optional(),
  addressLine1: z.string().min(1, 'Address is required'),
  addressLine2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().optional(),
  postalCode: z.string().min(1, 'Postal code is required'),
  country: z.string().length(2, 'Country must be a 2-letter ISO code'),
  phone: phoneSchema,
});

export const addressSchema = addressBase.superRefine(requireStateForKnownCountries);

/**
 * Shipping address schema (extends address with optional label)
 */
export const shippingAddressSchema = addressBase
  .extend({
    label: z.string().optional(),
    isDefault: z.boolean().optional(),
  })
  .superRefine(requireStateForKnownCountries);

/**
 * Billing address schema (same as shipping but can mark if same as shipping)
 */
export const billingAddressSchema = addressBase
  .extend({
    sameAsShipping: z.boolean().optional(),
  })
  .superRefine(requireStateForKnownCountries);

/**
 * Full checkout form schema
 */
export const checkoutSchema = z
  .object({
    // Contact info
    email: z.string().email('Please enter a valid email address'),
    phone: phoneSchema,

    // Shipping address
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    company: z.string().optional(),
    addressLine1: z.string().min(1, 'Address is required'),
    addressLine2: z.string().optional(),
    city: z.string().min(1, 'City is required'),
    state: z.string().optional(),
    postalCode: z.string().min(1, 'Postal code is required'),
    country: z.string().length(2, 'Country must be a 2-letter ISO code'),

    // Optional fields
    customerNotes: z.string().optional(),
    saveAddress: z.boolean().optional(),
  })
  .superRefine(requireStateForKnownCountries);

/**
 * Add address to customer account schema
 */
export const addAddressSchema = z
  .object({
    label: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    company: z.string().optional(),
    addressLine1: z.string().min(1, 'Address is required'),
    addressLine2: z.string().optional(),
    city: z.string().min(1, 'City is required'),
    state: z.string().optional(),
    postalCode: z.string().min(1, 'Postal code is required'),
    country: z.string().length(2, 'Country must be a 2-letter ISO code'),
    phone: phoneSchema,
    isDefault: z.boolean().optional(),
  })
  .superRefine(requireStateForKnownCountries);

// Export types for TypeScript
export type ContactInput = z.infer<typeof contactSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
export type ShippingAddressInput = z.infer<typeof shippingAddressSchema>;
export type BillingAddressInput = z.infer<typeof billingAddressSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type AddAddressInput = z.infer<typeof addAddressSchema>;
