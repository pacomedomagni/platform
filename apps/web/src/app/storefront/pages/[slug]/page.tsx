import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { pagesApi } from '@/lib/store-api';

type PageProps = {
  params: { slug: string };
};

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://storefront.example.com';

/**
 * Generate dynamic metadata for legal/content pages.
 * Provides SEO-friendly titles, descriptions, and canonical URLs.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const page = await pagesApi.getBySlug(params.slug).catch(() => null);

  if (!page) {
    return {
      title: 'Page Not Found',
    };
  }

  const pageUrl = `${BASE_URL}/storefront/pages/${params.slug}`;

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
  const page = await pagesApi.getBySlug(params.slug).catch(() => null);

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
      {/*
        NOTE: The HTML content comes from the store admin CMS and is
        rendered via dangerouslySetInnerHTML. In a production hardened
        setup, sanitize with DOMPurify (server-side: isomorphic-dompurify)
        before rendering. The admin-only authoring surface limits the
        attack vector, but sanitization is still recommended.
      */}
      <article
        className="prose prose-neutral max-w-none dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: page.content }}
      />

      {/* Last updated */}
      {page.updatedAt && (
        <p className="mt-12 text-xs text-muted-foreground">
          Last updated:{' '}
          {new Date(page.updatedAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      )}
    </div>
  );
}
