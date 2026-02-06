import { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static storefront pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/storefront`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${BASE_URL}/storefront/products`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/storefront/cart`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/storefront/account/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/storefront/account/register`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];

  // Try to fetch product slugs for dynamic pages
  let productPages: MetadataRoute.Sitemap = [];
  
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const response = await fetch(`${apiUrl}/api/v1/store/products?limit=1000`, {
      headers: {
        'x-tenant-id': process.env.DEFAULT_TENANT_ID || 'default',
      },
      next: { revalidate: 3600 }, // Revalidate every hour
    });

    if (response.ok) {
      const data = await response.json();
      productPages = data.products?.map((product: { slug: string; updatedAt?: string }) => ({
        url: `${BASE_URL}/storefront/products/${product.slug}`,
        lastModified: product.updatedAt ? new Date(product.updatedAt) : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      })) || [];
    }
  } catch (error) {
    console.error('Failed to fetch products for sitemap:', error);
  }

  return [...staticPages, ...productPages];
}
