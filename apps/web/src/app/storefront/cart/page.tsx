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
      <div
        className="mx-auto w-full max-w-7xl flex items-center justify-center py-32 px-6"
        role="status"
        aria-live="polite"
      >
        <Spinner className="h-8 w-8" aria-hidden="true" />
        <span className="ml-3 text-muted-foreground">Loading cart...</span>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-10 px-6 py-12">
        <Card
          className="flex flex-col items-center justify-center p-16 text-center"
          role="status"
        >
          <ShoppingBag className="h-16 w-16 text-muted mb-6" aria-hidden="true" />
          <h1 className="text-2xl font-semibold text-foreground mb-2">Your cart is empty</h1>
          <p className="text-muted-foreground mb-6">Looks like you haven&apos;t added any items to your cart yet.</p>
          <ButtonLink
            href="/storefront/products"
            className="bg-gradient-to-r from-primary via-secondary to-accent text-primary-foreground shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            Start Shopping
          </ButtonLink>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-10 px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Your cart</h1>
          <p className="text-sm text-muted-foreground">Review your items and proceed to checkout.</p>
        </div>
        <Badge
          variant="outline"
          className="bg-card text-muted-foreground"
          aria-label={`${itemCount} ${itemCount === 1 ? 'item' : 'items'} in cart`}
        >
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </Badge>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <main aria-labelledby="cart-items-heading">
          <h2 id="cart-items-heading" className="sr-only">
            Shopping Cart Items
          </h2>
          <div className="space-y-4" role="list" aria-label="Cart items">
            {items.map((item) => (
              <Card
                key={item.id}
                className="flex flex-col gap-4 border-border bg-card p-5 shadow-sm sm:flex-row sm:items-center"
                role="listitem"
              >
                <div
                  className="h-24 w-32 rounded-xl bg-gradient-to-br from-blue-50 via-slate-50 to-amber-50 flex items-center justify-center overflow-hidden"
                  aria-hidden="true"
                >
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
                      href={`/storefront/products/${item.slug}`}
                      className="text-base font-semibold text-foreground hover:text-primary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
                    >
                      {item.name}
                    </Link>
                    <p className="text-base font-semibold text-foreground">
                      {formatCurrency(item.price * item.quantity)}
                    </p>
                  </div>
                  {item.variant && (
                    <p className="text-sm text-muted-foreground">{item.variant}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span id={`quantity-label-${item.id}`}>Qty</span>
                      <div
                        className="flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1"
                        role="group"
                        aria-labelledby={`quantity-label-${item.id}`}
                      >
                        <button
                          className="text-muted-foreground hover:text-foreground disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring rounded"
                          onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          aria-label={`Decrease quantity of ${item.name}`}
                        >
                          <Minus className="h-3 w-3" aria-hidden="true" />
                        </button>
                        <span
                          className="text-foreground min-w-[20px] text-center"
                          aria-live="polite"
                          aria-atomic="true"
                        >
                          {item.quantity}
                        </span>
                        <button
                          className="text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring rounded"
                          onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                          aria-label={`Increase quantity of ${item.name}`}
                        >
                          <Plus className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </div>
                      <span className="text-muted-foreground">
                        {formatCurrency(item.price)} each
                      </span>
                    </div>
                    <button
                      className="text-muted-foreground hover:text-destructive p-1 focus:outline-none focus:ring-2 focus:ring-destructive rounded"
                      onClick={() => handleRemoveItem(item.id)}
                      aria-label={`Remove ${item.name} from cart`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </main>

        <aside aria-labelledby="order-summary-heading">
          <Card className="h-fit space-y-5 border-border bg-card p-6 shadow-sm">
            <div className="space-y-2">
              <h2 id="order-summary-heading" className="text-lg font-semibold text-foreground">
                Order summary
              </h2>
              <p className="text-sm text-muted-foreground">Shipping calculated by fulfillment region.</p>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Subtotal</span>
                <span className="font-semibold text-foreground">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Shipping</span>
                <span className="font-semibold text-foreground">
                  {shipping > 0 ? formatCurrency(shipping) : 'Calculated at checkout'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Tax</span>
                <span className="font-semibold text-foreground">
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
                          className="ml-1 hover:text-green-900 focus:outline-none focus:ring-2 focus:ring-ring rounded"
                          onClick={() => removeCoupon()}
                          aria-label={`Remove coupon ${couponCode}`}
                        >
                          ×
                        </button>
                      </Badge>
                    )}
                  </span>
                  <span className="font-semibold">-{formatCurrency(discount)}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-border pt-3 text-base font-semibold text-foreground">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
            <div className="space-y-3">
              <ButtonLink
                href="/storefront/checkout"
                className="w-full bg-gradient-to-r from-primary via-secondary to-accent text-primary-foreground shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                Proceed to checkout
              </ButtonLink>
              <Link
                href="/storefront/products"
                className="block text-center text-sm font-medium text-muted-foreground hover:text-foreground hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
              >
                Continue shopping
              </Link>
            </div>
            {!couponCode && (
              <div className="space-y-2">
                <label
                  htmlFor="promo-code"
                  className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.2em]"
                >
                  Have a code?
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    id="promo-code"
                    className="h-9"
                    placeholder="Promo code"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                    aria-describedby={promoError ? 'promo-error' : undefined}
                    aria-invalid={promoError ? 'true' : 'false'}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleApplyCoupon}
                    disabled={promoLoading || !promoCode.trim()}
                    aria-busy={promoLoading}
                  >
                    {promoLoading ? <Spinner className="h-4 w-4" aria-hidden="true" /> : 'Apply'}
                  </Button>
                </div>
                {promoError && (
                  <p id="promo-error" className="text-xs text-red-500" role="alert">
                    {promoError}
                  </p>
                )}
              </div>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
