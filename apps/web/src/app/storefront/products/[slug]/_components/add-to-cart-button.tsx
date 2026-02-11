'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Spinner } from '@platform/ui';
import { ShoppingCart, Zap } from 'lucide-react';
import { useCartStore } from '@/lib/cart-store';
import { ProductVariant } from '@/lib/variants-api';

interface AddToCartButtonProps {
  productId: string;
  productSlug: string;
  variant?: 'default' | 'outline';
  selectedVariant?: ProductVariant | null;
  className?: string;
  buyNow?: boolean;
}

export function AddToCartButton({
  productId,
  productSlug,
  variant = 'default',
  selectedVariant,
  className = '',
  buyNow = false,
}: AddToCartButtonProps) {
  const router = useRouter();
  const { addItem, isLoading } = useCartStore();
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddToCart = async () => {
    setIsAdding(true);
    setError(null);

    try {
      // Use variant's product ID if available, otherwise base product
      const idToAdd = selectedVariant?.id || productId;
      await addItem(idToAdd, 1);

      if (buyNow) {
        router.push('/storefront/checkout');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add to cart');
    } finally {
      setIsAdding(false);
    }
  };

  const disabled = isAdding || isLoading;

  if (buyNow) {
    return (
      <Button
        variant="outline"
        onClick={handleAddToCart}
        disabled={disabled}
        className={`flex-1 ${className}`}
        aria-busy={disabled}
      >
        {disabled ? (
          <>
            <Spinner className="h-4 w-4 mr-2" aria-hidden="true" />
            Processing...
          </>
        ) : (
          <>
            <Zap className="h-4 w-4 mr-2" aria-hidden="true" />
            Buy now
          </>
        )}
      </Button>
    );
  }

  return (
    <div className="flex-1">
      <Button
        onClick={handleAddToCart}
        disabled={disabled}
        className={`w-full bg-gradient-to-r from-primary via-secondary to-accent text-primary-foreground shadow-md hover:shadow-lg ${className}`}
        aria-busy={disabled}
      >
        {disabled ? (
          <>
            <Spinner className="h-4 w-4 mr-2" aria-hidden="true" />
            Adding...
          </>
        ) : (
          <>
            <ShoppingCart className="h-4 w-4 mr-2" aria-hidden="true" />
            Add to cart
          </>
        )}
      </Button>
      {error && (
        <p className="mt-2 text-xs text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
