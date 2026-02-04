import Link from 'next/link';
import { Badge, Card } from '@noslag/ui';
import { StorefrontProduct } from '../_data/products';
import { formatCurrency } from '../_lib/format';
import { ButtonLink } from './button-link';

type ProductCardProps = {
  product: StorefrontProduct;
  compact?: boolean;
};

export const ProductCard = ({ product, compact }: ProductCardProps) => {
  return (
    <Card className="group flex h-full flex-col overflow-hidden border-slate-200/80 bg-white/90 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative">
        <div
          className={`h-44 w-full bg-gradient-to-br ${product.tone} flex items-center justify-center`}
        >
          <div className="h-16 w-16 rounded-2xl bg-white/80 shadow-sm ring-1 ring-white/60 flex items-center justify-center text-sm font-semibold text-slate-500">
            {product.name.split(' ').map((word) => word[0]).join('').slice(0, 2)}
          </div>
        </div>
        {product.badge && (
          <Badge className="absolute left-4 top-4 bg-white/80 text-slate-700 backdrop-blur" variant="outline">
            {product.badge}
          </Badge>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{product.category}</span>
            <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
              {product.stockStatus}
            </span>
          </div>
          <h3 className="text-base font-semibold text-slate-900">{product.name}</h3>
          {!compact && <p className="text-sm text-slate-500">{product.description}</p>}
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold text-slate-900">{formatCurrency(product.price)}</p>
            {product.compareAt && (
              <p className="text-xs text-slate-400 line-through">{formatCurrency(product.compareAt)}</p>
            )}
          </div>
          <span className="text-xs text-slate-500">{product.rating} · {product.reviews} reviews</span>
        </div>
        <div className="mt-auto flex items-center gap-3">
          <ButtonLink
            href="/storefront/cart"
            className="w-full bg-gradient-to-r from-indigo-600 via-blue-600 to-amber-400 text-white shadow-md hover:shadow-lg"
            size="sm"
          >
            Add to cart
          </ButtonLink>
          <Link
            href={`/storefront/products/${product.slug}`}
            className="text-xs font-semibold text-blue-600 hover:text-blue-500"
          >
            View
          </Link>
        </div>
      </div>
    </Card>
  );
};
