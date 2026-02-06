'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Badge, Card } from '@platform/ui';
import { formatCurrency } from '../_lib/format';
import { AddToCartButton } from './add-to-cart-button';

type ProductCardProps = {
  product: {
    id: string;
    name: string;
    slug: string;
    category: string;
    price: number;
    compareAt?: number;
    rating?: number;
    reviews?: number;
    badge?: 'Best Seller' | 'New Arrival' | 'Limited';
    description: string;
    stockStatus?: 'In Stock' | 'Low Stock' | 'Preorder';
    leadTime?: string;
    tone?: string;
    images?: string[];
  };
  compact?: boolean;
};

export const ProductCard = ({ product, compact }: ProductCardProps) => {
  const tone = product.tone || 'from-blue-50 via-slate-50 to-amber-50';
  const stockStatus = product.stockStatus || 'In Stock';
  const hasImage = product.images && product.images.length > 0;

  return (
    <Card className="group flex h-full flex-col overflow-hidden border-slate-200/80 bg-white/90 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative">
        <Link href={`/storefront/products/${product.slug}`}>
          <div className={`h-44 w-full bg-gradient-to-br ${tone} flex items-center justify-center overflow-hidden`}>
            {hasImage ? (
              <Image
                src={product.images![0]}
                alt={product.name}
                width={300}
                height={176}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
            ) : (
              <div className="h-16 w-16 rounded-2xl bg-white/80 shadow-sm ring-1 ring-white/60 flex items-center justify-center text-sm font-semibold text-slate-500">
                {product.name.split(' ').map((word) => word[0]).join('').slice(0, 2)}
              </div>
            )}
          </div>
        </Link>
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
            <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${
              stockStatus === 'In Stock' 
                ? 'bg-emerald-50 text-emerald-700'
                : stockStatus === 'Low Stock'
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-blue-50 text-blue-700'
            }`}>
              {stockStatus}
            </span>
          </div>
          <Link href={`/storefront/products/${product.slug}`}>
            <h3 className="text-base font-semibold text-slate-900 hover:text-blue-600 transition-colors">
              {product.name}
            </h3>
          </Link>
          {!compact && <p className="text-sm text-slate-500 line-clamp-2">{product.description}</p>}
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold text-slate-900">{formatCurrency(product.price)}</p>
            {product.compareAt && (
              <p className="text-xs text-slate-400 line-through">{formatCurrency(product.compareAt)}</p>
            )}
          </div>
          {product.rating !== undefined && product.reviews !== undefined && (
            <span className="text-xs text-slate-500">
              {product.rating.toFixed(1)} · {product.reviews} reviews
            </span>
          )}
        </div>
        <div className="mt-auto flex items-center gap-3">
          <AddToCartButton 
            productId={product.id} 
            className="flex-1"
          />
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
