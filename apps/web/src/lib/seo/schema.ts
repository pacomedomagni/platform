/**
 * JSON-LD Schema Generators for SEO
 * Following Schema.org specifications for e-commerce
 */

// Type definitions for schema data
export interface ProductSchemaData {
  name: string;
  description: string;
  image: string;
  price: number;
  currency: string;
  availability: 'InStock' | 'OutOfStock' | 'PreOrder';
  brand?: string;
  sku?: string;
  url: string;
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export interface OrganizationData {
  name: string;
  url: string;
  logo: string;
  description?: string;
  contactEmail?: string;
  sameAs?: string[]; // Social media profiles
}

/**
 * Generate Product schema (https://schema.org/Product)
 * Used for product detail pages to enhance search result appearance
 */
export function generateProductSchema(data: ProductSchemaData): object {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: data.name,
    description: data.description,
    image: data.image,
    url: data.url,
    offers: {
      '@type': 'Offer',
      price: data.price.toFixed(2),
      priceCurrency: data.currency,
      availability: `https://schema.org/${data.availability}`,
      url: data.url,
    },
  };

  // Add optional fields if provided
  if (data.brand) {
    schema.brand = {
      '@type': 'Brand',
      name: data.brand,
    };
  }

  if (data.sku) {
    schema.sku = data.sku;
  }

  return schema;
}

/**
 * Generate BreadcrumbList schema (https://schema.org/BreadcrumbList)
 * Helps search engines understand site hierarchy
 */
export function generateBreadcrumbSchema(items: BreadcrumbItem[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * Generate Organization schema (https://schema.org/Organization)
 * Used on homepage/main layout for brand identity
 */
export function generateOrganizationSchema(data: OrganizationData): object {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: data.name,
    url: data.url,
    logo: {
      '@type': 'ImageObject',
      url: data.logo,
    },
  };

  // Add optional fields if provided
  if (data.description) {
    schema.description = data.description;
  }

  if (data.contactEmail) {
    schema.contactPoint = {
      '@type': 'ContactPoint',
      email: data.contactEmail,
      contactType: 'customer service',
    };
  }

  if (data.sameAs && data.sameAs.length > 0) {
    schema.sameAs = data.sameAs;
  }

  return schema;
}

/**
 * Helper function to safely serialize JSON-LD for script tags
 * Prevents XSS by escaping special characters
 */
export function serializeJsonLd(data: object): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

/**
 * Generate WebSite schema for search box (https://schema.org/WebSite)
 * Enables site search in Google results
 */
export interface WebSiteSchemaData {
  name: string;
  url: string;
  searchUrl: string; // URL pattern with {search_term_string}
}

export function generateWebSiteSchema(data: WebSiteSchemaData): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: data.name,
    url: data.url,
    potentialAction: {
      '@type': 'SearchAction',
      target: data.searchUrl,
      'query-input': 'required name=search_term_string',
    },
  };
}
