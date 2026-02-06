import { z } from 'zod';

/**
 * Rating schema (0-5 stars)
 */
export const ratingSchema = z
  .number()
  .min(0, 'Rating must be at least 0')
  .max(5, 'Rating must be at most 5')
  .step(0.5, 'Rating must be in increments of 0.5');

/**
 * Review schema
 */
export const reviewSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  rating: ratingSchema,
  title: z
    .string()
    .min(3, 'Review title must be at least 3 characters')
    .max(100, 'Review title must be at most 100 characters'),
  content: z
    .string()
    .min(10, 'Review must be at least 10 characters')
    .max(2000, 'Review must be at most 2000 characters'),
  wouldRecommend: z.boolean().optional(),
  verified: z.boolean().optional(),
});

/**
 * Update review schema (for editing existing reviews)
 */
export const updateReviewSchema = z.object({
  rating: ratingSchema.optional(),
  title: z
    .string()
    .min(3, 'Review title must be at least 3 characters')
    .max(100, 'Review title must be at most 100 characters')
    .optional(),
  content: z
    .string()
    .min(10, 'Review must be at least 10 characters')
    .max(2000, 'Review must be at most 2000 characters')
    .optional(),
  wouldRecommend: z.boolean().optional(),
});

/**
 * Product filter schema
 */
export const productFilterSchema = z.object({
  search: z.string().optional(),
  categorySlug: z.string().optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  rating: ratingSchema.optional(),
  inStock: z.boolean().optional(),
  sortBy: z
    .enum(['featured', 'price-asc', 'price-desc', 'newest', 'rating'])
    .optional(),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional(),
});

/**
 * Wishlist item schema
 */
export const wishlistItemSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  variantId: z.string().uuid('Invalid variant ID').optional(),
});

/**
 * Product question schema
 */
export const productQuestionSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  question: z
    .string()
    .min(10, 'Question must be at least 10 characters')
    .max(500, 'Question must be at most 500 characters'),
  email: z.string().email('Please enter a valid email address').optional(),
});

// Export types for TypeScript
export type ReviewInput = z.infer<typeof reviewSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;
export type ProductFilterInput = z.infer<typeof productFilterSchema>;
export type WishlistItemInput = z.infer<typeof wishlistItemSchema>;
export type ProductQuestionInput = z.infer<typeof productQuestionSchema>;
