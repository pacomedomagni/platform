/**
 * Add to Cart Button - Interactive component
 */
'use client';

import { useState } from 'react';
import { ShoppingCart, Check, Loader2 } from 'lucide-react';
import { useCartStore } from '../../../lib/cart-store';

interface AddToCartButtonProps {
  productId: string;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function AddToCartButton({
  productId,
  disabled = false,
  className = '',
  size = 'md',
}: AddToCartButtonProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const addItem = useCartStore((state) => state.addItem);
  // const error = useCartStore((state) => state.error);

  const handleClick = async () => {
    if (disabled || isAdding) return;

    setIsAdding(true);
    try {
      await addItem(productId, 1);
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } catch (err) {
      console.error('Failed to add to cart:', err);
    } finally {
      setIsAdding(false);
    }
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const baseClasses = `
    inline-flex items-center justify-center gap-2 rounded-lg font-semibold
    transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
    ${sizeClasses[size]}
    ${className}
  `;

  if (added) {
    return (
      <button
        className={`${baseClasses} bg-green-500 text-white`}
        disabled
      >
        <Check className="h-4 w-4" />
        Added!
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled || isAdding}
      className={`${baseClasses} ${
        disabled
          ? 'bg-slate-100 text-slate-400'
          : 'bg-slate-900 text-white hover:bg-slate-800'
      }`}
    >
      {isAdding ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Adding...
        </>
      ) : (
        <>
          <ShoppingCart className="h-4 w-4" />
          Add to Cart
        </>
      )}
    </button>
  );
}
