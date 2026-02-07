'use client';

import { useEffect, useState } from 'react';
import { Card } from '@platform/ui';
import { DollarSign, ShoppingCart, Package, Activity, CheckCircle, Circle, ArrowRight, ExternalLink, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface DashboardData {
  totalRevenue: number;
  totalOrders: number;
  totalProducts: number;
  paymentStatus: string;
  paymentProvider: string | null;
  storeUrl: string | null;
  checklist: {
    paymentsConnected: boolean;
    hasProducts: boolean;
    hasCustomizedSettings: boolean;
  };
  recentOrders: {
    id: string;
    orderNumber: string;
    customerEmail: string;
    amount: number;
    status: string;
    createdAt: string;
  }[];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
    CONFIRMED: 'bg-blue-50 text-blue-700 border-blue-200',
    PROCESSING: 'bg-blue-50 text-blue-700 border-blue-200',
    SHIPPED: 'bg-purple-50 text-purple-700 border-purple-200',
    DELIVERED: 'bg-green-50 text-green-700 border-green-200',
    CANCELLED: 'bg-red-50 text-red-700 border-red-200',
    REFUNDED: 'bg-slate-50 text-slate-700 border-slate-200',
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const token = localStorage.getItem('access_token');
        const tenantId = localStorage.getItem('tenantId');

        const res = await fetch('/api/v1/store/admin/dashboard', {
          headers: {
            Authorization: `Bearer ${token}`,
            'x-tenant-id': tenantId || '',
          },
        });

        if (!res.ok) throw new Error('Failed to load dashboard');
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm text-slate-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 lg:p-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-600">{error || 'Failed to load dashboard data.'}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 text-sm font-medium text-red-700 underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const showChecklist =
    !data.checklist.paymentsConnected ||
    !data.checklist.hasProducts ||
    !data.checklist.hasCustomizedSettings;

  const statCards = [
    {
      label: 'Total Revenue',
      value: formatCurrency(data.totalRevenue),
      icon: DollarSign,
      iconBg: 'bg-emerald-50 text-emerald-600',
    },
    {
      label: 'Total Orders',
      value: data.totalOrders.toLocaleString(),
      icon: ShoppingCart,
      iconBg: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Published Products',
      value: data.totalProducts.toLocaleString(),
      icon: Package,
      iconBg: 'bg-purple-50 text-purple-600',
    },
    {
      label: 'Payment Status',
      value: data.paymentProvider
        ? data.paymentProvider.charAt(0).toUpperCase() + data.paymentProvider.slice(1)
        : 'Not Set Up',
      icon: Activity,
      iconBg: data.paymentStatus === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600',
      badge: data.paymentStatus === 'active'
        ? { text: 'Connected', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
        : { text: 'Pending', className: 'bg-amber-50 text-amber-700 border-amber-200' },
    },
  ];

  const checklistItems = [
    {
      label: 'Connect payments',
      done: data.checklist.paymentsConnected,
      href: '/app/settings/payments',
    },
    {
      label: 'Add your first product',
      done: data.checklist.hasProducts,
      href: '/app/products/new',
    },
    {
      label: 'Configure shipping & tax',
      done: data.checklist.hasCustomizedSettings,
      href: '/app/settings/shipping',
    },
    {
      label: 'Share your store',
      done: false,
      href: data.storeUrl || '#',
      external: true,
    },
  ];

  const completedCount = checklistItems.filter((item) => item.done).length;

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Dashboard
        </h2>
        <p className="mt-1 text-slate-500">Welcome back. Here&apos;s how your store is doing.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="p-6">
              <div className="flex items-center justify-between pb-2">
                <span className="text-sm font-medium text-slate-500">{stat.label}</span>
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${stat.iconBg}`}>
                  <Icon className="h-4.5 w-4.5" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  {stat.value}
                </span>
                {stat.badge && (
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${stat.badge.className}`}>
                    {stat.badge.text}
                  </span>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Getting Started Checklist */}
      {showChecklist && (
        <Card className="p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Getting Started
              </h3>
              <p className="mt-0.5 text-sm text-slate-500">
                Complete these steps to launch your store
              </p>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              {completedCount} of {checklistItems.length} done
            </span>
          </div>

          <div className="space-y-3">
            {checklistItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                target={item.external ? '_blank' : undefined}
                rel={item.external ? 'noopener noreferrer' : undefined}
                className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3.5 transition hover:border-blue-200 hover:bg-blue-50/50"
              >
                <div className="flex items-center gap-3">
                  {item.done ? (
                    <CheckCircle className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <Circle className="h-5 w-5 text-slate-300" />
                  )}
                  <span
                    className={`text-sm font-medium ${
                      item.done ? 'text-slate-400 line-through' : 'text-slate-700'
                    }`}
                  >
                    {item.label}
                  </span>
                </div>
                {item.external ? (
                  <ExternalLink className="h-4 w-4 text-slate-400" />
                ) : (
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                )}
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Recent Orders */}
      <Card className="p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Recent Orders
            </h3>
            <p className="mt-0.5 text-sm text-slate-500">Your latest customer orders</p>
          </div>
          <Link
            href="/app/orders"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            View All Orders
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {data.recentOrders.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-slate-200 py-12 text-center">
            <ShoppingCart className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-500">No orders yet</p>
            <p className="mt-1 text-sm text-slate-400">
              Once customers start buying, they&apos;ll show up here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="pb-3 pr-4 font-medium text-slate-500">Order</th>
                  <th className="pb-3 pr-4 font-medium text-slate-500">Customer</th>
                  <th className="pb-3 pr-4 font-medium text-slate-500">Amount</th>
                  <th className="pb-3 pr-4 font-medium text-slate-500">Status</th>
                  <th className="pb-3 font-medium text-slate-500">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.recentOrders.slice(0, 5).map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/50">
                    <td className="py-3.5 pr-4">
                      <Link
                        href={`/app/orders/${order.id}`}
                        className="font-medium text-blue-600 hover:text-blue-700"
                      >
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="py-3.5 pr-4 text-slate-600">{order.customerEmail}</td>
                    <td className="py-3.5 pr-4 font-medium text-slate-900">
                      {formatCurrency(order.amount)}
                    </td>
                    <td className="py-3.5 pr-4">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="py-3.5 text-slate-500">{formatDate(order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
