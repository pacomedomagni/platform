/**
 * Customer Orders Page
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Card, Spinner, StatusBadge, ToastAction, toast } from '@platform/ui';
import { ChevronLeft, ChevronRight, ExternalLink, Package, Repeat } from 'lucide-react';
import { useAuthStore } from '../../../../lib/auth-store';
import { useCartStore } from '../../../../lib/cart-store';
import { ordersApi, OrderSummary } from '../../../../lib/store-api';
import { formatCurrency } from '../../_lib/format';

// Carrier -> tracking URL builder. Returns null when carrier is unknown
// so we render plain text instead of a broken link.
function trackingUrl(carrier: string | null | undefined, n: string): string | null {
  if (!carrier) return null;
  const c = carrier.toLowerCase();
  const enc = encodeURIComponent(n);
  if (c.includes('usps')) return `https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=${enc}`;
  if (c === 'ups' || c.includes('united parcel')) return `https://www.ups.com/track?tracknum=${enc}`;
  if (c.includes('fedex')) return `https://www.fedex.com/fedextrack/?trknbr=${enc}`;
  if (c.includes('dhl')) return `https://www.dhl.com/en/express/tracking.html?AWB=${enc}`;
  return null;
}

// OrderSummary doesn't carry tracking metadata, so widen locally.
type OrderRow = OrderSummary & {
  trackingNumber?: string | null;
  shippingCarrier?: string | null;
};

export default function OrdersPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const { addItem } = useCartStore();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  // SF-OR2: server-paginate the order list. The previous limit of 50 silently
  // dropped older orders for any returning customer with a long history. We
  // page through them instead.
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/storefront/account/login');
      return;
    }

    if (isAuthenticated) {
      setLoading(true);
      ordersApi
        .list({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE })
        .then((res) => {
          setOrders(res.data as OrderRow[]);
          setTotal(res.pagination.total);
          setTotalPages(Math.max(1, Math.ceil(res.pagination.total / PAGE_SIZE)));
        })
        .catch((err) => {
          console.error(err);
          toast({
            title: 'Could not load orders',
            description: err instanceof Error ? err.message : 'Please refresh and try again.',
            variant: 'destructive',
          });
        })
        .finally(() => setLoading(false));
    }
  }, [isAuthenticated, authLoading, router, page]);

  if (authLoading || (loading && orders.length === 0)) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-20">
        <div className="flex items-center justify-center">
          <Spinner className="h-8 w-8" aria-hidden="true" />
        </div>
      </div>
    );
  }

  const handleReorder = async (orderId: string) => {
    setReorderingId(orderId);
    try {
      // Fetch full detail so we have the line items.
      const detail = await ordersApi.get(orderId);
      let added = 0;
      let skipped = 0;
      for (const item of detail.items) {
        // Use product/variant IDs (NOT line-item id — see SF-OC4 / SF-OR1).
        const idToAdd = item.variantId ?? item.productId;
        if (!idToAdd) {
          skipped += 1;
          continue;
        }
        // eslint-disable-next-line no-await-in-loop
        const ok = await addItem(idToAdd, item.quantity)
          .then(() => true)
          .catch(() => false);
        if (ok) added += 1;
        else skipped += 1;
      }
      if (added === 0) {
        toast({
          title: 'Could not reorder',
          description:
            skipped > 0
              ? `${skipped} item${skipped === 1 ? '' : 's'} are no longer available.`
              : 'Please try again or contact support.',
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: `${added} item${added === 1 ? '' : 's'} added to cart`,
        description:
          skipped > 0
            ? `From order #${detail.orderNumber} · ${skipped} skipped (no longer available)`
            : `From order #${detail.orderNumber}`,
        action: (
          <ToastAction altText="View cart" onClick={() => router.push('/storefront/cart')}>
            View cart
          </ToastAction>
        ),
      });
      router.push('/storefront/cart');
    } catch {
      toast({
        title: 'Could not reorder',
        description: 'Please try again or contact support.',
        variant: 'destructive',
      });
    } finally {
      setReorderingId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Order History</h1>
          <p className="text-sm text-slate-500">View and track your orders</p>
        </div>
        <Link
          href="/storefront/account"
          className="text-sm text-blue-600 hover:text-blue-500"
        >
          ← Back to Account
        </Link>
      </div>

      {orders.length === 0 ? (
        <Card className="border-slate-200/70 bg-white p-12 text-center shadow-sm">
          <Package className="mx-auto h-12 w-12 text-slate-300" />
          <h2 className="mt-4 text-lg font-semibold text-slate-900">No orders yet</h2>
          <p className="mt-2 text-sm text-slate-500">
            When you place an order, it will appear here.
          </p>
          <Link
            href="/storefront/products"
            className="mt-6 inline-block rounded-lg bg-gradient-to-r from-indigo-600 via-blue-600 to-amber-400 px-6 py-3 text-sm font-semibold text-white shadow-md"
          >
            Start Shopping
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const trackingHref = order.trackingNumber
              ? trackingUrl(order.shippingCarrier, order.trackingNumber)
              : null;
            return (
              <Card
                key={order.id}
                className="border-slate-200/70 bg-white p-5 shadow-sm transition-all hover:shadow-md"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <Link
                    href={`/storefront/account/orders/${order.id}`}
                    className="flex items-center gap-4 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
                  >
                    <div className="rounded-full bg-slate-100 p-3">
                      <Package className="h-5 w-5 text-slate-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">#{order.orderNumber}</p>
                      <p className="text-sm text-slate-500">
                        {new Date(order.createdAt).toLocaleDateString()} · {order.itemCount} item{order.itemCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </Link>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold text-slate-900">{formatCurrency(order.grandTotal)}</p>
                      <StatusBadge kind="order" status={order.status} />
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-400" />
                  </div>
                </div>

                {/* Tracking row — only when shipped & has a tracking number */}
                {order.status?.toLowerCase() === 'shipped' && order.trackingNumber && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-sm">
                    <span className="text-slate-500">Tracking:</span>
                    {trackingHref ? (
                      <a
                        href={trackingHref}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                      >
                        {order.trackingNumber}
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                    ) : (
                      <span className="font-medium text-slate-700">{order.trackingNumber}</span>
                    )}
                    {order.shippingCarrier && (
                      <span className="text-xs text-slate-400">via {order.shippingCarrier}</span>
                    )}
                  </div>
                )}

                <div className="mt-3 flex justify-end border-t border-slate-100 pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleReorder(order.id)}
                    disabled={reorderingId === order.id}
                    aria-busy={reorderingId === order.id}
                    className="gap-2"
                  >
                    {reorderingId === order.id ? (
                      <Spinner className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Repeat className="h-4 w-4" aria-hidden="true" />
                    )}
                    Reorder
                  </Button>
                </div>
              </Card>
            );
          })}

          {totalPages > 1 && (
            <nav
              className="flex items-center justify-between border-t border-slate-100 pt-4"
              aria-label="Order list pagination"
            >
              <p className="text-xs text-slate-500">
                Showing{' '}
                <span className="font-medium text-slate-700">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}
                </span>{' '}
                of <span className="font-medium text-slate-700">{total}</span>
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  Previous
                </Button>
                <span className="text-xs text-slate-500" aria-live="polite">
                  Page {page} of {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                  aria-label="Next page"
                >
                  Next
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </nav>
          )}
        </div>
      )}
    </div>
  );
}
