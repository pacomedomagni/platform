import Link from 'next/link';
import { Badge, Button, Card, Input, NativeSelect } from '@noslag/ui';
import { Filter, SlidersHorizontal } from 'lucide-react';
import { products } from '../_data/products';
import { SectionHeader } from '../_components/section-header';
import { ProductCard } from '../_components/product-card';

const filters = [
  { label: 'All', value: 'all' },
  { label: 'Warehouse', value: 'warehouse' },
  { label: 'Front of House', value: 'front' },
  { label: 'Fulfillment Tech', value: 'tech' },
  { label: 'Workspace', value: 'workspace' },
];

export default function ProductsPage() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-10 px-6 py-12">
      <SectionHeader
        eyebrow="Storefront"
        title="Inventory-ready products with premium presentation"
        description="Every product is synced to live inventory rules so you never oversell, even with multi-location stock."
        actions={
          <Link href="/storefront/cart" className="text-sm font-semibold text-blue-600 hover:text-blue-500">
            View cart
          </Link>
        }
      />

      <Card className="flex flex-col gap-4 border-slate-200/70 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-600">
            <Filter className="h-4 w-4 text-slate-400" />
            Filters
          </div>
          {filters.map((filter) => (
            <Badge key={filter.value} variant="outline" className="cursor-pointer bg-white text-slate-600 hover:bg-slate-100">
              {filter.label}
            </Badge>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-60">
            <Input placeholder="Search products" className="h-9" />
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <SlidersHorizontal className="h-4 w-4" />
            <NativeSelect className="h-9">
              <option>Sort by: Featured</option>
              <option>Sort by: Price low to high</option>
              <option>Sort by: Price high to low</option>
              <option>Sort by: Newest</option>
            </NativeSelect>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      <Card className="flex flex-col items-start justify-between gap-4 border-slate-200/70 bg-gradient-to-r from-blue-600 via-indigo-600 to-amber-400 p-6 text-white shadow-lg md:flex-row md:items-center">
        <div>
          <p className="text-xl font-semibold">Need a full-storefront rollout?</p>
          <p className="text-sm text-white/80">We build the merchandising, inventory, and fulfillment flows for you.</p>
        </div>
        <Button className="bg-white text-slate-900 hover:bg-white/90">Talk to sales</Button>
      </Card>
    </div>
  );
}
