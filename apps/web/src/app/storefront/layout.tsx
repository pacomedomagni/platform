import Link from 'next/link';
import { Metadata, Viewport } from 'next';
import { Button, Input } from '@noslag/ui';
import { Search, User } from 'lucide-react';
import { StoreProviders } from './_components/store-providers';
import { CartIcon } from './_components/cart-icon';

export const metadata: Metadata = {
  title: {
    default: 'NoSlag Storefront - Premium Inventory-First Commerce',
    template: '%s | NoSlag Storefront',
  },
  description: 'Premium storefront experience for modern inventory-led brands. Real-time stock visibility, multi-location fulfillment, and ERP-grade control.',
  keywords: ['ecommerce', 'inventory management', 'erp', 'storefront', 'b2b', 'wholesale', 'multi-location'],
  authors: [{ name: 'NoSlag' }],
  creator: 'NoSlag',
  publisher: 'NoSlag',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'NoSlag Storefront',
    title: 'NoSlag Storefront - Premium Inventory-First Commerce',
    description: 'Premium storefront experience for modern inventory-led brands.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NoSlag Storefront',
    description: 'Premium storefront experience for modern inventory-led brands.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#ffffff',
};

const navLinks = [
  { label: 'Home', href: '/storefront' },
  { label: 'Shop', href: '/storefront/products' },
  { label: 'Collections', href: '/storefront#collections' },
  { label: 'Why NoSlag', href: '/storefront#features' },
  { label: 'Support', href: '/storefront#support' },
];

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <StoreProviders>
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur">
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-6">
            <div className="flex items-center gap-8">
              <Link href="/storefront" className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-600 via-blue-500 to-amber-400 text-white flex items-center justify-center text-sm font-semibold shadow-sm">
                  N
                </div>
                <div className="leading-tight">
                  <p className="text-sm font-semibold text-slate-900">NoSlag</p>
                  <p className="text-[11px] text-slate-500">Storefront</p>
                </div>
              </Link>
              <nav className="hidden items-center gap-6 text-sm text-slate-600 lg:flex">
                {navLinks.map((link) => (
                  <Link key={link.label} href={link.href} className="transition-colors hover:text-slate-900">
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-500 md:flex">
                <Search className="h-4 w-4 text-slate-400" />
                <Input
                  className="h-6 w-40 border-0 bg-transparent p-0 text-sm focus-visible:ring-0"
                  placeholder="Search products"
                />
              </div>
              <Link href="/storefront/account" className="hidden items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 sm:flex">
                <User className="h-4 w-4" />
                Account
              </Link>
              <Button variant="outline" size="sm" className="hidden sm:inline-flex">
                Sales inquiry
              </Button>
              <CartIcon />
            </div>
          </div>
        </header>
        <main>{children}</main>
        <footer className="border-t border-slate-200/70 bg-white">
          <div className="mx-auto grid w-full max-w-7xl gap-8 px-6 py-12 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-600 via-blue-500 to-amber-400 text-white flex items-center justify-center text-sm font-semibold shadow-sm">
                  N
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">NoSlag Storefront</p>
                  <p className="text-xs text-slate-500">Built for inventory-first businesses.</p>
                </div>
              </div>
              <p className="text-sm text-slate-500">
                Premium commerce experiences with ERP-grade control, inventory intelligence, and modern operations tooling.
              </p>
            </div>
            <div className="space-y-3 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">Shop</p>
              <Link href="/storefront/products" className="block hover:text-slate-900">All products</Link>
              <Link href="/storefront#collections" className="block hover:text-slate-900">Collections</Link>
              <Link href="/storefront#features" className="block hover:text-slate-900">Experience</Link>
            </div>
            <div className="space-y-3 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">Company</p>
              <Link href="/app" className="block hover:text-slate-900">ERP Suite</Link>
              <Link href="/storefront/account" className="block hover:text-slate-900">My Account</Link>
              <Link href="/storefront#support" className="block hover:text-slate-900">Support</Link>
            </div>
            <div className="space-y-3 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">Contact</p>
              <p>sales@noslag.com</p>
              <p>+1 (415) 000-0000</p>
              <p>Dubai · Lagos · London</p>
            </div>
          </div>
          <div className="border-t border-slate-200/70 py-6 text-center text-xs text-slate-500">
            © 2026 NoSlag. All rights reserved.
          </div>
        </footer>
      </div>
    </StoreProviders>
  );
}
