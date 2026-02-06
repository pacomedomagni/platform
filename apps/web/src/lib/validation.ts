/**
 * Re-export validation schemas for easy import in frontend components
 * This file provides a convenient single import point for all validation schemas
 */

export {
  // Auth schemas
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  passwordSchema,
  emailSchema,
  type LoginInput,
  type RegisterInput,
  type ForgotPasswordInput,
  type ResetPasswordInput,
  type ChangePasswordInput,
} from '@platform/validation';

export {
  // Checkout schemas
  checkoutSchema,
  contactSchema,
  addressSchema,
  shippingAddressSchema,
  billingAddressSchema,
  addAddressSchema,
  type CheckoutInput,
  type ContactInput,
  type AddressInput,
  type ShippingAddressInput,
  type BillingAddressInput,
  type AddAddressInput,
} from '@platform/validation';

export {
  // Product schemas
  reviewSchema,
  updateReviewSchema,
  productFilterSchema,
  wishlistItemSchema,
  productQuestionSchema,
  ratingSchema,
  type ReviewInput,
  type UpdateReviewInput,
  type ProductFilterInput,
  type WishlistItemInput,
  type ProductQuestionInput,
} from '@platform/validation';

export {
  // Customer schemas
  updateProfileSchema,
  emailPreferencesSchema,
  customerPreferencesSchema,
  customerSearchSchema,
  customerNoteSchema,
  type UpdateProfileInput,
  type EmailPreferencesInput,
  type CustomerPreferencesInput,
  type CustomerSearchInput,
  type CustomerNoteInput,
} from '@platform/validation';
