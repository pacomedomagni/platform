import { Metadata } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://storefront.example.com';

export const metadata: Metadata = {
  title: 'Shopping Cart',
  description: 'Review your cart and proceed to checkout with our secure payment system.',
  alternates: {
    canonical: `${BASE_URL}/storefront/cart`,
  },
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
