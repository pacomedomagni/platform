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
 * Address schema (for both shipping and billing)
 */
export const addressSchema = z.object({
  firstName: z.string().min(1, 'First name is required').optional(),
  lastName: z.string().min(1, 'Last name is required').optional(),
  company: z.string().optional(),
  addressLine1: z.string().min(1, 'Address is required'),
  addressLine2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().optional(),
  postalCode: z.string().min(1, 'Postal code is required'),
  country: z.string().min(2, 'Country is required').max(2),
  phone: phoneSchema,
});

/**
 * Shipping address schema (extends address with optional label)
 */
export const shippingAddressSchema = addressSchema.extend({
  label: z.string().optional(),
  isDefault: z.boolean().optional(),
});

/**
 * Billing address schema (same as shipping but can mark if same as shipping)
 */
export const billingAddressSchema = addressSchema.extend({
  sameAsShipping: z.boolean().optional(),
});

/**
 * Full checkout form schema
 */
export const checkoutSchema = z.object({
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
  country: z.string().min(2, 'Country is required'),

  // Optional fields
  customerNotes: z.string().optional(),
  saveAddress: z.boolean().optional(),
});

/**
 * Add address to customer account schema
 */
export const addAddressSchema = z.object({
  label: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  company: z.string().optional(),
  addressLine1: z.string().min(1, 'Address is required'),
  addressLine2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().optional(),
  postalCode: z.string().min(1, 'Postal code is required'),
  country: z.string().min(2, 'Country is required'),
  phone: phoneSchema,
  isDefault: z.boolean().optional(),
});

// Export types for TypeScript
export type ContactInput = z.infer<typeof contactSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
export type ShippingAddressInput = z.infer<typeof shippingAddressSchema>;
export type BillingAddressInput = z.infer<typeof billingAddressSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type AddAddressInput = z.infer<typeof addAddressSchema>;
