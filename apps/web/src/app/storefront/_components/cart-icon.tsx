/**
 * Cart Icon with real-time item count
 */
'use client';

import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { useCartStore } from '../../../lib/cart-store';

export function CartIcon() {
  const itemCount = useCartStore((state) => state.itemCount);

  return (
    <Link
      href="/storefront/cart"
      className="relative rounded-full border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:text-slate-900"
    >
      <ShoppingCart className="h-4 w-4" />
      {itemCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[10px] font-semibold text-slate-900">
          {itemCount > 99 ? '99+' : itemCount}
        </span>
      )}
    </Link>
  );
}
