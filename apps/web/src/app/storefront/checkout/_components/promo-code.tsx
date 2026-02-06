'use client';

import { useState } from 'react';
import { Button, Input, Spinner, Badge } from '@platform/ui';
import { Tag, X, AlertCircle } from 'lucide-react';
import { useCartStore } from '@/lib/cart-store';

export function PromoCode() {
  const { couponCode, applyCoupon, removeCoupon } = useCartStore();
  const [promoInput, setPromoInput] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInput, setShowInput] = useState(!couponCode);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoInput.trim()) return;

    setIsApplying(true);
    setError(null);

    try {
      await applyCoupon(promoInput.trim());
      setPromoInput('');
      setShowInput(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid promo code');
    } finally {
      setIsApplying(false);
    }
  };

  const handleRemove = async () => {
    try {
      await removeCoupon();
      setShowInput(true);
      setError(null);
    } catch (err) {
      console.error('Failed to remove coupon:', err);
    }
  };

  if (couponCode && !showInput) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-green-700" />
            <span className="text-sm font-semibold text-green-900">Promo Code Applied</span>
          </div>
          <Badge variant="success" className="flex items-center gap-1">
            {couponCode}
            <button
              onClick={handleRemove}
              className="ml-1 hover:text-emerald-900"
              aria-label={`Remove promo code ${couponCode}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {!showInput ? (
        <button
          onClick={() => setShowInput(true)}
          className="flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-500 hover:underline"
        >
          <Tag className="h-4 w-4" />
          Add promo code
        </button>
      ) : (
        <form onSubmit={handleApply} className="space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                placeholder="Enter promo code"
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                className="h-10 pl-10"
                disabled={isApplying}
              />
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={isApplying || !promoInput.trim()}
              className="h-10"
            >
              {isApplying ? (
                <>
                  <Spinner className="h-4 w-4 mr-1" />
                  Applying...
                </>
              ) : (
                'Apply'
              )}
            </Button>
          </div>
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
