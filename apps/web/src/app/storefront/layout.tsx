import Link from 'next/link';
import { Metadata, Viewport } from 'next';
import { Button, Input } from '@platform/ui';
import { Search, User } from 'lucide-react';
import { StoreProviders } from './_components/store-providers';
import { CartIcon } from './_components/cart-icon';
import { CurrencySwitcher } from './_components/currency-switcher';
import { generateOrganizationSchema, serializeJsonLd } from '@/lib/seo/schema';
import { WelcomeWizard } from '../../components/onboarding/welcome-wizard';
import { ProductTour } from '../../components/onboarding/product-tour';

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

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://storefront.example.com';

// Generate Organization JSON-LD schema for brand identity
const organizationSchema = generateOrganizationSchema({
  name: 'NoSlag',
  url: BASE_URL,
  logo: `${BASE_URL}/logo.png`,
  description: 'Premium commerce experiences with ERP-grade control, inventory intelligence, and modern operations tooling.',
  contactEmail: 'sales@noslag.com',
  sameAs: [
    'https://twitter.com/noslag',
    'https://linkedin.com/company/noslag',
  ],
});

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <StoreProviders>
      {/* JSON-LD structured data for Organization */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(organizationSchema) }}
      />
      <div className="min-h-screen bg-slate-50 text-slate-900">
        {/* Skip to content link for keyboard navigation */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Skip to content
        </a>

        <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur" role="banner">
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-6">
            <div className="flex items-center gap-8">
              <Link
                href="/storefront"
                className="flex items-center gap-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                aria-label="NoSlag Storefront home"
              >
                <div
                  className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-600 via-blue-500 to-amber-400 text-white flex items-center justify-center text-sm font-semibold shadow-sm"
                  aria-hidden="true"
                >
                  N
                </div>
                <div className="leading-tight">
                  <p className="text-sm font-semibold text-slate-900">NoSlag</p>
                  <p className="text-[11px] text-slate-500">Storefront</p>
                </div>
              </Link>
              <nav className="hidden items-center gap-6 text-sm text-slate-600 lg:flex" aria-label="Main navigation">
                {navLinks.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="transition-colors hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-500 md:flex">
                <Search className="h-4 w-4 text-slate-400" aria-hidden="true" />
                <label htmlFor="header-search" className="sr-only">
                  Search products
                </label>
                <Input
                  id="header-search"
                  className="h-6 w-40 border-0 bg-transparent p-0 text-sm focus-visible:ring-0"
                  placeholder="Search products"
                  type="search"
                />
              </div>
              <CurrencySwitcher />
              <Link
                href="/storefront/account"
                className="hidden items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 sm:flex focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                aria-label="Go to account"
              >
                <User className="h-4 w-4" aria-hidden="true" />
                <span>Account</span>
              </Link>
              <Button
                variant="outline"
                size="sm"
                className="hidden sm:inline-flex focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Sales inquiry
              </Button>
              <CartIcon />
            </div>
          </div>
        </header>

        <main id="main-content" tabIndex={-1}>
          {children}
        </main>

        {/* Onboarding Components */}
        <WelcomeWizard />
        <ProductTour />

        <footer className="border-t border-slate-200/70 bg-white" role="contentinfo">
          <div className="mx-auto grid w-full max-w-7xl gap-8 px-6 py-12 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div
                  className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-600 via-blue-500 to-amber-400 text-white flex items-center justify-center text-sm font-semibold shadow-sm"
                  aria-hidden="true"
                >
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
            <nav aria-labelledby="footer-shop-heading">
              <div className="space-y-3 text-sm text-slate-600">
                <p id="footer-shop-heading" className="font-semibold text-slate-900">
                  Shop
                </p>
                <Link
                  href="/storefront/products"
                  className="block hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                >
                  All products
                </Link>
                <Link
                  href="/storefront#collections"
                  className="block hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                >
                  Collections
                </Link>
                <Link
                  href="/storefront#features"
                  className="block hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                >
                  Experience
                </Link>
              </div>
            </nav>
            <nav aria-labelledby="footer-company-heading">
              <div className="space-y-3 text-sm text-slate-600">
                <p id="footer-company-heading" className="font-semibold text-slate-900">
                  Company
                </p>
                <Link
                  href="/app"
                  className="block hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                >
                  ERP Suite
                </Link>
                <Link
                  href="/storefront/account"
                  className="block hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                >
                  My Account
                </Link>
                <Link
                  href="/storefront#support"
                  className="block hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                >
                  Support
                </Link>
              </div>
            </nav>
            <div aria-labelledby="footer-contact-heading">
              <div className="space-y-3 text-sm text-slate-600">
                <p id="footer-contact-heading" className="font-semibold text-slate-900">
                  Contact
                </p>
                <address className="not-italic">
                  <p>
                    <a
                      href="mailto:sales@noslag.com"
                      className="hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                    >
                      sales@noslag.com
                    </a>
                  </p>
                  <p>
                    <a
                      href="tel:+14150000000"
                      className="hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                    >
                      +1 (415) 000-0000
                    </a>
                  </p>
                  <p>Dubai · Lagos · London</p>
                </address>
              </div>
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
