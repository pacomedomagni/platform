/**
 * Order Confirmation Page
 * Shows order details after successful checkout, with post-purchase upsells:
 * - "What happens next" timeline
 * - Tracking placeholder
 * - Reorder these items
 * - Guest -> account creation CTA
 * - Resend receipt (with mailto: fallback)
 */
'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button, Card, Badge, Spinner, ToastAction, toast } from '@platform/ui';
import {
  ArrowRight,
  CheckCircle,
  Clock,
  Mail,
  Package,
  Repeat,
  Truck,
  UserPlus,
} from 'lucide-react';
import { ordersApi, checkoutApi, OrderDetail } from '../../../lib/store-api';
import { useAuthStore } from '../../../lib/auth-store';
import { useCartStore } from '../../../lib/cart-store';
import { formatCurrency } from '../_lib/format';

const SUPPORT_EMAIL = 'support@noslag.com';

function OrderConfirmationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order_id') || searchParams.get('order');
  const { isAuthenticated } = useAuthStore();
  const { addItem } = useCartStore();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    async function loadOrder() {
      if (!orderId) {
        setError('No order ID provided');
        setLoading(false);
        return;
      }

      try {
        // orderId could be UUID or orderNumber - try direct get first, then lookup by order number
        let orderData: OrderDetail;
        try {
          orderData = await ordersApi.get(orderId);
        } catch {
          const checkout = await checkoutApi.getByOrderNumber(orderId);
          orderData = await ordersApi.get(checkout.id);
        }
        setOrder(orderData);
      } catch {
        setError('Failed to load order details');
      } finally {
        setLoading(false);
      }
    }

    loadOrder();
  }, [orderId]);

  const handleReorder = async () => {
    if (!order) return;
    setReordering(true);
    try {
      // Sequential adds — the cart API isn't bulk-aware in this codebase.
      // Use the snapshot's product/variant IDs (NOT the line-item id, which
      // was the previous bug — passing a line-item id to addItem silently
      // failed and the user was told "items added" when zero had been).
      let added = 0;
      let skipped = 0;
      for (const item of order.items) {
        const idToAdd = item.variantId ?? item.productId;
        if (!idToAdd) {
          // Snapshot-only line (product deleted since order placed). Skip.
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
              : 'Something went wrong adding these items to your cart.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: `${added} item${added === 1 ? '' : 's'} added to cart`,
        description: skipped > 0 ? `${skipped} item${skipped === 1 ? '' : 's'} skipped (no longer available).` : undefined,
        action: (
          <ToastAction altText="View cart" onClick={() => router.push('/storefront/cart')}>
            View cart
          </ToastAction>
        ),
      });
      router.push('/storefront/cart');
    } finally {
      setReordering(false);
    }
  };

  const handleResendReceipt = async () => {
    if (!order) return;
    setResending(true);
    try {
      // Best-effort: try the convention; fall through to mailto if unavailable.
      const apiBase =
        process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
      const tenantId =
        (typeof window !== 'undefined' && sessionStorage.getItem('resolved_tenant_id')) ||
        'default';
      const token =
        typeof window !== 'undefined' ? localStorage.getItem('customer_token') : null;
      const res = await fetch(
        `${apiBase}/v1/store/orders/${order.id}/resend-receipt`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': tenantId,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );
      if (res.ok) {
        toast({
          title: 'Receipt sent',
          description: `Sent to ${order.email}`,
        });
      } else {
        // Fallback: open mailto
        window.location.href = `mailto:${SUPPORT_EMAIL}?subject=Resend receipt for order ${order.orderNumber}&body=Please resend the receipt for order ${order.orderNumber} to ${order.email}.`;
      }
    } catch {
      window.location.href = `mailto:${SUPPORT_EMAIL}?subject=Resend receipt for order ${order.orderNumber}&body=Please resend the receipt for order ${order.orderNumber} to ${order.email}.`;
    } finally {
      setResending(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-20">
        <div className="flex items-center justify-center">
          <Spinner className="h-8 w-8 text-primary" aria-hidden="true" />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-20 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Order Not Found</h1>
        <p className="mt-2 text-slate-500">{error || 'Unable to find your order.'}</p>
        <Link
          href="/storefront/products"
          className="mt-6 inline-flex items-center gap-2 text-blue-600 hover:text-blue-500"
        >
          Continue shopping <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  const orderDate = new Date(order.createdAt);
  const isGuest = !isAuthenticated;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-6 py-12">
      {/* Success Header */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="text-3xl font-semibold text-slate-900">Thank you for your order!</h1>
        <p className="mt-2 text-slate-500">
          Order <span className="font-semibold text-slate-900">#{order.orderNumber}</span> has been confirmed.
        </p>
      </div>

      {/* Order Status */}
      <Card className="border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-blue-50 p-3">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Order Status</p>
              <p className="font-semibold text-slate-900 capitalize">{order.status.replace('_', ' ')}</p>
            </div>
          </div>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            {order.paymentStatus === 'paid' ? 'Payment Confirmed' : order.paymentStatus}
          </Badge>
        </div>
      </Card>

      {/* Email Confirmation */}
      <Card className="border-slate-200/70 bg-blue-50 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <Mail className="h-5 w-5 text-blue-600" />
          <p className="flex-1 text-sm text-blue-800">
            A confirmation email has been sent to <span className="font-semibold">{order.email}</span>
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleResendReceipt}
            disabled={resending}
            aria-busy={resending}
          >
            {resending ? <Spinner className="h-3.5 w-3.5" aria-hidden="true" /> : 'Resend receipt'}
          </Button>
        </div>
      </Card>

      {/* What happens next */}
      <Card className="border-slate-200/70 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">What happens next</h2>
        <ol className="space-y-4">
          <li className="flex gap-3">
            <span
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700"
              aria-hidden="true"
            >
              <CheckCircle className="h-4 w-4" />
            </span>
            <div>
              <p className="font-medium text-slate-900">Order received</p>
              <p className="text-xs text-slate-500">
                {orderDate.toLocaleString()}
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"
              aria-hidden="true"
            >
              <Clock className="h-4 w-4" />
            </span>
            <div>
              <p className="font-medium text-slate-900">Payment confirmation</p>
              <p className="text-xs text-slate-500">
                Immediate to a few minutes — we&apos;ll email you when it clears.
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"
              aria-hidden="true"
            >
              <Truck className="h-4 w-4" />
            </span>
            <div>
              <p className="font-medium text-slate-900">Shipping & tracking</p>
              <p className="text-xs text-slate-500">
                You&apos;ll receive an email within 24-48 hours with tracking details.
              </p>
            </div>
          </li>
        </ol>
      </Card>

      {/* Tracking placeholder */}
      <Card className="border-dashed border-slate-300 bg-slate-50 p-5 shadow-none">
        <div className="flex items-start gap-3">
          <Truck className="mt-0.5 h-5 w-5 text-slate-500" aria-hidden="true" />
          <div>
            <p className="font-semibold text-slate-900">Tracking will appear here</p>
            <p className="mt-1 text-sm text-slate-500">
              Once your order ships, tracking info will appear in your account or by email.
            </p>
          </div>
        </div>
      </Card>

      {/* Order Items */}
      <Card className="border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Order Items</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReorder}
            disabled={reordering}
            aria-busy={reordering}
            className="gap-2"
          >
            {reordering ? (
              <Spinner className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Repeat className="h-4 w-4" aria-hidden="true" />
            )}
            Reorder these items
          </Button>
        </div>
        <div className="divide-y divide-slate-100">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
              <div className="h-16 w-16 rounded-lg bg-slate-100 flex items-center justify-center">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} className="h-full w-full rounded-lg object-cover" />
                ) : (
                  <Package className="h-6 w-6 text-slate-400" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium text-slate-900">{item.name}</p>
                <p className="text-sm text-slate-500">Qty: {item.quantity}</p>
              </div>
              <p className="font-semibold text-slate-900">{formatCurrency(item.totalPrice)}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-2 border-t border-slate-200 pt-4 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span>{formatCurrency(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Shipping</span>
            <span>{formatCurrency(order.shippingTotal)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Tax</span>
            <span>{formatCurrency(order.taxTotal)}</span>
          </div>
          {order.discountTotal > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount</span>
              <span>-{formatCurrency(order.discountTotal)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
            <span>Total</span>
            <span>{formatCurrency(order.grandTotal)}</span>
          </div>
        </div>
      </Card>

      {/* Shipping Address */}
      <Card className="border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-slate-100 p-3">
            <Truck className="h-5 w-5 text-slate-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Shipping Address</h3>
            <address className="mt-2 text-sm not-italic text-slate-600">
              {order.shippingAddress.firstName} {order.shippingAddress.lastName}<br />
              {order.shippingAddress.addressLine1}<br />
              {order.shippingAddress.addressLine2 && <>{order.shippingAddress.addressLine2}<br /></>}
              {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}<br />
              {order.shippingAddress.country}
            </address>
          </div>
        </div>
      </Card>

      {/* Guest -> account CTA */}
      {isGuest && (
        <Card className="border-primary/30 bg-primary/5 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-primary/15 p-3">
              <UserPlus className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900">Create an account to track your order</h3>
              <p className="mt-1 text-sm text-slate-600">
                Save your shipping details, view order status, and reorder in one click.
              </p>
              <Link
                href={`/storefront/account/register?email=${encodeURIComponent(order.email)}`}
                className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
              >
                Create account <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-wrap justify-center gap-4">
        <Link
          href="/storefront/account/orders"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
        >
          View Order History
        </Link>
        <Link
          href="/storefront/products"
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 via-blue-600 to-amber-400 px-6 py-3 text-sm font-semibold text-white shadow-md hover:shadow-lg"
        >
          Continue Shopping <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

// Wrapper with Suspense boundary for useSearchParams
export default function OrderConfirmationPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-3xl px-6 py-20">
          <div className="flex items-center justify-center">
            <Spinner className="h-8 w-8 text-blue-600" />
          </div>
        </div>
      }
    >
      <OrderConfirmationContent />
    </Suspense>
  );
}
