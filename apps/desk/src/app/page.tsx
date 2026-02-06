'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ShoppingCart,
  Package,
  DollarSign,
  Users,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Clock,
  CheckCircle,
  Truck,
  XCircle,
} from 'lucide-react';
import { Button, Card, Badge, Skeleton } from '@platform/ui';

interface DashboardSummary {
  revenue: {
    today: number;
    yesterday: number;
    thisWeek: number;
    lastWeek: number;
    thisMonth: number;
    lastMonth: number;
    percentageChangeWeek: number;
    percentageChangeMonth: number;
  };
  orders: {
    pending: number;
    processing: number;
    shipped: number;
    delivered: number;
    cancelled: number;
    todayCount: number;
    weekCount: number;
    monthCount: number;
  };
  inventory: {
    lowStock: Array<{
      id: string;
      code: string;
      name: string;
      currentStock: number;
      reorderLevel: number;
    }>;
    outOfStock: Array<{
      id: string;
      code: string;
      name: string;
    }>;
    totalActive: number;
  };
  payments: {
    pendingCount: number;
    pendingTotal: number;
    capturedToday: number;
  };
  customers: {
    total: number;
    newThisWeek: number;
    newThisMonth: number;
  };
  topProducts: Array<{
    id: string;
    code: string;
    name: string;
    salesCount: number;
    revenue: number;
  }>;
  recentActivity: Array<{
    id: string;
    type: string;
    action: string;
    description: string;
    timestamp: string;
  }>;
}

interface AttentionItems {
  urgentOrders: number;
  lowStockCount: number;
  outOfStockCount: number;
  pendingPayments: number;
  unshippedOrders: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [attention, setAttention] = useState<AttentionItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const [summaryRes, attentionRes] = await Promise.all([
          fetch('/api/v1/dashboard/summary'),
          fetch('/api/v1/dashboard/attention'),
        ]);

        if (!summaryRes.ok || !attentionRes.ok) {
          throw new Error('Failed to fetch dashboard data');
        }

        const [summaryData, attentionData] = await Promise.all([
          summaryRes.json(),
          attentionRes.json(),
        ]);

        setSummary(summaryData);
        setAttention(attentionData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-6">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-32 mb-1" />
              <Skeleton className="h-3 w-20" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
        <AlertTriangle className="h-12 w-12 text-amber-500" />
        <h2 className="text-xl font-semibold">Failed to load dashboard</h2>
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  const totalAttentionItems = attention
    ? attention.urgentOrders +
      attention.lowStockCount +
      attention.outOfStockCount +
      attention.pendingPayments +
      attention.unshippedOrders
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Last updated: {new Date().toLocaleTimeString()}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Attention Banner */}
      {totalAttentionItems > 0 && (
        <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/20 p-4">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-amber-900 dark:text-amber-100">
                {totalAttentionItems} items need your attention
              </h3>
              <div className="flex flex-wrap gap-3 mt-1 text-sm text-amber-700 dark:text-amber-300">
                {attention?.urgentOrders ? (
                  <span>{attention.urgentOrders} orders to process</span>
                ) : null}
                {attention?.unshippedOrders ? (
                  <span>{attention.unshippedOrders} orders to ship</span>
                ) : null}
                {attention?.lowStockCount ? (
                  <span>{attention.lowStockCount} low stock items</span>
                ) : null}
                {attention?.outOfStockCount ? (
                  <span>{attention.outOfStockCount} out of stock</span>
                ) : null}
                {attention?.pendingPayments ? (
                  <span>{attention.pendingPayments} pending payments</span>
                ) : null}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Revenue Card */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Revenue (This Week)
            </span>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold">
              {formatCurrency(summary?.revenue.thisWeek || 0)}
            </div>
            <div className="flex items-center gap-1 text-sm">
              {(summary?.revenue.percentageChangeWeek || 0) >= 0 ? (
                <>
                  <TrendingUp className="h-3 w-3 text-emerald-500" />
                  <span className="text-emerald-500">
                    +{(summary?.revenue.percentageChangeWeek || 0).toFixed(1)}%
                  </span>
                </>
              ) : (
                <>
                  <TrendingDown className="h-3 w-3 text-red-500" />
                  <span className="text-red-500">
                    {(summary?.revenue.percentageChangeWeek || 0).toFixed(1)}%
                  </span>
                </>
              )}
              <span className="text-muted-foreground">vs last week</span>
            </div>
          </div>
        </Card>

        {/* Orders Card */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Orders (This Week)
            </span>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold">
              {summary?.orders.weekCount || 0}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{summary?.orders.todayCount || 0} today</span>
              <span>•</span>
              <span>{summary?.orders.pending || 0} pending</span>
            </div>
          </div>
        </Card>

        {/* Customers Card */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Customers
            </span>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold">
              {summary?.customers.total || 0}
            </div>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-emerald-500">
                +{summary?.customers.newThisWeek || 0}
              </span>
              <span className="text-muted-foreground">new this week</span>
            </div>
          </div>
        </Card>

        {/* Inventory Card */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Products
            </span>
            <Package className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold">
              {summary?.inventory.totalActive || 0}
            </div>
            <div className="flex items-center gap-2 text-sm">
              {(summary?.inventory.lowStock.length || 0) > 0 && (
                <Badge variant="warning">
                  {summary?.inventory.lowStock.length} low stock
                </Badge>
              )}
              {(summary?.inventory.outOfStock.length || 0) > 0 && (
                <Badge variant="destructive">
                  {summary?.inventory.outOfStock.length} out
                </Badge>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Order Status & Recent Activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Order Pipeline */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Order Pipeline</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                <span>Pending</span>
              </div>
              <Badge variant="secondary">{summary?.orders.pending || 0}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-500" />
                <span>Processing</span>
              </div>
              <Badge variant="secondary">
                {summary?.orders.processing || 0}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-purple-500" />
                <span>Shipped</span>
              </div>
              <Badge variant="secondary">{summary?.orders.shipped || 0}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                <span>Delivered</span>
              </div>
              <Badge variant="secondary">
                {summary?.orders.delivered || 0}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                <span>Cancelled</span>
              </div>
              <Badge variant="secondary">
                {summary?.orders.cancelled || 0}
              </Badge>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t">
            <Link href="/desk/Order">
              <Button variant="ghost" size="sm" className="w-full">
                View All Orders <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </Card>

        {/* Recent Activity */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {summary?.recentActivity.slice(0, 6).map((activity) => (
              <div key={activity.id} className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  {activity.type === 'order' && (
                    <ShoppingCart className="h-4 w-4" />
                  )}
                  {activity.type === 'customer' && (
                    <Users className="h-4 w-4" />
                  )}
                  {activity.type === 'payment' && (
                    <DollarSign className="h-4 w-4" />
                  )}
                  {activity.type === 'product' && (
                    <Package className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{activity.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(activity.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {(!summary?.recentActivity ||
            summary.recentActivity.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No recent activity
            </p>
          )}
        </Card>
      </div>

      {/* Top Products & Inventory Alerts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top Products */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Top Selling Products</h3>
          <div className="space-y-3">
            {summary?.topProducts.map((product, index) => (
              <div key={product.id} className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{product.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {product.salesCount} sold
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">
                    {formatCurrency(product.revenue)}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {(!summary?.topProducts || summary.topProducts.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No sales data yet
            </p>
          )}
        </Card>

        {/* Inventory Alerts */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Inventory Alerts</h3>
          <div className="space-y-2">
            {summary?.inventory.outOfStock.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-2 rounded-lg bg-red-50 dark:bg-red-950/20"
              >
                <div>
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.code}</p>
                </div>
                <Badge variant="destructive">Out of Stock</Badge>
              </div>
            ))}
            {summary?.inventory.lowStock.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20"
              >
                <div>
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.currentStock} left (reorder at {item.reorderLevel})
                  </p>
                </div>
                <Badge variant="warning">Low Stock</Badge>
              </div>
            ))}
          </div>
          {(summary?.inventory.outOfStock.length === 0 &&
            summary?.inventory.lowStock.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-4">
              All inventory levels are healthy
            </p>
          )}
          <div className="mt-4 pt-4 border-t">
            <Link href="/desk/Item">
              <Button variant="ghost" size="sm" className="w-full">
                Manage Inventory <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <Link href="/desk/Sales Order/new">
            <Button>New Sales Order</Button>
          </Link>
          <Link href="/desk/Customer/new">
            <Button variant="outline">New Customer</Button>
          </Link>
          <Link href="/desk/Item/new">
            <Button variant="outline">New Product</Button>
          </Link>
          <Link href="/desk/Purchase Order/new">
            <Button variant="outline">New Purchase Order</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
