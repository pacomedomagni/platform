'use client';

import { useCurrencyStore } from '@/lib/currency-store';

/**
 * Client-side price display for the product detail page.
 * Reacts to currency changes from the currency switcher in the storefront header.
 */
export function ProductPrice({
  price,
  compareAtPrice,
}: {
  price: number;
  compareAtPrice?: number | null;
}) {
  const { formatPrice } = useCurrencyStore();

  return (
    <div className="flex items-center gap-4">
      <p className="text-2xl font-semibold text-foreground">{formatPrice(price)}</p>
      {compareAtPrice && (
        <p className="text-sm text-muted-foreground line-through">{formatPrice(compareAtPrice)}</p>
      )}
    </div>
  );
}
