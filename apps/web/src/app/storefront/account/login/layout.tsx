import { Metadata } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://storefront.example.com';

export const metadata: Metadata = {
  title: 'Login',
  description: 'Sign in to your NoSlag account to manage orders and track shipments.',
  alternates: {
    canonical: `${BASE_URL}/storefront/account/login`,
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
