'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Spinner, ToastAction, toast } from '@platform/ui';
import { Check, ShoppingCart, Zap } from 'lucide-react';
import { useCartStore } from '@/lib/cart-store';
import { ProductVariant } from '@/lib/variants-api';

interface AddToCartButtonProps {
  productId: string;
  productSlug: string;
  productName?: string;
  variant?: 'default' | 'outline';
  selectedVariant?: ProductVariant | null;
  className?: string;
  buyNow?: boolean;
  quantity?: number;
}

const ACK_DURATION_MS = 3000;

export function AddToCartButton({
  productId,
  productSlug,
  productName,
  variant = 'default',
  selectedVariant,
  className = '',
  buyNow = false,
  quantity = 1,
}: AddToCartButtonProps) {
  const router = useRouter();
  const { addItem, isLoading } = useCartStore();
  const [isAdding, setIsAdding] = useState(false);
  const [acked, setAcked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (ackTimer.current) clearTimeout(ackTimer.current);
    };
  }, []);

  const handleAddToCart = async () => {
    setIsAdding(true);
    setError(null);

    try {
      // Use variant's product ID if available, otherwise base product
      const idToAdd = selectedVariant?.id || productId;
      await addItem(idToAdd, quantity);

      if (buyNow) {
        router.push('/storefront/checkout');
        return;
      }

      // Toast w/ "View cart" action
      const displayName = productName || 'Item';
      toast({
        title: 'Added to cart',
        description: `${displayName} · qty ${quantity}`,
        action: (
          <ToastAction
            altText="View cart"
            onClick={() => router.push('/storefront/cart')}
          >
            View cart
          </ToastAction>
        ),
      });

      // Persistent inline ack for 3s
      setAcked(true);
      if (ackTimer.current) clearTimeout(ackTimer.current);
      ackTimer.current = setTimeout(() => setAcked(false), ACK_DURATION_MS);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add to cart');
    } finally {
      setIsAdding(false);
    }
  };

  // The button is disabled while either the local add or the cart-store
  // mutation is in flight. Both flags are set; this is belt-and-braces.
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
        ) : acked ? (
          <>
            <Check className="h-4 w-4 mr-2" aria-hidden="true" />
            Added to cart
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
