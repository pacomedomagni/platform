/**
 * Product Reviews API Client
 */
import { resolveTenantId } from './store-api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

// Base fetch with tenant header
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const tenantId = await resolveTenantId();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-tenant-id': tenantId,
    ...Object.fromEntries(
      options.headers instanceof Headers
        ? options.headers.entries()
        : Object.entries(options.headers || {})
    ),
  };

  // Add auth token if available
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('customer_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Add session token for anonymous voting
    const sessionToken = localStorage.getItem('session_token') || generateSessionToken();
    headers['x-session-token'] = sessionToken;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

function generateSessionToken(): string {
  const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
  localStorage.setItem('session_token', token);
  return token;
}

// ==================== REVIEWS API ====================

export interface Review {
  id: string;
  rating: number;
  title: string;
  content: string;
  pros: string | null;
  cons: string | null;
  reviewerName: string;
  isVerifiedPurchase: boolean;
  images: string[];
  helpfulCount: number;
  notHelpfulCount: number;
  adminResponse: string | null;
  adminRespondedAt: string | null;
  createdAt: string;
}

export interface ReviewsResponse {
  reviews: Review[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

export interface CreateReviewDto {
  productListingId: string;
  rating: number;
  title: string;
  content: string;
  pros?: string;
  cons?: string;
  reviewerName?: string;
  images?: string[];
}

export const reviewsApi = {
  // Get product reviews
  getProductReviews: (
    productListingId: string,
    options?: {
      page?: number;
      limit?: number;
      rating?: number;
      sortBy?: 'helpful' | 'newest' | 'highest' | 'lowest';
    }
  ): Promise<ReviewsResponse> => {
    const query = new URLSearchParams();
    query.set('page', String(options?.page || 1));
    query.set('limit', String(options?.limit || 10));
    if (options?.rating) query.set('rating', String(options.rating));

    return apiFetch(`/v1/store/products/${productListingId}/reviews?${query}`);
  },

  // Create a review
  createReview: (data: CreateReviewDto): Promise<Review> => {
    return apiFetch('/v1/store/reviews', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Vote on a review
  voteReview: (reviewId: string, isHelpful: boolean): Promise<{ success: boolean }> => {
    return apiFetch(`/v1/store/reviews/${reviewId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ isHelpful }),
    });
  },

  // Upload review images
  uploadImages: async (files: File[]): Promise<string[]> => {
    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));

    const response = await fetch(`${API_BASE}/v1/store/reviews/upload-images`, {
      method: 'POST',
      headers: {
        'x-tenant-id': getTenantId(),
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to upload images');
    }

    const data = await response.json();
    return data.urls;
  },
};

// ==================== ADMIN REVIEWS API ====================

export interface AdminReview extends Review {
  customer: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;
  productListing: {
    id: string;
    displayName: string;
    slug: string;
  };
  status: 'pending' | 'approved' | 'rejected';
  moderatedAt: string | null;
  moderatedBy: string | null;
  moderationNotes: string | null;
}

export interface AdminReviewsResponse {
  reviews: AdminReview[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const adminReviewsApi = {
  // List all reviews (admin)
  listReviews: (options?: {
    page?: number;
    limit?: number;
    status?: 'pending' | 'approved' | 'rejected';
    productId?: string;
  }): Promise<AdminReviewsResponse> => {
    const query = new URLSearchParams();
    if (options?.page) query.set('page', String(options.page));
    if (options?.limit) query.set('limit', String(options.limit));
    if (options?.status) query.set('status', options.status);
    if (options?.productId) query.set('productId', options.productId);

    return apiFetch(`/v1/admin/reviews?${query}`);
  },

  // Moderate review (approve/reject)
  moderateReview: (
    reviewId: string,
    data: {
      status: 'approved' | 'rejected';
      notes?: string;
    }
  ): Promise<AdminReview> => {
    return apiFetch(`/v1/admin/reviews/${reviewId}/moderate`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Bulk moderate reviews
  bulkModerate: (
    reviewIds: string[],
    status: 'approved' | 'rejected'
  ): Promise<{ success: boolean; count: number }> => {
    return apiFetch('/v1/admin/reviews/bulk-moderate', {
      method: 'POST',
      body: JSON.stringify({ reviewIds, status }),
    });
  },

  // Add admin response
  addResponse: (
    reviewId: string,
    response: string
  ): Promise<AdminReview> => {
    return apiFetch(`/v1/admin/reviews/${reviewId}/respond`, {
      method: 'POST',
      body: JSON.stringify({ response }),
    });
  },

  // Delete review
  deleteReview: (reviewId: string): Promise<{ success: boolean }> => {
    return apiFetch(`/v1/admin/reviews/${reviewId}`, {
      method: 'DELETE',
    });
  },
};
