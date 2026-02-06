import { Metadata } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://storefront.example.com';

export const metadata: Metadata = {
  title: 'Shop All Products',
  description: 'Browse our full catalog of premium inventory-first products with real-time stock visibility.',
  alternates: {
    canonical: `${BASE_URL}/storefront/products`,
  },
};

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
