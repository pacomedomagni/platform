/**
 * Customer Orders Page
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, Badge } from '@platform/ui';
import { Package, ChevronRight } from 'lucide-react';
import { useAuthStore } from '../../../../lib/auth-store';
import { ordersApi, OrderSummary } from '../../../../lib/store-api';
import { formatCurrency } from '../../_lib/format';

export default function OrdersPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/storefront/account/login');
      return;
    }

    if (isAuthenticated) {
      ordersApi.list({ limit: 50 })
        .then((data: any) => setOrders(data.orders || data.data || []))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [isAuthenticated, authLoading, router]);

  if (authLoading || loading) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-20">
        <div className="flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'delivered':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'shipped':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'processing':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'cancelled':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
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
          {orders.map((order) => (
            <Link key={order.id} href={`/storefront/account/orders/${order.id}`}>
              <Card className="flex items-center justify-between border-slate-200/70 bg-white p-5 shadow-sm transition-all hover:shadow-md">
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-slate-100 p-3">
                    <Package className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">#{order.orderNumber}</p>
                    <p className="text-sm text-slate-500">
                      {new Date(order.createdAt).toLocaleDateString()} · {order.itemCount} item{order.itemCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-semibold text-slate-900">{formatCurrency(order.grandTotal)}</p>
                    <Badge variant="outline" className={getStatusColor(order.status)}>
                      {order.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-400" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
