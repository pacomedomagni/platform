import { Metadata } from 'next';
import { HeroSection } from '@/components/landing/hero-section';
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
    url: 'https://noslag.com/landing',
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
    canonical: 'https://noslag.com/landing',
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
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.9',
      ratingCount: '500',
      bestRating: '5',
      worstRating: '1',
    },
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
    url: 'https://noslag.com',
    logo: 'https://noslag.com/logo.png',
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
