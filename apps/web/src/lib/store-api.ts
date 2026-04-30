/**
 * Storefront API Client
 * Connects frontend to backend storefront APIs
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

// Cached tenant UUID resolved from hostname
let _resolvedTenantId: string | null = null;

/**
 * Resolve the current hostname to a tenant UUID.
 * Uses the backend resolve endpoint and caches the result in sessionStorage.
 */
export async function resolveTenantId(): Promise<string> {
  if (_resolvedTenantId) return _resolvedTenantId;

  if (typeof window === 'undefined') {
    return 'default';
  }

  // Check sessionStorage
  const cached = sessionStorage.getItem('resolved_tenant_id');
  if (cached) {
    _resolvedTenantId = cached;
    return cached;
  }

  // Resolve via backend API
  const hostname = window.location.hostname;
  try {
    const res = await fetch(`${API_BASE}/v1/store/resolve?domain=${encodeURIComponent(hostname)}`);
    if (res.ok) {
      const data = await res.json();
      _resolvedTenantId = data.tenantId;
      sessionStorage.setItem('resolved_tenant_id', data.tenantId);
      return data.tenantId;
    }
  } catch {
    // Resolve API unavailable — fall through to defaults
  }

  // Fallback: localStorage (admin panel / dev)
  const storedTenant = localStorage.getItem('tenantId');
  if (storedTenant) return storedTenant;

  return 'default';
}

/**
 * Clear the cached tenant resolution (e.g., after signup when tenant changes).
 */
export function clearTenantCache(): void {
  _resolvedTenantId = null;
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('resolved_tenant_id');
  }
}

// Base fetch with tenant header
export async function apiFetch<T>(
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
    
    // Add cart session for anonymous users
    const cartSession = localStorage.getItem('cart_session');
    if (cartSession) {
      headers['x-cart-session'] = cartSession;
    }
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    const errorData = error?.data || error;
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }

  const json = await response.json();
  // Unwrap standardized { data, meta } envelope
  if (json && typeof json === 'object' && 'data' in json && 'meta' in json) {
    return json.data as T;
  }
  return json as T;
}

// ==================== PRODUCTS API ====================

export interface Product {
  id: string;
  slug: string;
  displayName: string;
  name: string;  // Alias for displayName
  shortDescription: string | null;
  description: string | null;
  price: number;
  compareAtPrice: number | null;
  images: string[];
  category: { id: string; name: string; slug: string } | null;
  stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock' | 'preorder';
  stockQuantity: number;
  quantity?: number; // Alias for stockQuantity
  isFeatured: boolean;
  trackInventory?: boolean;
  tags?: string[];
  createdAt?: string;
  averageRating?: number;
  reviewCount?: number;
  leadTime?: string;
}

// Alias for backward compatibility
export type StoreProduct = Product;

export interface ProductListResponse {
  data: Product[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  productCount: number;
  children?: Category[];
}

// Alias for clarity
export type ProductCategory = Category;

export const productsApi = {
  list: (params?: {
    categorySlug?: string;
    search?: string;
    featured?: boolean;
    minPrice?: number;
    maxPrice?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  }): Promise<ProductListResponse> => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) query.set(key, String(value));
      });
    }
    return apiFetch(`/v1/store/products?${query}`);
  },

  get: (slug: string): Promise<Product> => {
    return apiFetch(`/v1/store/products/${slug}`);
  },

  getFeatured: (limit = 8): Promise<Product[]> => {
    return apiFetch(`/v1/store/products/featured?limit=${limit}`);
  },

  getCategories: (): Promise<Category[]> => {
    return apiFetch('/v1/store/categories');
  },

  getCategory: (slug: string): Promise<Category & { products: Product[] }> => {
    return apiFetch(`/v1/store/categories/${slug}`);
  },
};

// ==================== CART API ====================

export interface CartItem {
  id: string;
  productId: string;  // Alias for product.id
  product: {
    id: string;
    slug: string;
    displayName: string;
    price: number;
    compareAtPrice: number | null;
    images: string[];
    stockStatus: string;
  };
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  // Convenience aliases for direct access
  name: string;       // -> product.displayName
  price: number;      // -> product.price
  image: string;      // -> product.images[0]
  variant?: string;   // Optional variant info
}

export interface Cart {
  id: string;
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  shippingTotal: number;
  taxTotal: number;
  discountAmount: number;
  grandTotal: number;
  couponCode: string | null;
  /** Persisted cart-page shipping estimate. Null when never set or cleared. */
  shippingEstimate: Record<string, unknown> | null;
}

export const cartApi = {
  get: (): Promise<Cart> => {
    return apiFetch('/v1/store/cart');
  },

  getById: (cartId: string): Promise<Cart> => {
    return apiFetch(`/v1/store/cart/${cartId}`);
  },

  addItem: (cartId: string, productId: string, quantity: number): Promise<Cart> => {
    return apiFetch(`/v1/store/cart/${cartId}/items`, {
      method: 'POST',
      body: JSON.stringify({ productId, quantity }),
    });
  },

  updateItem: (cartId: string, itemId: string, quantity: number): Promise<Cart> => {
    return apiFetch(`/v1/store/cart/${cartId}/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify({ quantity }),
    });
  },

  removeItem: (cartId: string, itemId: string): Promise<Cart> => {
    return apiFetch(`/v1/store/cart/${cartId}/items/${itemId}`, {
      method: 'DELETE',
    });
  },

  applyCoupon: (cartId: string, code: string): Promise<Cart> => {
    return apiFetch(`/v1/store/cart/${cartId}/coupon`, {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },

  removeCoupon: (cartId: string): Promise<Cart> => {
    return apiFetch(`/v1/store/cart/${cartId}/coupon`, {
      method: 'DELETE',
    });
  },

  /**
   * Persist (or clear) the cart-page shipping estimate. Pass null to clear.
   * Server side this writes to carts.shippingEstimate (JSONB) so the value
   * survives device-switch and feeds checkout pre-fill.
   */
  setShippingEstimate: (
    cartId: string,
    estimate: Record<string, unknown> | null,
  ): Promise<{ success: boolean; shippingEstimate: Record<string, unknown> | null }> => {
    return apiFetch(`/v1/store/cart/${cartId}/shipping-estimate`, {
      method: 'PUT',
      body: JSON.stringify(estimate),
    });
  },

  clear: (cartId: string): Promise<void> => {
    return apiFetch(`/v1/store/cart/${cartId}`, {
      method: 'DELETE',
    });
  },
};

// ==================== CHECKOUT API ====================

export interface Address {
  firstName?: string;
  lastName?: string;
  company?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export interface CheckoutResponse {
  id: string;
  orderNumber: string;
  email: string;
  status: string;
  paymentStatus: string;
  paymentProvider?: string;
  shippingAddress: Address;
  billingAddress: Address | null;
  items: Array<{
    id: string;
    /**
     * productId/variantId expose the original product references so the
     * reorder flow can call `addItem(productId, qty)`. Both can be null for
     * snapshot-only items where the underlying product was deleted —
     * those items must be skipped during reorder.
     */
    productId: string | null;
    variantId: string | null;
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    imageUrl: string | null;
  }>;
  subtotal: number;
  shippingTotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
  clientSecret: string | null;
}

export const checkoutApi = {
  create: (data: {
    cartId: string;
    email: string;
    phone?: string;
    shippingAddress: Address;
    billingAddress?: Address;
    customerNotes?: string;
    giftCardCode?: string;
    giftCardPin?: string;
    shippingRateId?: string;
  }): Promise<CheckoutResponse> => {
    return apiFetch('/v1/store/checkout', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  get: (orderId: string): Promise<CheckoutResponse> => {
    return apiFetch(`/v1/store/checkout/${orderId}`);
  },

  getByOrderNumber: (orderNumber: string): Promise<CheckoutResponse> => {
    return apiFetch(`/v1/store/checkout/order/${orderNumber}`);
  },

  update: (orderId: string, data: Partial<{
    email: string;
    phone: string;
    shippingAddress: Address;
    billingAddress: Address;
  }>): Promise<CheckoutResponse> => {
    return apiFetch(`/v1/store/checkout/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  cancel: (orderId: string): Promise<void> => {
    return apiFetch(`/v1/store/checkout/${orderId}`, {
      method: 'DELETE',
    });
  },
};

// ==================== CUSTOMER AUTH API ====================

export interface Customer {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  acceptsMarketing: boolean;
  emailVerified: boolean;
  createdAt: string;
  addresses?: CustomerAddress[];
}

export interface AuthResponse {
  customer: Customer | null;
  token: string | null;
  refresh_token?: string | null;
  message?: string;
}

export interface CustomerAddress {
  id: string;
  label: string;
  isDefault: boolean;
  firstName: string;
  lastName: string;
  company: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;
  phone: string | null;
}

export const authApi = {
  register: (data: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    acceptsMarketing?: boolean;
  }): Promise<AuthResponse> => {
    return apiFetch('/v1/store/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  login: (email: string, password: string): Promise<AuthResponse> => {
    return apiFetch('/v1/store/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  getProfile: (): Promise<Customer> => {
    return apiFetch('/v1/store/auth/me');
  },

  updateProfile: (data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    acceptsMarketing?: boolean;
  }): Promise<Customer> => {
    return apiFetch('/v1/store/auth/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  changePassword: (currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string; token?: string }> => {
    return apiFetch('/v1/store/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  forgotPassword: (email: string): Promise<{ message: string }> => {
    return apiFetch('/v1/store/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  resetPassword: (token: string, password: string): Promise<{ message: string }> => {
    return apiFetch('/v1/store/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  },

  verifyEmail: (token: string): Promise<{ message: string }> => {
    return apiFetch('/v1/store/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },

  resendVerificationEmail: (): Promise<{ message: string }> => {
    return apiFetch('/v1/store/auth/resend-verification', {
      method: 'POST',
    });
  },

  getAddresses: (): Promise<CustomerAddress[]> => {
    return apiFetch('/v1/store/auth/addresses');
  },

  addAddress: (address: Omit<CustomerAddress, 'id'>): Promise<CustomerAddress> => {
    return apiFetch('/v1/store/auth/addresses', {
      method: 'POST',
      body: JSON.stringify(address),
    });
  },

  updateAddress: (id: string, address: Partial<CustomerAddress>): Promise<CustomerAddress> => {
    return apiFetch(`/v1/store/auth/addresses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(address),
    });
  },

  deleteAddress: (id: string): Promise<void> => {
    return apiFetch(`/v1/store/auth/addresses/${id}`, {
      method: 'DELETE',
    });
  },
};

// ==================== ORDERS API ====================

export interface OrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  grandTotal: number;
  itemCount: number;
  createdAt: string;
}

export interface OrderDetail extends OrderSummary {
  email: string;
  phone: string | null;
  shippingAddress: Address;
  billingAddress: Address | null;
  items: Array<{
    id: string;
    /**
     * productId/variantId expose the original product references so the
     * reorder flow can call `addItem(productId, qty)`. Both can be null for
     * snapshot-only items where the underlying product was deleted —
     * those items must be skipped during reorder.
     */
    productId: string | null;
    variantId: string | null;
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    imageUrl: string | null;
  }>;
  subtotal: number;
  shippingTotal: number;
  taxTotal: number;
  discountTotal: number;
  shippingMethod: string | null;
  shippingCarrier: string | null;
  trackingNumber: string | null;
}

export const ordersApi = {
  list: (params?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: OrderSummary[]; pagination: { total: number; limit: number; offset: number; hasMore: boolean } }> => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) query.set(key, String(value));
      });
    }
    return apiFetch(`/v1/store/orders?${query}`);
  },

  get: (orderId: string): Promise<OrderDetail> => {
    return apiFetch(`/v1/store/orders/${orderId}`);
  },

  lookup: (orderNumber: string, email: string): Promise<OrderDetail> => {
    return apiFetch(`/v1/store/orders/lookup/${orderNumber}?email=${encodeURIComponent(email)}`);
  },

  cancel: (orderId: string): Promise<void> => {
    return apiFetch(`/v1/store/orders/${orderId}/cancel`, {
      method: 'POST',
    });
  },
};

// ==================== PAGES API ====================

export interface StorePage {
  slug: string;
  title: string;
  content: string;
  isPublished: boolean;
  updatedAt: string;
}

export const pagesApi = {
  getBySlug: (slug: string): Promise<StorePage> => {
    return apiFetch(`/v1/store/pages/${slug}`);
  },

  list: (): Promise<StorePage[]> => {
    return apiFetch('/v1/store/pages');
  },
};

// ==================== PAYMENTS API ====================

export interface PaymentConfig {
  publicKey: string | null;
  isConfigured: boolean;
  paymentProvider: string;
  squareApplicationId: string | null;
  squareLocationId: string | null;
}

export interface SquarePaymentResponse {
  success: boolean;
  paymentId: string | null;
  orderId: string;
}

export const paymentsApi = {
  getConfig: (): Promise<PaymentConfig> => {
    return apiFetch('/v1/store/payments/config');
  },

  processSquarePayment: (orderId: string, sourceId: string): Promise<SquarePaymentResponse> => {
    return apiFetch('/v1/store/payments/square', {
      method: 'POST',
      body: JSON.stringify({ orderId, sourceId }),
    });
  },
};

// ==================== SHIPPING API ====================

export interface ShippingRate {
  id: string;
  name: string;
  price: number;
  estimatedDays: string | null;
  isFree: boolean;
}

export interface ShippingRatesResponse {
  rates: ShippingRate[];
}

export const shippingApi = {
  getRates: (
    data: {
      country: string;
      state?: string;
      zipCode?: string;
      cartTotal: number;
    },
    options?: { signal?: AbortSignal },
  ): Promise<ShippingRatesResponse> => {
    return apiFetch('/v1/store/shipping/calculate', {
      method: 'POST',
      body: JSON.stringify(data),
      signal: options?.signal,
    });
  },
};

// ==================== GIFT CARD API ====================

export interface GiftCardBalance {
  code: string;
  balance: number;
  currency: string;
  expiresAt: string | null;
  status: string;
}

export const giftCardApi = {
  checkBalance: (code: string, pin?: string): Promise<GiftCardBalance> => {
    const params = new URLSearchParams({ code });
    if (pin) params.set('pin', pin);
    return apiFetch(`/v1/store/gift-cards/check?${params}`);
  },
};

// ==================== I18N API ====================

export interface StoreLanguage {
  id: string;
  languageCode: string;
  countryCode: string | null;
  name: string;
  nativeName: string;
  isDefault: boolean;
  isEnabled: boolean;
  sortOrder: number;
}

export interface LocalizedProduct extends Product {
  _translation: {
    languageCode: string;
    translatedAt: string;
  } | null;
}

/**
 * I18n API client
 * Uses the /v1/storefront/:storeId/i18n/... route prefix to match backend controller.
 * The storeId is the resolved tenant UUID.
 */
async function i18nFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const tenantId = await resolveTenantId();
  return apiFetch(`/v1/storefront/${tenantId}/i18n${path}`, options);
}

export const i18nApi = {
  /** Get all enabled languages for the storefront */
  getLanguages: (): Promise<StoreLanguage[]> => {
    return i18nFetch('/languages');
  },

  /** Get the default language */
  getDefaultLanguage: (): Promise<StoreLanguage | null> => {
    return i18nFetch('/languages/default');
  },

  /** Get content translations for given keys in a language */
  getContents: (keys: string[], lang: string): Promise<Record<string, string>> => {
    const keysParam = encodeURIComponent(keys.join(','));
    return i18nFetch(`/content?keys=${keysParam}&lang=${encodeURIComponent(lang)}`);
  },

  /** Get a single content translation */
  getContent: (contentKey: string, lang: string): Promise<{ key: string; languageCode: string; content: string }> => {
    return i18nFetch(`/content/${encodeURIComponent(contentKey)}?lang=${encodeURIComponent(lang)}`);
  },

  /** Get a product with translations applied */
  getLocalizedProduct: (productId: string, lang: string): Promise<LocalizedProduct> => {
    return i18nFetch(`/products/${productId}?lang=${encodeURIComponent(lang)}`);
  },

  /** Get a category with translations applied */
  getLocalizedCategory: (categoryId: string, lang: string): Promise<Category & { _translation: { languageCode: string; translatedAt: string } | null }> => {
    return i18nFetch(`/categories/${categoryId}?lang=${encodeURIComponent(lang)}`);
  },
};
