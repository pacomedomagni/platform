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
 * Update customer profile schema
 */
export const updateProfileSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(50, 'First name must be at most 50 characters')
    .optional(),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(50, 'Last name must be at most 50 characters')
    .optional(),
  phone: phoneSchema,
  acceptsMarketing: z.boolean().optional(),
});

/**
 * Email preferences schema
 */
export const emailPreferencesSchema = z.object({
  acceptsMarketing: z.boolean(),
  orderUpdates: z.boolean().optional(),
  promotions: z.boolean().optional(),
  productRecommendations: z.boolean().optional(),
  newsletter: z.boolean().optional(),
});

/**
 * Customer preferences schema
 */
export const customerPreferencesSchema = z.object({
  language: z.string().length(2).optional(),
  currency: z.string().length(3).optional(),
  timezone: z.string().optional(),
  emailPreferences: emailPreferencesSchema.optional(),
});

/**
 * Customer search schema
 */
export const customerSearchSchema = z.object({
  query: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional(),
});

/**
 * Customer note schema (for internal use)
 */
export const customerNoteSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
  note: z
    .string()
    .min(1, 'Note cannot be empty')
    .max(1000, 'Note must be at most 1000 characters'),
  isPrivate: z.boolean().optional(),
});

// Export types for TypeScript
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type EmailPreferencesInput = z.infer<typeof emailPreferencesSchema>;
export type CustomerPreferencesInput = z.infer<typeof customerPreferencesSchema>;
export type CustomerSearchInput = z.infer<typeof customerSearchSchema>;
export type CustomerNoteInput = z.infer<typeof customerNoteSchema>;
