import Link from 'next/link';
import { Metadata } from 'next';
import { Badge, Button, Card } from '@platform/ui';
import { ArrowRight, Check, Sparkles } from 'lucide-react';
import { productsApi } from '@/lib/store-api';
import { SectionHeader } from './_components/section-header';
import { ProductCard } from './_components/product-card';
import { ButtonLink } from './_components/button-link';

export const metadata: Metadata = {
  title: 'Premium Storefront | NoSlag - Inventory-First Shopping',
  description: 'Shop premium products with real-time inventory visibility. Every item synced to ERP-grade stock control with multi-location support and batch tracking.',
  keywords: ['ecommerce', 'inventory management', 'erp', 'storefront', 'b2b', 'wholesale'],
  openGraph: {
    title: 'Premium Storefront | NoSlag',
    description: 'A storefront that feels premium, yet runs on ERP-grade control.',
    type: 'website',
  },
};

export default async function StorefrontLanding() {
  const [featuredProducts, categories, bestSellersList] = await Promise.all([
    productsApi.getFeatured(2).catch(() => []),
    productsApi.getCategories().catch(() => []),
    productsApi.list({ sortBy: 'sales', limit: 3 }).then(res => res.items).catch(() => []),
  ]);

  return (
    <div className="space-y-20 pb-20">
      <section className="relative overflow-hidden border-b border-border bg-card">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_55%)]" />
        <div className="relative mx-auto grid w-full max-w-7xl gap-12 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <Badge variant="outline" className="bg-card/80 text-muted-foreground">
              Premium storefront UI · Inventory-first
            </Badge>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
              A storefront that feels premium, yet runs on ERP-grade control.
            </h1>
            <p className="text-lg text-muted-foreground">
              Built for operators who need accuracy, transparency, and a refined shopping experience. Every product here
              is synced to the NoSlag inventory engine.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <ButtonLink
                href="/storefront/products"
                className="bg-gradient-to-r from-primary via-secondary to-accent text-primary-foreground shadow-md hover:shadow-lg"
              >
                Explore the collection
              </ButtonLink>
              <Link
                href="/app"
                className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
              >
                Enter ERP Suite <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
              {['Live stock visibility', 'Multi-location ready', 'Batch + FIFO tracking'].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} compact />
            ))}
          </div>
        </div>
      </section>

      <section id="collections" className="mx-auto w-full max-w-7xl space-y-8 px-6">
        <SectionHeader
          eyebrow="Collections"
          title="Curated sets for every operational flow"
          description="Premium fixtures, automation-ready tech, and workspace essentials—all designed to match your brand and inventory cadence."
          actions={
            <Link href="/storefront/products" className="text-sm font-semibold text-primary hover:opacity-80">
              View all products
            </Link>
          }
        />
        <div className="grid gap-4 md:grid-cols-2">
          {categories.map((category) => (
            <Card key={category.name} className="flex items-center justify-between border-border bg-card p-6 shadow-sm">
              <div className="space-y-2">
                <p className="text-lg font-semibold text-foreground">{category.name}</p>
                <p className="text-sm text-muted-foreground">{category.description}</p>
              </div>
              <div className="rounded-full bg-primary/10 px-4 py-2 text-xs font-semibold text-primary">
                {category.productCount} items
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section id="features" className="mx-auto grid w-full max-w-7xl gap-8 px-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-6">
          <SectionHeader
            eyebrow="Experience"
            title="Designed to feel premium, engineered for control"
            description="Every element is tuned for clarity, speed, and the confidence your operators demand."
          />
          <div className="space-y-4 text-sm text-muted-foreground">
            {[
              {
                title: 'Inventory-first merchandising',
                body: 'Surface only what is in stock or available by lead time, with pricing synced to the ERP ledger.',
              },
              {
                title: 'Batch + FIFO visibility',
                body: 'See expiration windows, batch quality, and FIFO priorities right in the product view.',
              },
              {
                title: 'Multi-location promise',
                body: 'Let customers shop by region and fulfillment center without overselling stock.',
              },
            ].map((feature) => (
              <div key={feature.title} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <p className="font-semibold text-foreground">{feature.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {bestSellersList.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
          <Card className="flex flex-col justify-between border-border bg-gradient-to-br from-primary/10 via-card to-accent/10 p-6 shadow-sm">
            <div className="space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Sparkles className="h-5 w-5" />
              </div>
              <p className="text-lg font-semibold text-foreground">Need a custom build?</p>
              <p className="text-sm text-muted-foreground">
                We design tailored storefront experiences with your catalog, brand system, and operational constraints in
                mind.
              </p>
            </div>
            <Button className="mt-6 bg-foreground text-background hover:opacity-90">Book a design session</Button>
          </Card>
        </div>
      </section>

      <section id="support" className="mx-auto w-full max-w-7xl space-y-8 px-6">
        <SectionHeader
          eyebrow="Support"
          title="Concierge onboarding with ERP-grade rigor"
          description="We set up your catalog, connect inventory rules, and ensure every SKU obeys your accounting and warehouse policy."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { title: 'Catalog migration', body: 'White-glove import of items, price lists, and media.' },
            { title: 'Inventory playbooks', body: 'Set FIFO, batch, and multi-location fulfillment rules.' },
            { title: 'Launch assurance', body: 'QA on every flow from pick to delivery confirmation.' },
          ].map((item) => (
            <Card key={item.title} className="border-border bg-card p-6 shadow-sm">
              <p className="text-base font-semibold text-foreground">{item.title}</p>
              <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
