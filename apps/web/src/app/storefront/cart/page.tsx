'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button, Card, Input, Badge, Spinner } from '@platform/ui';
import { Trash2, Minus, Plus, ShoppingBag } from 'lucide-react';
import { useCartStore } from '@/lib/cart-store';
import { formatCurrency } from '../_lib/format';
import { ButtonLink } from '../_components/button-link';

export default function CartPage() {
  const { 
    items, 
    itemCount, 
    subtotal, 
    shipping, 
    tax, 
    discount, 
    total, 
    couponCode,
    isLoading, 
    initializeCart, 
    updateItem, 
    removeItem,
    applyCoupon,
    removeCoupon,
  } = useCartStore();
  
  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  useEffect(() => {
    initializeCart();
  }, [initializeCart]);

  const handleQuantityChange = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    await updateItem(itemId, newQuantity);
  };

  const handleRemoveItem = async (itemId: string) => {
    await removeItem(itemId);
  };

  const handleApplyCoupon = async () => {
    if (!promoCode.trim()) return;
    
    setPromoLoading(true);
    setPromoError(null);
    
    try {
      await applyCoupon(promoCode);
      setPromoCode('');
    } catch (err) {
      setPromoError(err instanceof Error ? err.message : 'Invalid coupon code');
    } finally {
      setPromoLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl flex items-center justify-center py-32 px-6">
        <Spinner className="h-8 w-8" />
        <span className="ml-3 text-slate-600">Loading cart...</span>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-10 px-6 py-12">
        <Card className="flex flex-col items-center justify-center p-16 text-center">
          <ShoppingBag className="h-16 w-16 text-slate-300 mb-6" />
          <h2 className="text-2xl font-semibold text-slate-900 mb-2">Your cart is empty</h2>
          <p className="text-slate-500 mb-6">Looks like you haven&apos;t added any items to your cart yet.</p>
          <ButtonLink
            href="/storefront/products"
            className="bg-gradient-to-r from-indigo-600 via-blue-600 to-amber-400 text-white shadow-md hover:shadow-lg"
          >
            Start Shopping
          </ButtonLink>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-10 px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Your cart</h1>
          <p className="text-sm text-slate-500">Review your items and proceed to checkout.</p>
        </div>
        <Badge variant="outline" className="bg-white text-slate-600">
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-4">
          {items.map((item) => (
            <Card key={item.id} className="flex flex-col gap-4 border-slate-200/70 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
              <div className="h-24 w-32 rounded-xl bg-gradient-to-br from-blue-50 via-slate-50 to-amber-50 flex items-center justify-center overflow-hidden">
                {item.image ? (
                  <Image 
                    src={item.image} 
                    alt={item.name} 
                    width={128} 
                    height={96} 
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-2xl bg-white/80 shadow-sm flex items-center justify-center text-xs font-semibold text-slate-500">
                    {item.name.split(' ').map((word) => word[0]).join('').slice(0, 2)}
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <Link 
                    href={`/storefront/products/${item.productId}`}
                    className="text-base font-semibold text-slate-900 hover:text-blue-600"
                  >
                    {item.name}
                  </Link>
                  <p className="text-base font-semibold text-slate-900">
                    {formatCurrency(item.price * item.quantity)}
                  </p>
                </div>
                {item.variant && (
                  <p className="text-sm text-slate-500">{item.variant}</p>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span>Qty</span>
                    <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                      <button 
                        className="text-slate-400 hover:text-slate-600 disabled:opacity-50"
                        onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="text-slate-700 min-w-[20px] text-center">{item.quantity}</span>
                      <button 
                        className="text-slate-400 hover:text-slate-600"
                        onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <span className="text-slate-400">
                      {formatCurrency(item.price)} each
                    </span>
                  </div>
                  <button 
                    className="text-slate-400 hover:text-red-500 p-1"
                    onClick={() => handleRemoveItem(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Card className="h-fit space-y-5 border-slate-200/70 bg-white p-6 shadow-sm">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">Order summary</h2>
            <p className="text-sm text-slate-500">Shipping calculated by fulfillment region.</p>
          </div>
          <div className="space-y-3 text-sm text-slate-600">
            <div className="flex items-center justify-between">
              <span>Subtotal</span>
              <span className="font-semibold text-slate-900">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Shipping</span>
              <span className="font-semibold text-slate-900">
                {shipping > 0 ? formatCurrency(shipping) : 'Calculated at checkout'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Tax</span>
              <span className="font-semibold text-slate-900">
                {tax > 0 ? formatCurrency(tax) : 'Calculated at checkout'}
              </span>
            </div>
            {discount > 0 && (
              <div className="flex items-center justify-between text-green-600">
                <span className="flex items-center gap-2">
                  Discount
                  {couponCode && (
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                      {couponCode}
                      <button 
                        className="ml-1 hover:text-green-900"
                        onClick={() => removeCoupon()}
                      >
                        ×
                      </button>
                    </Badge>
                  )}
                </span>
                <span className="font-semibold">-{formatCurrency(discount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-base font-semibold text-slate-900">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
          <div className="space-y-3">
            <ButtonLink
              href="/storefront/checkout"
              className="w-full bg-gradient-to-r from-indigo-600 via-blue-600 to-amber-400 text-white shadow-md hover:shadow-lg"
            >
              Proceed to checkout
            </ButtonLink>
            <Link href="/storefront/products" className="block text-center text-sm font-medium text-slate-500 hover:text-slate-700">
              Continue shopping
            </Link>
          </div>
          {!couponCode && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-[0.2em]">Have a code?</p>
              <div className="flex items-center gap-2">
                <Input 
                  className="h-9" 
                  placeholder="Promo code" 
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                />
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleApplyCoupon}
                  disabled={promoLoading || !promoCode.trim()}
                >
                  {promoLoading ? <Spinner className="h-4 w-4" /> : 'Apply'}
                </Button>
              </div>
              {promoError && (
                <p className="text-xs text-red-500">{promoError}</p>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
