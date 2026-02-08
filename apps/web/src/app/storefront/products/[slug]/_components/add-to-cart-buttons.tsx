'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Spinner } from '@platform/ui';
import { ShoppingCart, Zap } from 'lucide-react';
import { useCartStore } from '@/lib/cart-store';

interface AddToCartButtonsProps {
  productId: string;
}

export function AddToCartButtons({ productId }: AddToCartButtonsProps) {
  const router = useRouter();
  const { addItem } = useCartStore();
  const [adding, setAdding] = useState(false);
  const [buying, setBuying] = useState(false);

  const handleAddToCart = async () => {
    setAdding(true);
    try {
      await addItem(productId, 1);
      router.push('/storefront/cart');
    } catch (error) {
      console.error('Failed to add to cart:', error);
    } finally {
      setAdding(false);
    }
  };

  const handleBuyNow = async () => {
    setBuying(true);
    try {
      await addItem(productId, 1);
      router.push('/storefront/checkout');
    } catch (error) {
      console.error('Failed to add to cart:', error);
    } finally {
      setBuying(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-3">
      <Button
        onClick={handleAddToCart}
        disabled={adding || buying}
        className="flex-1 bg-gradient-to-r from-primary via-secondary to-accent text-primary-foreground shadow-md hover:shadow-lg"
      >
        {adding ? (
          <Spinner className="h-4 w-4 mr-2" />
        ) : (
          <ShoppingCart className="h-4 w-4 mr-2" />
        )}
        {adding ? 'Adding...' : 'Add to cart'}
      </Button>
      <Button
        onClick={handleBuyNow}
        disabled={adding || buying}
        variant="outline"
        className="flex-1"
      >
        {buying ? (
          <Spinner className="h-4 w-4 mr-2" />
        ) : (
          <Zap className="h-4 w-4 mr-2" />
        )}
        {buying ? 'Processing...' : 'Buy now'}
      </Button>
    </div>
  );
}
