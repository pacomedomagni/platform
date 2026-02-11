/**
 * Product Variants API Client
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
    const token = localStorage.getItem('admin_token') || localStorage.getItem('customer_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
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

// ==================== ATTRIBUTE TYPES API ====================

export interface AttributeType {
  id: string;
  name: string;
  displayName: string;
  sortOrder: number;
  values: AttributeValue[];
}

export interface AttributeValue {
  id: string;
  attributeTypeId: string;
  value: string;
  displayValue: string;
  colorHex: string | null;
  sortOrder: number;
}

export const attributeTypesApi = {
  list: (): Promise<AttributeType[]> => {
    return apiFetch('/v1/store/admin/attribute-types');
  },

  create: (data: {
    displayName: string;
    sortOrder?: number;
  }): Promise<AttributeType> => {
    return apiFetch('/v1/store/admin/attribute-types', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: (
    id: string,
    data: {
      displayName?: string;
      sortOrder?: number;
    }
  ): Promise<AttributeType> => {
    return apiFetch(`/v1/store/admin/attribute-types/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: (id: string): Promise<{ success: boolean }> => {
    return apiFetch(`/v1/store/admin/attribute-types/${id}`, {
      method: 'DELETE',
    });
  },
};

export const attributeValuesApi = {
  create: (data: {
    attributeTypeId: string;
    displayValue: string;
    colorHex?: string;
    sortOrder?: number;
  }): Promise<AttributeValue> => {
    return apiFetch('/v1/store/admin/attribute-values', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: (
    id: string,
    data: {
      displayValue?: string;
      colorHex?: string;
      sortOrder?: number;
    }
  ): Promise<AttributeValue> => {
    return apiFetch(`/v1/store/admin/attribute-values/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: (id: string): Promise<{ success: boolean }> => {
    return apiFetch(`/v1/store/admin/attribute-values/${id}`, {
      method: 'DELETE',
    });
  },
};

// ==================== PRODUCT VARIANTS API ====================

export interface ProductVariant {
  id: string;
  tenantId: string;
  productListingId: string;
  sku: string | null;
  barcode: string | null;
  price: number | null;
  compareAtPrice: number | null;
  imageUrl: string | null;
  stockQty: number;
  trackInventory: boolean;
  allowBackorder: boolean;
  isActive: boolean;
  sortOrder: number;
  attributes: VariantAttribute[];
  createdAt: string;
  updatedAt: string;
}

export interface VariantAttribute {
  attributeType: AttributeType;
  attributeValue: AttributeValue;
}

export interface CreateVariantDto {
  productListingId: string;
  sku?: string;
  barcode?: string;
  price?: number;
  compareAtPrice?: number;
  imageUrl?: string;
  stockQty?: number;
  trackInventory?: boolean;
  allowBackorder?: boolean;
  attributes: Array<{
    attributeTypeId: string;
    attributeValueId: string;
  }>;
}

export interface UpdateVariantDto {
  sku?: string;
  barcode?: string;
  price?: number;
  compareAtPrice?: number;
  imageUrl?: string;
  stockQty?: number;
  trackInventory?: boolean;
  allowBackorder?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}

export const variantsApi = {
  list: (productListingId: string): Promise<ProductVariant[]> => {
    return apiFetch(`/v1/store/admin/products/${productListingId}/variants`);
  },

  get: (id: string): Promise<ProductVariant> => {
    return apiFetch(`/v1/store/admin/variants/${id}`);
  },

  create: (data: CreateVariantDto): Promise<ProductVariant> => {
    return apiFetch('/v1/store/admin/variants', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: (id: string, data: UpdateVariantDto): Promise<ProductVariant> => {
    return apiFetch(`/v1/store/admin/variants/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: (id: string): Promise<{ success: boolean }> => {
    return apiFetch(`/v1/store/admin/variants/${id}`, {
      method: 'DELETE',
    });
  },

  bulkCreate: (
    productListingId: string,
    variants: CreateVariantDto[]
  ): Promise<ProductVariant[]> => {
    return apiFetch(`/v1/store/admin/products/${productListingId}/variants/bulk`, {
      method: 'POST',
      body: JSON.stringify({ variants }),
    });
  },

  updateStock: (id: string, quantity: number): Promise<ProductVariant> => {
    return apiFetch(`/v1/store/admin/variants/${id}/stock`, {
      method: 'PUT',
      body: JSON.stringify({ quantity }),
    });
  },

  adjustStock: (id: string, adjustment: number): Promise<ProductVariant> => {
    return apiFetch(`/v1/store/admin/variants/${id}/stock/adjust`, {
      method: 'POST',
      body: JSON.stringify({ adjustment }),
    });
  },
};

// ==================== PUBLIC VARIANTS API ====================

export const publicVariantsApi = {
  list: (productSlug: string): Promise<ProductVariant[]> => {
    return apiFetch(`/v1/store/products/${productSlug}/variants`);
  },

  get: (productSlug: string, variantId: string): Promise<ProductVariant> => {
    return apiFetch(`/v1/store/products/${productSlug}/variants/${variantId}`);
  },
};
