import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { Badge, Card } from '@platform/ui';
import { Check, ShieldCheck, Truck } from 'lucide-react';
import { products } from '../../_data/products';
import { formatCurrency } from '../../_lib/format';
import { ProductCard } from '../../_components/product-card';
import { ButtonLink } from '../../_components/button-link';
import { ProductReviews } from './_components/product-reviews';
import { VariantSelector } from './_components/variant-selector';
import {
  generateProductSchema,
  generateBreadcrumbSchema,
  serializeJsonLd,
} from '@/lib/seo/schema';

type ProductPageProps = {
  params: { slug: string };
};

// Base URL for canonical URLs and schemas
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://storefront.example.com';

/**
 * Generate dynamic metadata for product pages
 * Improves SEO with product-specific titles, descriptions, and OpenGraph data
 */
export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const product = products.find((item) => item.slug === params.slug);

  if (!product) {
    return {
      title: 'Product Not Found',
    };
  }

  const productUrl = `${BASE_URL}/storefront/products/${product.slug}`;
  const imageUrl = `${BASE_URL}/og-product-${product.slug}.png`; // Placeholder for actual product image

  return {
    title: `${product.name} - ${product.category}`,
    description: product.description,
    keywords: [product.name, product.category, 'inventory management', 'erp', 'b2b'],
    alternates: {
      canonical: productUrl,
    },
    openGraph: {
      title: product.name,
      description: product.description,
      type: 'product',
      url: productUrl,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: product.name,
        },
      ],
      siteName: 'NoSlag Storefront',
    },
    twitter: {
      card: 'summary_large_image',
      title: product.name,
      description: product.description,
      images: [imageUrl],
    },
  };
}

export default function ProductPage({ params }: ProductPageProps) {
  const product = products.find((item) => item.slug === params.slug);

  if (!product) {
    notFound();
  }

  const related = products.filter((item) => item.category === product.category && item.id !== product.id).slice(0, 3);

  // Generate JSON-LD schemas for SEO
  const productUrl = `${BASE_URL}/storefront/products/${product.slug}`;
  const imageUrl = `${BASE_URL}/og-product-${product.slug}.png`;

  const productSchema = generateProductSchema({
    name: product.name,
    description: product.description,
    image: imageUrl,
    price: product.price,
    currency: 'USD',
    availability: product.stockStatus === 'In Stock' ? 'InStock' : 'OutOfStock',
    sku: product.id,
    url: productUrl,
  });

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: `${BASE_URL}/storefront` },
    { name: 'Products', url: `${BASE_URL}/storefront/products` },
    { name: product.name, url: productUrl },
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
          <span className="text-foreground">{product.name}</span>
        </div>

      <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="overflow-hidden border-border bg-card p-6 shadow-sm">
          <div className={`aspect-[4/3] w-full rounded-2xl bg-gradient-to-br ${product.tone} flex items-center justify-center`}>
            <div className="h-24 w-24 rounded-3xl bg-white/80 shadow-md ring-1 ring-white/70 flex items-center justify-center text-lg font-semibold text-slate-500">
              {product.name.split(' ').map((word) => word[0]).join('').slice(0, 3)}
            </div>
          </div>
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
              {product.category}
            </Badge>
            <h1 className="text-3xl font-semibold text-foreground">{product.name}</h1>
            <p className="text-muted-foreground">{product.description}</p>
            <div className="flex items-center gap-4">
              <p className="text-2xl font-semibold text-foreground">{formatCurrency(product.price)}</p>
              {product.compareAt && (
                <p className="text-sm text-muted-foreground line-through">{formatCurrency(product.compareAt)}</p>
              )}
              <span className="text-xs text-muted-foreground">{product.rating} · {product.reviews} reviews</span>
            </div>
          </div>

          {/* Variant Selector */}
          <VariantSelector
            productSlug={product.slug}
            productId={product.id}
            basePrice={product.price}
          />
          <Card className="space-y-4 border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Availability</span>
              <span className="font-semibold text-emerald-600">{product.stockStatus}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Lead time</span>
              <span className="font-semibold text-foreground">{product.leadTime}</span>
            </div>
            <div className="flex flex-wrap gap-3">
              <ButtonLink
                href="/storefront/cart"
                className="flex-1 bg-gradient-to-r from-primary via-secondary to-accent text-primary-foreground shadow-md hover:shadow-lg"
              >
                Add to cart
              </ButtonLink>
              <ButtonLink href="/storefront/checkout" variant="outline" className="flex-1">
                Buy now
              </ButtonLink>
            </div>
          </Card>
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
            { label: 'Category', value: product.category },
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
          <h2 className="text-xl font-semibold text-foreground">Related in {product.category}</h2>
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
