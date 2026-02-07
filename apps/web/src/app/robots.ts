import { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/v1/',
          '/app/',  // ERP internal pages
          '/storefront/account/',  // Customer account pages
          '/storefront/checkout/',  // Checkout pages
          '/storefront/order-confirmation/',  // Order confirmation
        ],
      },
      {
        userAgent: 'GPTBot',
        disallow: '/',
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
