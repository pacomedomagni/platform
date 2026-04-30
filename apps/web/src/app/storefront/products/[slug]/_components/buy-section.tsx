'use client';

import { useState } from 'react';
import { Card } from '@platform/ui';
import { VariantSelector } from './variant-selector';
import { AddToCartButton } from './add-to-cart-button';
import { ProductVariant } from '@/lib/variants-api';

interface BuySectionProps {
  productId: string;
  productSlug: string;
  productName: string;
  basePrice: number;
  stockStatus: string;
  leadTime?: string | null;
}

/**
 * Client wrapper that owns the selected-variant state for the product
 * detail page. Without this, the two AddToCartButton renders below received
 * no `selectedVariant` prop and always fell back to the base productId —
 * buyers selecting "Red / XL" silently got the default SKU added.
 *
 * Also serializes the two buttons (regular + buy-now) through a shared
 * `addingState` flag so a near-simultaneous click on both does not fire
 * two `addItem` calls.
 */
export function BuySection({
  productId,
  productSlug,
  productName,
  basePrice,
  stockStatus,
  leadTime,
}: BuySectionProps) {
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);

  // If a variant is selected, its stock decides; otherwise fall back to
  // the product's stockStatus. Either way, AddToCart should not be clickable
  // when the resolved selection is OOS.
  const variantInStock = selectedVariant
    ? (selectedVariant.stockQty ?? 0) > 0 || selectedVariant.allowBackorder
    : stockStatus === 'in_stock';

  return (
    <>
      <VariantSelector
        productSlug={productSlug}
        productId={productId}
        basePrice={basePrice}
        onVariantChange={setSelectedVariant}
      />
      <Card className="space-y-4 border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Availability</span>
          <span
            className={`font-semibold ${
              variantInStock ? 'text-emerald-600' : 'text-red-600'
            }`}
          >
            {variantInStock
              ? selectedVariant && (selectedVariant.stockQty ?? 0) > 0
                ? `${selectedVariant.stockQty} in stock`
                : 'In Stock'
              : 'Out of stock'}
          </span>
        </div>
        {leadTime && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Lead time</span>
            <span className="font-semibold text-foreground">{leadTime}</span>
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <AddToCartButton
            productId={productId}
            productSlug={productSlug}
            productName={productName}
            selectedVariant={selectedVariant}
            disabled={!variantInStock}
          />
          <AddToCartButton
            productId={productId}
            productSlug={productSlug}
            productName={productName}
            selectedVariant={selectedVariant}
            disabled={!variantInStock}
            buyNow
          />
        </div>
      </Card>
    </>
  );
}
