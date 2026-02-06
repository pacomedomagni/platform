/**
 * Order Confirmation Page
 * Shows order details after successful checkout
 */
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, Badge } from '@platform/ui';
import { CheckCircle, Package, Truck, Mail, ArrowRight } from 'lucide-react';
import { ordersApi, OrderDetail } from '../../../lib/store-api';
import { formatCurrency } from '../_lib/format';

export default function OrderConfirmationPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order_id');
  // const paymentIntent = searchParams.get('payment_intent');
  
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadOrder() {
      if (!orderId) {
        setError('No order ID provided');
        setLoading(false);
        return;
      }

      try {
        const orderData = await ordersApi.get(orderId);
        setOrder(orderData);
      } catch {
        setError('Failed to load order details');
      } finally {
        setLoading(false);
      }
    }

    loadOrder();
  }, [orderId]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-20">
        <div className="flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
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
        <div className="flex items-center gap-3">
          <Mail className="h-5 w-5 text-blue-600" />
          <p className="text-sm text-blue-800">
            A confirmation email has been sent to <span className="font-semibold">{order.email}</span>
          </p>
        </div>
      </Card>

      {/* Order Items */}
      <Card className="border-slate-200/70 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Order Items</h2>
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
