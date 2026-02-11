/**
 * Customer Wishlist Page
 * View and manage wishlist items
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Card, Button, Badge } from '@platform/ui';
import { Heart, Trash2, ShoppingCart, Share2, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../../lib/auth-store';
import { useCartStore } from '../../../lib/cart-store';
import { wishlistApi, WishlistDetail, WishlistItem } from '../../../lib/wishlist-api';
import { formatCurrency } from '../_lib/format';

export default function WishlistPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const { cartId } = useCartStore();

  const [wishlist, setWishlist] = useState<WishlistDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/storefront/account/login?redirect=/storefront/wishlist');
      return;
    }

    if (isAuthenticated) {
      loadWishlist();
    }
  }, [isAuthenticated, authLoading, router]);

  const loadWishlist = async () => {
    try {
      const lists = await wishlistApi.list();
      if (lists.length > 0) {
        const defaultList = lists.find(l => l.isDefault) || lists[0];
        const detail = await wishlistApi.get(defaultList.id);
        setWishlist(detail);
      } else {
        setWishlist(null);
      }
    } catch {
      setError('Failed to load wishlist');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    setRemovingId(itemId);
    try {
      await wishlistApi.removeItem(itemId);
      setWishlist(prev => prev ? {
        ...prev,
        items: prev.items.filter(i => i.id !== itemId),
      } : null);
    } catch {
      setError('Failed to remove item');
    } finally {
      setRemovingId(null);
    }
  };

  const handleMoveToCart = async (item: WishlistItem) => {
    if (!cartId) {
      setError('No cart found. Please add an item from the store first.');
      return;
    }
    setMovingId(item.id);
    try {
      await wishlistApi.moveToCart(item.id, cartId);
      setWishlist(prev => prev ? {
        ...prev,
        items: prev.items.filter(i => i.id !== item.id),
      } : null);
    } catch {
      setError('Failed to move item to cart');
    } finally {
      setMovingId(null);
    }
  };

  const handleShare = async () => {
    if (!wishlist?.shareUrl) return;
    const url = `${window.location.origin}/storefront${wishlist.shareUrl}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      window.prompt('Copy this link:', url);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="mx-auto w-full max-w-4xl px-6 py-20">
        <div className="flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-6 py-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">My Wishlist</h1>
          <p className="text-sm text-slate-500">
            {wishlist?.items.length || 0} item{(wishlist?.items.length || 0) !== 1 ? 's' : ''} saved
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/storefront/account"
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-500"
          >
            <ArrowLeft className="h-4 w-4" /> Account
          </Link>
          {wishlist?.isPublic && wishlist?.shareUrl && (
            <Button variant="outline" size="sm" onClick={handleShare} className="gap-2">
              <Share2 className="h-4 w-4" />
              {copied ? 'Copied!' : 'Share'}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}

      {/* Items */}
      {!wishlist || wishlist.items.length === 0 ? (
        <Card className="border-slate-200/70 bg-white p-12 text-center shadow-sm">
          <Heart className="mx-auto h-12 w-12 text-slate-300" />
          <h2 className="mt-4 text-lg font-semibold text-slate-900">Your wishlist is empty</h2>
          <p className="mt-2 text-sm text-slate-500">
            Save items you love for later — browse the store to start adding.
          </p>
          <Link
            href="/storefront/products"
            className="mt-6 inline-block rounded-lg bg-gradient-to-r from-indigo-600 via-blue-600 to-amber-400 px-6 py-3 text-sm font-semibold text-white shadow-md"
          >
            Browse Products
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {wishlist.items.map((item) => {
            const currentPrice = item.variant?.price ?? item.product.price;
            const priceDropped = item.priceWhenAdded && currentPrice < item.priceWhenAdded;
            const displayImage = item.variant?.imageUrl || item.product.images?.[0];

            return (
              <Card key={item.id} className="border-slate-200/70 bg-white p-5 shadow-sm">
                <div className="flex gap-5">
                  {/* Image */}
                  <Link href={`/storefront/products/${item.product.slug}`} className="shrink-0">
                    <div className="h-24 w-24 overflow-hidden rounded-lg bg-gradient-to-br from-blue-50 via-slate-50 to-amber-50">
                      {displayImage ? (
                        <Image
                          src={displayImage}
                          alt={item.product.name}
                          width={96}
                          height={96}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs font-semibold text-slate-400">
                          {item.product.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                        </div>
                      )}
                    </div>
                  </Link>

                  {/* Details */}
                  <div className="flex flex-1 flex-col justify-between">
                    <div>
                      <Link
                        href={`/storefront/products/${item.product.slug}`}
                        className="font-semibold text-slate-900 hover:text-blue-600"
                      >
                        {item.product.name}
                      </Link>
                      {item.product.category && (
                        <p className="text-xs text-slate-500">{item.product.category}</p>
                      )}
                      {item.variant && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {item.variant.attributes.map((attr) => (
                            <Badge
                              key={attr.attributeType.name}
                              variant="outline"
                              className="text-xs"
                            >
                              {attr.attributeType.displayName}: {attr.attributeValue.displayValue}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {item.notes && (
                        <p className="mt-1 text-xs italic text-slate-400">{item.notes}</p>
                      )}
                    </div>

                    <div className="mt-2 flex items-center gap-3">
                      <span className="text-lg font-semibold text-slate-900">
                        {formatCurrency(currentPrice)}
                      </span>
                      {item.product.compareAtPrice && item.product.compareAtPrice > currentPrice && (
                        <span className="text-sm text-slate-400 line-through">
                          {formatCurrency(item.product.compareAtPrice)}
                        </span>
                      )}
                      {priceDropped && (
                        <Badge className="bg-green-50 text-green-700 border-green-200 text-xs">
                          Price dropped!
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleMoveToCart(item)}
                      disabled={movingId === item.id}
                      className="gap-2"
                    >
                      {movingId === item.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ShoppingCart className="h-4 w-4" />
                      )}
                      Add to Cart
                    </Button>
                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      disabled={removingId === item.id}
                      className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      aria-label="Remove from wishlist"
                    >
                      {removingId === item.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Continue Shopping */}
      <div className="text-center">
        <Link
          href="/storefront/products"
          className="text-sm font-semibold text-blue-600 hover:text-blue-500"
        >
          ← Continue Shopping
        </Link>
      </div>
    </div>
  );
}
