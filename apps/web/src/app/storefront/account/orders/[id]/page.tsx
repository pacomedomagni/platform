'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, Badge } from '@platform/ui';
import { Package, ArrowLeft, Truck } from 'lucide-react';
import { useAuthStore } from '../../../../../lib/auth-store';
import { ordersApi, OrderDetail } from '../../../../../lib/store-api';
import { formatCurrency } from '../../../_lib/format';

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/storefront/account/login');
      return;
    }

    if (isAuthenticated && orderId) {
      ordersApi
        .get(orderId)
        .then((data) => setOrder(data))
        .catch(() => setError('Order not found'))
        .finally(() => setLoading(false));
    }
  }, [isAuthenticated, authLoading, router, orderId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'delivered':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'shipped':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'processing':
      case 'confirmed':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'cancelled':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  if (authLoading || loading) {
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
      <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-12">
        <Link
          href="/storefront/account/orders"
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-500"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Orders
        </Link>
        <Card className="border-slate-200/70 bg-white p-12 text-center shadow-sm">
          <Package className="mx-auto h-12 w-12 text-slate-300" />
          <h2 className="mt-4 text-lg font-semibold text-slate-900">Order not found</h2>
          <p className="mt-2 text-sm text-slate-500">{error || 'This order could not be loaded.'}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Order #{order.orderNumber}</h1>
          <p className="text-sm text-slate-500">
            Placed on {new Date(order.createdAt).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>
        <Link
          href="/storefront/account/orders"
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-500"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Orders
        </Link>
      </div>

      {/* Status */}
      <Card className="border-slate-200/70 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package className="h-5 w-5 text-slate-400" />
            <span className="text-sm text-slate-600">Order Status</span>
          </div>
          <Badge variant="outline" className={getStatusColor(order.status)}>
            {order.status.replace('_', ' ')}
          </Badge>
        </div>
        {order.trackingNumber && (
          <div className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-3">
            <Truck className="h-5 w-5 text-slate-400" />
            <div>
              <p className="text-sm text-slate-600">
                Tracking: <span className="font-semibold">{order.trackingNumber}</span>
              </p>
              {order.shippingCarrier && (
                <p className="text-xs text-slate-500">via {order.shippingCarrier}</p>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Items */}
      <Card className="border-slate-200/70 bg-white shadow-sm">
        <div className="p-5 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Items ({order.items.length})</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center gap-4 p-5">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="h-16 w-16 rounded-lg object-cover border border-slate-200"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-400">
                  {item.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}
                </div>
              )}
              <div className="flex-1">
                <p className="font-semibold text-slate-900">{item.name}</p>
                <p className="text-sm text-slate-500">Qty: {item.quantity} x {formatCurrency(item.unitPrice)}</p>
              </div>
              <p className="font-semibold text-slate-900">{formatCurrency(item.totalPrice)}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Order Summary */}
      <Card className="border-slate-200/70 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900 mb-4">Order Summary</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Subtotal</span>
            <span className="text-slate-900">{formatCurrency(order.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Shipping</span>
            <span className="text-slate-900">{formatCurrency(order.shippingTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Tax</span>
            <span className="text-slate-900">{formatCurrency(order.taxTotal)}</span>
          </div>
          {order.discountTotal > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-500">Discount</span>
              <span className="text-green-600">-{formatCurrency(order.discountTotal)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-100 pt-2 font-semibold">
            <span className="text-slate-900">Total</span>
            <span className="text-slate-900">{formatCurrency(order.grandTotal)}</span>
          </div>
        </div>
      </Card>

      {/* Shipping Address */}
      {order.shippingAddress && (
        <Card className="border-slate-200/70 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-3">Shipping Address</h2>
          <div className="text-sm text-slate-600">
            <p>{order.shippingAddress.firstName} {order.shippingAddress.lastName}</p>
            <p>{order.shippingAddress.addressLine1}</p>
            {order.shippingAddress.addressLine2 && <p>{order.shippingAddress.addressLine2}</p>}
            <p>
              {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}
            </p>
            <p>{order.shippingAddress.country}</p>
          </div>
        </Card>
      )}
    </div>
  );
}
