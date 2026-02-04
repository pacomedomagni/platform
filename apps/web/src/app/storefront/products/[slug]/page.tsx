import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Card } from '@noslag/ui';
import { Check, ShieldCheck, Truck } from 'lucide-react';
import { products } from '../../_data/products';
import { formatCurrency } from '../../_lib/format';
import { ProductCard } from '../../_components/product-card';
import { ButtonLink } from '../../_components/button-link';

type ProductPageProps = {
  params: { slug: string };
};

export default function ProductPage({ params }: ProductPageProps) {
  const product = products.find((item) => item.slug === params.slug);

  if (!product) {
    notFound();
  }

  const related = products.filter((item) => item.category === product.category && item.id !== product.id).slice(0, 3);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-12 px-6 py-12">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <Link href="/storefront" className="hover:text-slate-900">Storefront</Link>
        <span>/</span>
        <Link href="/storefront/products" className="hover:text-slate-900">Products</Link>
        <span>/</span>
        <span className="text-slate-700">{product.name}</span>
      </div>

      <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="overflow-hidden border-slate-200/70 bg-white p-6 shadow-sm">
          <div className={`aspect-[4/3] w-full rounded-2xl bg-gradient-to-br ${product.tone} flex items-center justify-center`}>
            <div className="h-24 w-24 rounded-3xl bg-white/80 shadow-md ring-1 ring-white/70 flex items-center justify-center text-lg font-semibold text-slate-500">
              {product.name.split(' ').map((word) => word[0]).join('').slice(0, 3)}
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {['Precision build', 'Inventory synced', 'Premium warranty', 'ERP ready'].map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-xl border border-slate-200/70 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <Check className="h-3.5 w-3.5 text-blue-600" />
                {item}
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-6">
          <div className="space-y-3">
            <Badge variant="outline" className="bg-white text-slate-600">
              {product.category}
            </Badge>
            <h1 className="text-3xl font-semibold text-slate-900">{product.name}</h1>
            <p className="text-slate-500">{product.description}</p>
            <div className="flex items-center gap-4">
              <p className="text-2xl font-semibold text-slate-900">{formatCurrency(product.price)}</p>
              {product.compareAt && (
                <p className="text-sm text-slate-400 line-through">{formatCurrency(product.compareAt)}</p>
              )}
              <span className="text-xs text-slate-500">{product.rating} · {product.reviews} reviews</span>
            </div>
          </div>
          <Card className="space-y-4 border-slate-200/70 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Availability</span>
              <span className="font-semibold text-emerald-600">{product.stockStatus}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Lead time</span>
              <span className="font-semibold text-slate-900">{product.leadTime}</span>
            </div>
            <div className="flex flex-wrap gap-3">
              <ButtonLink
                href="/storefront/cart"
                className="flex-1 bg-gradient-to-r from-indigo-600 via-blue-600 to-amber-400 text-white shadow-md hover:shadow-lg"
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
              <Card key={item.title} className="flex items-center gap-2 border-slate-200/70 bg-white p-3 text-xs text-slate-600 shadow-sm">
                <item.icon className="h-4 w-4 text-blue-600" />
                {item.title}
              </Card>
            ))}
          </div>
        </div>
      </div>

      <Card className="border-slate-200/70 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Specifications</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {[
            { label: 'SKU', value: product.id },
            { label: 'Category', value: product.category },
            { label: 'Fulfillment', value: 'Multi-location ready' },
            { label: 'Tracking', value: 'Batch + FIFO compatible' },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-slate-50 px-4 py-3 text-sm">
              <span className="text-slate-500">{item.label}</span>
              <span className="font-semibold text-slate-900">{item.value}</span>
            </div>
          ))}
        </div>
      </Card>

      {related.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-900">Related in {product.category}</h2>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
