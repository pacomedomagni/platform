import { Metadata } from 'next';
import { HeroSection } from '@/components/landing/hero-section';

// 6.16: read the canonical site URL from env so non-NoSlag deploys don't
// emit canonicals that point at noslag.com (which would deindex their
// landing in favor of ours). Falls back to the marketing site for the
// flagship deployment.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://noslag.com';
import { FeaturesGrid } from '@/components/landing/features-grid';
import { Testimonials } from '@/components/landing/testimonials';
import { HowItWorks } from '@/components/landing/how-it-works';
import { PricingTable } from '@/components/landing/pricing-table';
import { FAQAccordion } from '@/components/landing/faq-accordion';
import { CTASection } from '@/components/landing/cta-section';
import { Footer } from '@/components/landing/footer';

export const metadata: Metadata = {
  title: 'NoSlag - Enterprise E-Commerce Platform | Multi-Tenant SaaS',
  description:
    'Build and scale your e-commerce business with NoSlag\'s enterprise-grade platform. Multi-tenant architecture, inventory management, automated workflows, and more. Start your free trial today.',
  keywords: [
    'e-commerce platform',
    'multi-tenant saas',
    'inventory management',
    'order processing',
    'online store',
    'enterprise e-commerce',
    'shopping cart',
    'payment processing',
    'stripe integration',
  ],
  authors: [{ name: 'NoSlag' }],
  creator: 'NoSlag',
  publisher: 'NoSlag',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: `${SITE_URL}/landing`,
    title: 'NoSlag - Enterprise E-Commerce Platform | Multi-Tenant SaaS',
    description:
      'Build and scale your e-commerce business with NoSlag\'s enterprise-grade platform. Multi-tenant architecture, inventory management, automated workflows, and more.',
    siteName: 'NoSlag',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'NoSlag E-Commerce Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NoSlag - Enterprise E-Commerce Platform',
    description:
      'Build and scale your e-commerce business with NoSlag\'s enterprise-grade platform. Start your free trial today.',
    images: ['/og-image.png'],
    creator: '@noslag',
  },
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
  alternates: {
    canonical: `${SITE_URL}/landing`,
  },
};

export default function LandingPage() {
  // JSON-LD structured data for SEO
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'NoSlag',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'AggregateOffer',
      lowPrice: '49',
      highPrice: '149',
      priceCurrency: 'USD',
      priceSpecification: [
        {
          '@type': 'UnitPriceSpecification',
          price: '49',
          priceCurrency: 'USD',
          name: 'Starter Plan',
        },
        {
          '@type': 'UnitPriceSpecification',
          price: '149',
          priceCurrency: 'USD',
          name: 'Professional Plan',
        },
      ],
    },
    // Removed fabricated aggregateRating block — Google's structured-data
    // guidelines require ratings to come from real, on-page user reviews.
    // Add it back once we have collected genuine ratings on this page.
    description:
      'Enterprise-grade multi-tenant e-commerce platform with built-in inventory management, order processing, payment integration, and customer management.',
    featureList: [
      'Multi-Tenant Architecture',
      'Inventory Management',
      'Order Processing',
      'Customer Portal',
      'Payment Processing',
      'Email Automation',
      'Admin Dashboard',
      'WCAG 2.1 AA Accessibility',
    ],
  };

  const organizationData = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'NoSlag',
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    sameAs: [
      'https://twitter.com/noslag',
      'https://www.linkedin.com/company/noslag',
      'https://github.com/noslag',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Customer Support',
      email: 'support@noslag.com',
    },
  };

  return (
    <>
      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationData) }}
      />

      {/* Main content */}
      <main className="overflow-x-hidden">
        <HeroSection />
        <div id="features">
          <FeaturesGrid />
        </div>
        <Testimonials />
        <HowItWorks />
        <div id="pricing">
          <PricingTable />
        </div>
        <div id="faq">
          <FAQAccordion />
        </div>
        <CTASection />
        <Footer />
      </main>
    </>
  );
}
