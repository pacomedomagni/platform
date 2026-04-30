import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { Badge, Card } from '@platform/ui';
import { Check, ShieldCheck, Truck } from 'lucide-react';
import { ProductCard } from '../../_components/product-card';
import { ProductReviews } from './_components/product-reviews';
import { ProductPrice } from './_components/product-price';
import { BuySection } from './_components/buy-section';
import { ImageGallery } from './_components/image-gallery';
import {
  LocalizedProductName,
  LocalizedProductDescription,
} from './_components/localized-product-info';
import { productsApi } from '@/lib/store-api';
import {
  generateProductSchema,
  generateBreadcrumbSchema,
  serializeJsonLd,
} from '@/lib/seo/schema';

type ProductPageProps = {
  // Next.js 16: dynamic-route params arrive as a Promise.
  params: Promise<{ slug: string }>;
};

// Base URL for canonical URLs and schemas
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://storefront.example.com';

/**
 * Generate dynamic metadata for product pages
 * Improves SEO with product-specific titles, descriptions, and OpenGraph data
 */
export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await productsApi.get(slug).catch(() => null);

  if (!product) {
    return {
      title: 'Product Not Found',
    };
  }

  const categoryName = product.category?.name || 'Uncategorized';
  const productUrl = `${BASE_URL}/storefront/products/${product.slug}`;
  const imageUrl = product.images?.[0] || `${BASE_URL}/og-product-${product.slug}.png`;

  return {
    title: `${product.displayName} - ${categoryName}`,
    description: product.description || product.shortDescription,
    keywords: [product.displayName, categoryName, 'inventory management', 'erp', 'b2b'],
    alternates: {
      canonical: productUrl,
    },
    openGraph: {
      title: product.displayName,
      description: product.description || product.shortDescription || '',
      url: productUrl,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: product.displayName,
        },
      ],
      siteName: 'NoSlag Storefront',
    },
    twitter: {
      card: 'summary_large_image',
      title: product.displayName,
      description: product.description || '',
      images: [imageUrl],
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await productsApi.get(slug).catch(() => null);

  if (!product) {
    notFound();
  }

  const relatedRes = await productsApi.list({ categorySlug: product.category?.slug, limit: 4 }).catch(() => ({ data: [] }));
  const relatedRaw = relatedRes.data.filter((item) => item.id !== product.id).slice(0, 3);

  // Map raw API products to the shape expected by ProductCard
  const mapProductForCard = (p: any) => ({
    id: p.id,
    name: p.name || p.displayName,
    slug: p.slug,
    category: typeof p.category === 'string' ? p.category : p.category?.name || 'Uncategorized',
    price: p.price,
    compareAt: p.compareAtPrice || undefined,
    rating: p.averageRating ?? undefined,
    reviews: p.reviewCount ?? 0,
    badge: p.tags?.includes('bestseller')
      ? ('Best Seller' as const)
      : p.tags?.includes('new')
        ? ('New Arrival' as const)
        : undefined,
    description: p.shortDescription || p.description?.substring(0, 100) || '',
    stockStatus: (p.trackInventory && (p.quantity ?? p.stockQuantity) === 0)
      ? ('Low Stock' as const)
      : ('In Stock' as const),
    leadTime: p.leadTime ?? undefined,
    tone: 'from-blue-50 via-slate-50 to-amber-50',
    images: p.images,
  });

  const related = relatedRaw.map(mapProductForCard);

  const categoryName = product.category?.name || 'Uncategorized';
  const allImages: string[] = product.images?.length ? product.images : [];
  const displayImage = allImages[0] || null; // Fallback to gradient if null

  // Generate JSON-LD schemas for SEO
  const productUrl = `${BASE_URL}/storefront/products/${product.slug}`;
  const imageUrl = displayImage || `${BASE_URL}/og-product-${product.slug}.png`;

  const schemaCurrency = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY || 'USD';

  const productSchema = generateProductSchema({
    name: product.displayName,
    description: product.description || product.shortDescription || '',
    image: imageUrl,
    price: product.price,
    currency: schemaCurrency,
    availability: product.stockStatus === 'in_stock' ? 'InStock' : 'OutOfStock',
    sku: product.id,
    url: productUrl,
  });

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: `${BASE_URL}/storefront` },
    { name: 'Products', url: `${BASE_URL}/storefront/products` },
    { name: product.displayName, url: productUrl },
  ]);

  return (
    <>
      {/* JSON-LD structured data for Product */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(productSchema) }}
      />
      {/* JSON-LD structured data for Breadcrumb */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbSchema) }}
      />

      <div className="mx-auto w-full max-w-7xl space-y-12 px-6 py-12">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Link href="/storefront" className="hover:text-foreground">Storefront</Link>
          <span>/</span>
          <Link href="/storefront/products" className="hover:text-foreground">Products</Link>
          <span>/</span>
          <span className="text-foreground">{product.displayName}</span>
        </div>

      <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="overflow-hidden border-border bg-card p-6 shadow-sm">
          {allImages.length > 1 ? (
            <ImageGallery images={allImages} alt={product.displayName} />
          ) : displayImage ? (
            <div className="aspect-[4/3] w-full rounded-2xl overflow-hidden flex items-center justify-center bg-white">
               <img src={displayImage} alt={product.displayName} className="h-full w-full object-contain" />
            </div>
          ) : (
            <div className={`aspect-[4/3] w-full rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center`}>
                <div className="h-24 w-24 rounded-3xl bg-white/80 shadow-md ring-1 ring-white/70 flex items-center justify-center text-lg font-semibold text-slate-500">
                {product.displayName.split(' ').map((word: string) => word[0]).join('').slice(0, 3)}
                </div>
            </div>
          )}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {['Precision build', 'Inventory synced', 'Premium warranty', 'ERP ready'].map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                <Check className="h-3.5 w-3.5 text-primary" />
                {item}
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-6">
          <div className="space-y-3">
            <Badge variant="outline" className="bg-card text-muted-foreground">
              {categoryName}
            </Badge>
            <h1 className="text-3xl font-semibold text-foreground">
              <LocalizedProductName productId={product.id} displayName={product.displayName} />
            </h1>
            <p className="text-muted-foreground">
              <LocalizedProductDescription productId={product.id} description={product.description || product.shortDescription} />
            </p>
            <ProductPrice price={product.price} compareAtPrice={product.compareAtPrice} />
          </div>

          {/*
            Client wrapper that owns selectedVariant state and shares it
            with both AddToCartButton renders. Replaces the previous shape
            where the variant selector and AddToCart were independent —
            buyers selecting Red/XL silently got the default SKU added.
            See SF-PD1/SF-PD2 in docs/ui-audit.md.
          */}
          <BuySection
            productId={product.id}
            productSlug={product.slug}
            productName={product.displayName}
            basePrice={product.price}
            stockStatus={product.stockStatus}
            leadTime={product.leadTime ?? null}
          />
          {/* Hardcoded "3-5 business days" lead-time copy moved into BuySection;
             when the API returns a real leadTime it is used, otherwise the
             field is hidden rather than lying to the buyer. */}
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { title: 'Quality guarantee', icon: ShieldCheck },
              { title: 'White-glove delivery', icon: Truck },
              { title: 'Inventory support', icon: Check },
            ].map((item) => (
              <Card key={item.title} className="flex items-center gap-2 border-border bg-card p-3 text-xs text-muted-foreground shadow-sm">
                <item.icon className="h-4 w-4 text-primary" />
                {item.title}
              </Card>
            ))}
          </div>
        </div>
      </div>

      <Card className="border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Specifications</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {[
            { label: 'SKU', value: product.id },
            { label: 'Category', value: categoryName },
            { label: 'Fulfillment', value: 'Multi-location ready' },
            { label: 'Tracking', value: 'Batch + FIFO compatible' },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between rounded-xl border border-border bg-muted px-4 py-3 text-sm">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-semibold text-foreground">{item.value}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Product Reviews */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">Customer Reviews</h2>
        <ProductReviews productId={product.id} productSlug={product.slug} />
      </div>

      {related.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Related in {categoryName}</h2>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </div>
      )}
      </div>
    </>
  );
}
