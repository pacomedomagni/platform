import { Metadata } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://storefront.example.com';

export const metadata: Metadata = {
  title: 'Create Account',
  description: 'Create your NoSlag account to start shopping with premium inventory-first commerce.',
  alternates: {
    canonical: `${BASE_URL}/storefront/account/register`,
  },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
