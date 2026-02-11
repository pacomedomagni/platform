'use client';

import { useRouter } from 'next/navigation';
import { OrderStatusBadge, PaymentStatusBadge } from './order-status-badge';
import { Spinner } from '@platform/ui';
import { Package } from 'lucide-react';

interface Order {
  id: string;
  orderNumber: string;
  customer?: {
    name: string;
    email: string;
  };
  status: string;
  paymentStatus: string;
  grandTotal: number;
  itemCount: number;
  createdAt: string | Date;
}

interface OrderTableProps {
  orders: Order[];
  loading?: boolean;
}

export function OrderTable({ orders, loading }: OrderTableProps) {
  const router = useRouter();

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Package className="h-12 w-12 text-slate-300 mb-4" />
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">No orders yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">Orders will appear here once customers start purchasing.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-muted/60 text-muted-foreground">
          <tr>
            <th className="text-left p-3 font-medium">Order</th>
            <th className="text-left p-3 font-medium">Customer</th>
            <th className="text-left p-3 font-medium">Status</th>
            <th className="text-left p-3 font-medium">Payment</th>
            <th className="text-right p-3 font-medium">Items</th>
            <th className="text-right p-3 font-medium">Total</th>
            <th className="text-left p-3 font-medium">Date</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr
              key={order.id}
              onClick={() => router.push(`/app/orders/${order.id}`)}
              className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
            >
              <td className="p-3">
                <span className="font-medium text-primary">{order.orderNumber}</span>
              </td>
              <td className="p-3">
                {order.customer ? (
                  <div>
                    <p className="font-medium">{order.customer.name}</p>
                    <p className="text-sm text-muted-foreground">{order.customer.email}</p>
                  </div>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </td>
              <td className="p-3">
                <OrderStatusBadge status={order.status} />
              </td>
              <td className="p-3">
                <PaymentStatusBadge status={order.paymentStatus} />
              </td>
              <td className="p-3 text-right">{order.itemCount}</td>
              <td className="p-3 text-right font-medium">{formatCurrency(order.grandTotal)}</td>
              <td className="p-3 text-sm text-muted-foreground">
                {formatDate(order.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
