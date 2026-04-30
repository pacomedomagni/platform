import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { pagesApi } from '@/lib/store-api';

/**
 * Sanitize HTML content to prevent XSS attacks.
 * Strips script tags, event handlers, and javascript: URLs.
 */
function sanitizeHtml(html: string): string {
  return html
    // Remove <script>...</script> blocks (including multiline)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove event handler attributes (onclick, onerror, onload, etc.)
    .replace(/\son\w+\s*=/gi, ' data-removed=')
    // Remove javascript: URLs
    .replace(/javascript\s*:/gi, 'removed:')
    // Remove vbscript: URLs
    .replace(/vbscript\s*:/gi, 'removed:')
    // Remove data: URLs in href/src attributes (potential XSS via data:text/html)
    .replace(/(href|src)\s*=\s*(['"])\s*data\s*:/gi, '$1=$2removed:')
    // Remove <iframe> tags
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
    // Remove <object> tags
    .replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, '')
    // Remove <embed> tags
    .replace(/<embed\b[^>]*\/?>/gi, '');
}

type PageProps = {
  // Next.js 16: dynamic-route params arrive as a Promise.
  params: Promise<{ slug: string }>;
};

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://storefront.example.com';

/**
 * Generate dynamic metadata for legal/content pages.
 * Provides SEO-friendly titles, descriptions, and canonical URLs.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await pagesApi.getBySlug(slug).catch(() => null);

  if (!page) {
    return {
      title: 'Page Not Found',
    };
  }

  const pageUrl = `${BASE_URL}/storefront/pages/${slug}`;

  return {
    title: page.title,
    description: `${page.title} - NoSlag Storefront`,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title: page.title,
      description: `${page.title} - NoSlag Storefront`,
      url: pageUrl,
      siteName: 'NoSlag Storefront',
    },
  };
}

export default async function StorePage({ params }: PageProps) {
  const { slug } = await params;
  const page = await pagesApi.getBySlug(slug).catch(() => null);

  if (!page) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-12">
      {/* Breadcrumb */}
      <nav className="mb-8 flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/storefront" className="hover:text-foreground">
          Home
        </Link>
        <span>/</span>
        <span className="text-foreground">{page.title}</span>
      </nav>

      {/* Page Title */}
      <h1 className="mb-8 text-3xl font-semibold text-foreground">
        {page.title}
      </h1>

      {/* Page Content */}
      {/* HTML content from the store admin CMS, sanitized before rendering */}
      <article
        className="prose prose-neutral max-w-none dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(page.content) }}
      />

      {/* Last updated */}
      {page.updatedAt && (
        <p className="mt-12 text-xs text-muted-foreground">
          Last updated:{' '}
          {new Date(page.updatedAt).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      )}
    </div>
  );
}
