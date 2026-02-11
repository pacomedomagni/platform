/**
 * Wishlist API Client
 */
import { resolveTenantId } from './store-api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

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

  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('customer_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || `Request failed: ${response.status}`);
  }

  return response.json();
}

// ==================== TYPES ====================

export interface WishlistSummary {
  id: string;
  name: string;
  isDefault: boolean;
  isPublic: boolean;
  shareToken: string | null;
  _count: { items: number };
  createdAt: string;
}

export interface WishlistItem {
  id: string;
  product: {
    id: string;
    slug: string;
    name: string;
    price: number;
    compareAtPrice: number | null;
    images: string[];
    category: string | null;
  };
  variant: {
    id: string;
    sku: string | null;
    price: number | null;
    imageUrl: string | null;
    attributes: Array<{
      attributeType: { name: string; displayName: string };
      attributeValue: { value: string; displayValue: string; colorHex: string | null };
    }>;
  } | null;
  priceWhenAdded: number | null;
  priority: number;
  notes: string | null;
  createdAt: string;
}

export interface WishlistDetail {
  id: string;
  name: string;
  isDefault: boolean;
  isPublic: boolean;
  shareToken: string | null;
  shareUrl: string | null;
  ownerName: string;
  items: WishlistItem[];
}

// ==================== API ====================

export const wishlistApi = {
  /** Get all wishlists for the current customer */
  list: (): Promise<WishlistSummary[]> => {
    return apiFetch('/v1/store/wishlist');
  },

  /** Get a single wishlist with items */
  get: (id: string): Promise<WishlistDetail> => {
    return apiFetch(`/v1/store/wishlist/${id}`);
  },

  /** Create a new wishlist */
  create: (data: { name: string; isPublic?: boolean }): Promise<WishlistDetail> => {
    return apiFetch('/v1/store/wishlist', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /** Update a wishlist */
  update: (id: string, data: { name?: string; isPublic?: boolean }): Promise<WishlistDetail> => {
    return apiFetch(`/v1/store/wishlist/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /** Delete a wishlist */
  delete: (id: string): Promise<{ success: boolean }> => {
    return apiFetch(`/v1/store/wishlist/${id}`, {
      method: 'DELETE',
    });
  },

  /** Add item to default wishlist */
  addItem: (data: {
    productListingId: string;
    variantId?: string;
    priority?: number;
    notes?: string;
  }): Promise<WishlistItem> => {
    return apiFetch('/v1/store/wishlist/items', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /** Add item to a specific wishlist */
  addItemToWishlist: (
    wishlistId: string,
    data: {
      productListingId: string;
      variantId?: string;
      priority?: number;
      notes?: string;
    }
  ): Promise<WishlistItem> => {
    return apiFetch(`/v1/store/wishlist/${wishlistId}/items`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /** Remove item from wishlist */
  removeItem: (itemId: string): Promise<{ success: boolean }> => {
    return apiFetch(`/v1/store/wishlist/items/${itemId}`, {
      method: 'DELETE',
    });
  },

  /** Move item to cart */
  moveToCart: (itemId: string, cartId: string): Promise<unknown> => {
    return apiFetch(`/v1/store/wishlist/items/${itemId}/move-to-cart`, {
      method: 'POST',
      body: JSON.stringify({ cartId }),
    });
  },

  /** Get shared wishlist (public, no auth) */
  getShared: (shareToken: string): Promise<WishlistDetail> => {
    return apiFetch(`/v1/store/wishlist/shared/${shareToken}`);
  },
};
